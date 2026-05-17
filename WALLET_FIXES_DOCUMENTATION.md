# Wallet & Spin Deposit Status Fixes

## Issues Fixed

### 1. Spin Wallet Deposits Showing Pending Status Even When Completed
**Problem:** Users depositing via M-Pesa to spin wallet were seeing "pending" status on the Transaction record, even though:
- The payment was successfully completed (M-Pesa callback confirmed)
- The SpinWallet balance was correctly credited
- The MpesaTransaction record showed correct status

**Root Cause:** 
- Transaction records were created with `status: 'pending'` 
- While the callback route updated the Transaction status, the `balance_updated` flag was not always set
- Reconciliation jobs could retry completed deposits
- Timing issues could prevent Transaction from being found during callback processing

### 2. MpesaTransactions Table Not Recording Status Correctly
**Problem:** The mpesaTransactions table should record all transaction statuses (completed, failed, cancelled, timeout) but some were stuck as pending.

**Root Cause:** The `syncSpinDepositTransactionWithMpesaStatus` function was updating MpesaTransaction status but not setting the `balance_updated` flag, which could cause retries.

---

## Solutions Implemented

### Fix 1: Enhanced Callback Route (`/app/api/mpesa/callback/route.ts`)

**Changes:**
- Added fallback handling when Transaction record is not found during callback (lines 638-658)
- Ensured `balance_updated` flag is ALWAYS set to true for completed transactions (lines 614-620)
- Added explicit console logging for debugging Transaction lookup issues
- Added fallback spin wallet credit logic if Transaction lookup fails

**Code:**
```typescript
// CRITICAL: Ensure balance_updated is ALWAYS set for completed transactions
if (!transaction.balance_updated) {
  transaction.balance_updated = true;
  console.log('🔒 Ensured balance_updated flag is set to prevent retries');
}
```

**Impact:** 
- Prevents reconciliation jobs from retrying already-completed spin deposits
- Ensures spin wallet gets credited even if Transaction lookup temporarily fails

### Fix 2: Enhanced Sync Function (`/app/actions/spin.ts`)

**Changes:**
- Modified `syncSpinDepositTransactionWithMpesaStatus` to set `balance_updated` flag for all terminal statuses (lines 732-739)
- Changed from `findOneAndUpdate` to explicit `findOneAndUpdate` with `$set` and `new: true` for better error handling
- Added validation to check if Transaction was actually found and updated
- Added return logging to confirm sync completion

**Code:**
```typescript
// Mark balance_updated for completed spin deposits to prevent retries
if (status === 'completed' && mpesaReceiptNumber) {
  updateData.balance_updated = true;
}

// For failed deposits, also mark balance_updated to prevent retries
if (['failed', 'cancelled', 'timeout'].includes(status)) {
  updateData.balance_updated = true;
}

const result = await (Transaction as any).findOneAndUpdate(
  { mpesa_transaction_id: mpesaTransactionId },
  { $set: updateData },
  { new: true }
);
```

**Impact:**
- Terminal status transactions are properly marked as processed
- Status is correctly synced from MpesaTransaction to Transaction record

### Fix 3: Added Reconciliation Function (`/app/actions/spin.ts`)

**New Function:** `reconcileSpinDepositStatus(mpesaTransactionId: string)`

**Purpose:** 
- Compares MpesaTransaction status with Transaction status
- Updates Transaction if they're out of sync
- Sets `balance_updated` flag
- Provides audit trail via metadata

**Usage:**
```typescript
const result = await reconcileSpinDepositStatus(transactionId);
```

**Impact:**
- Catches and fixes any status mismatches between tables
- Provides safety net for edge cases where callback may have missed Transaction update

### Fix 4: Enhanced Wallet Page (`/app/dashboard/wallet/page.tsx`)

**Changes:**
- Added import for `reconcileSpinDepositStatus` (line 12)
- Enhanced `fetchWalletData` function to detect pending spin deposits (lines 119-138)
- Triggers async reconciliation for any pending spin deposits without blocking UI
- Logs reconciliation attempts for debugging

**Code:**
```typescript
// Reconcile any pending spin deposits to ensure their status is correct
const pendingSpinDeposits = transformed.filter(
  tx => tx.status === 'pending' && tx.type === 'DEPOSIT' && tx.description?.includes('Spin')
);

if (pendingSpinDeposits.length > 0) {
  console.log('[v0] Found pending spin deposits, triggering reconciliation...');
  pendingSpinDeposits.forEach(async (tx) => {
    try {
      if (tx.id) {
        await reconcileSpinDepositStatus(tx.id);
      }
    } catch (error) {
      console.error('[v0] Reconciliation error for transaction:', tx.id, error);
    }
  });
}
```

**Impact:**
- Automatically fixes stale pending statuses when users refresh their wallet
- UI remains responsive while reconciliation happens in background
- Users see correct status on next refresh

---

## Testing & Verification

### Manual Testing Checklist

1. **Spin Deposit Success Scenario:**
   - [ ] User deposits via M-Pesa to spin wallet
   - [ ] M-Pesa STK prompt appears and user enters PIN
   - [ ] Payment completes (check M-Pesa statement)
   - [ ] Spin wallet balance updates immediately
   - [ ] Check console logs: Should see "Transaction marked as completed"
   - [ ] Verify in database: MpesaTransaction status = "completed", balance_updated = true
   - [ ] Refresh wallet page: Status should show "completed"

2. **Spin Deposit Failure Scenario:**
   - [ ] User initiates spin deposit
   - [ ] Payment fails (incorrect PIN, timeout, etc.)
   - [ ] Check console logs: Should see "Transaction marked as failed"
   - [ ] Verify in database: MpesaTransaction status = "failed", balance_updated = true
   - [ ] Spin wallet balance should NOT change
   - [ ] Refresh wallet page: Status should show "failed"

3. **Reconciliation Trigger:**
   - [ ] Manually set a completed transaction's status to "pending" in DB
   - [ ] Refresh wallet page
   - [ ] Check console: Should log reconciliation attempt
   - [ ] Transaction status should be corrected to "completed"

### Console Logs to Monitor

```
✅ Transaction marked as completed (transactionFlow)    // Good
❌ Transaction marked as [status]                       // Various statuses
🔒 Ensured balance_updated flag is set                 // Safety net activation
⚠️ No associated Transaction found                      // Fallback triggered
🔄 Successfully synced spin deposit transaction status  // Sync completed
✓ Transaction status already matches M-Pesa status     // No action needed
[v0] Found pending spin deposits, triggering reconciliation  // Auto-reconcile started
```

### Database Verification

**Check Transaction Collection:**
```javascript
db.transactions.findOne({
  user_id: ObjectId("userId"),
  type: "DEPOSIT",
  metadata: { depositType: "spin" }
})

// Should show:
{
  status: "completed",        // Not "pending"
  balance_updated: true,      // Critical flag
  amount_cents: 7000,
  metadata: {
    checkoutRequestID: "...",
    mpesaReceiptNumber: "...",
    transactionFlow: "neutral"
  }
}
```

**Check MpesaTransaction Collection:**
```javascript
db.mpesatransactions.findOne({
  _id: ObjectId("transactionId"),
  deposit_type: "spin"
})

// Should show:
{
  status: "completed",        // Matches Transaction
  result_code: 0,
  mpesa_receipt_number: "...",
  completed_at: ISODate("2026-05-17T..."),
  metadata: { callback_processed: true }
}
```

---

## Architecture Overview

### Transaction Flow for Spin Wallet Deposits

```
1. User initiates deposit via spin wallet page
   ↓
2. depositSpinWalletViaMpesa creates:
   - MpesaTransaction (status: 'initiated')
   - Transaction (status: 'pending', balance_updated: false)
   ↓
3. M-Pesa prompt displays
   ↓
4a. [Payment Success Path]
   - M-Pesa callback received
   - MpesaTransaction updated (status: 'completed')
   - SpinWallet balance credited
   - Transaction updated (status: 'completed', balance_updated: true)
   - syncSpinDepositTransactionWithMpesaStatus called
   ↓
4b. [Payment Failure Path]
   - M-Pesa callback received with failure code
   - MpesaTransaction updated (status: 'failed|cancelled|timeout')
   - Transaction updated (status: same, balance_updated: true)
   - No balance credit
   ↓
5. User refreshes wallet page
   - fetchWalletData called
   - Any pending spin deposits detected
   - reconcileSpinDepositStatus triggered for mismatches
   - Status corrected if needed
   ↓
6. Transaction display shows correct status
```

### Status Lifecycle

| Stage | MpesaTransaction | Transaction | SpinWallet | balance_updated |
|-------|------------------|-------------|-----------|-----------------|
| Initiated | initiated | pending | 0 | false |
| Callback Completed | completed | completed | +amount | true |
| Callback Failed | failed | failed | 0 | true |
| Reconciliation (if needed) | completed | completed | +amount | true |

---

## Potential Issues & Solutions

### Issue: Transaction still shows pending after refresh
**Solution:** Check browser console for reconciliation errors. If the `reconcileSpinDepositStatus` call failed, manual database update may be needed.

### Issue: Spin wallet not credited despite completed status
**Solution:** Check that SpinWallet record exists for the user. If missing, the callback's fallback `updateSpinWallet` call should have created it.

### Issue: Multiple M-Pesa callbacks received
**Solution:** The `balance_updated` flag and idempotency checks prevent double-crediting even if callback is processed twice.

---

## Files Modified

1. `/app/api/mpesa/callback/route.ts` - Enhanced error handling and balance_updated flag enforcement
2. `/app/actions/spin.ts` - Enhanced syncSpinDepositTransactionWithMpesaStatus + new reconcileSpinDepositStatus
3. `/app/dashboard/wallet/page.tsx` - Added reconciliation trigger on wallet refresh

---

## Performance Notes

- Reconciliation is async and non-blocking (wallet UI updates immediately)
- Each reconciliation is a single database operation
- No loops or batching needed (triggered per-transaction as needed)
- Console logging provides audit trail for debugging

---

## Future Improvements

1. Add batch reconciliation job for periodic cleanup of stale pending statuses
2. Add metrics tracking for reconciliation events
3. Add user notification when status is corrected
4. Implement retry logic with exponential backoff for failed reconciliations
