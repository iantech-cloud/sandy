# Spin Wallet Logic Verification & Testing Guide

## Overview

This document provides a comprehensive overview of the spin wallet deposit and spend flow, including verification steps to ensure the logic is working correctly.

---

## Accounting Model

### Balance Flow

```
User Deposit (Co-op Bank) → SpinWallet.balance_cents (user's spendable balance)
                          → Company Revenue ONLY when user spins

User Transfer (Main → Spin) → SpinWallet.balance_cents (user's spendable balance)
                            → Company Revenue ONLY when user spins

User Spin → Deduct from SpinWallet.balance_cents
         → Record SPIN_COST transaction (company revenue)
```

### Key Principle

**Company revenue (SPIN_COST) is ONLY recorded when a user actually spins.**

- Deposits do NOT immediately generate company revenue
- Transfers do NOT immediately generate company revenue
- Only the `performSpin()` function records SPIN_COST transactions

---

## Data Model

### SpinWallet Document

```typescript
{
  _id: ObjectId,
  user_id: string,                    // User's ID
  balance_cents: number,              // Deposited amount user can spend on spins
  spin_credits: number,               // DEPRECATED - no longer used
  total_deposited_cents: number,      // Total deposited (historical tracking)
  total_used_cents: number,           // Total spent on spins
  total_spins: number,                // Number of spins performed
  deposits: [{                        // History of all deposits
    amount_cents: number,
    mpesa_checkout_request_id?: string,
    mpesa_transaction_id?: ObjectId,
    mpesa_receipt_number?: string,
    mpesa_status: string,
    overall_status: string,
    status: string,
    phone_number?: string,
    deposited_at?: Date,
    created_at: Date
  }]
}
```

### Transaction Types

**SPIN_COST** (Company Revenue)
- Type: `SPIN_COST`
- Target Type: `company`
- Source: `spin_wallet`
- Amount: Cost of the spin (e.g., 3000 cents = KES 30)
- Only created when `performSpin()` completes successfully

**TRANSFER** (Audit Trail)
- Type: `TRANSFER`
- Target Type: `spin_wallet`
- Source: `main_wallet_transfer`
- Only tracks the internal transfer, NOT company revenue

**SPIN_WIN** (Prize Received)
- Type: `SPIN_WIN`
- Target Type: `user`
- Amount: Prize value
- Created when user wins a prize

---

## Code Paths Verification

### 1. Co-op Bank Deposit Flow ✅

**User Action:** User initiates spin deposit via Co-op Bank STK Push

**Code Path:**
1. `initiatSpinDeposit()` in `/app/actions/spin-wallet.ts`
   - Creates MpesaTransaction with `deposit_type: 'spin_wallet'`
   - Initiates Co-op Bank STK Push
   - Returns messageReference for polling

2. Co-op Bank callback → `/api/payments/coop-bank/callback/route.ts`
   - Finds MpesaTransaction by messageReference
   - Checks `deposit_type === 'spin_wallet'`
   - ✅ **CORRECT:** Credits `spinWallet.balance_cents`
   - ✅ **CORRECT:** Does NOT create SPIN_COST transaction
   - Logs: `"SpinWallet: +KES X credited to user Y. Balance now: KES Z"`

3. `checkSpinDepositStatus()` in `/app/actions/spin-wallet.ts`
   - Client polls to verify deposit completion
   - Returns updated balance_cents

**Expected Behavior:**
- ✅ User's `spinWallet.balance_cents` increases by deposit amount
- ✅ No SPIN_COST transaction is created
- ✅ Deposit record shows `status: 'completed'`

---

### 2. Main-to-Spin Wallet Transfer Flow ✅

**User Action:** User transfers from main wallet to spin wallet

**Code Path:**
1. `transferMainToSpinWallet()` in `/app/actions/spin-wallet.ts`
   - Checks user has sufficient main wallet balance
   - Amount must be multiple of KES 30
   - Deducts from `Profile.balance_cents`
   - ✅ **CORRECT:** Adds to `spinWallet.balance_cents`
   - ✅ **CORRECT:** Creates TRANSFER transaction (NOT SPIN_COST)

**Expected Behavior:**
- ✅ User's main wallet decreases
- ✅ User's spin wallet increases
- ✅ TRANSFER transaction created for audit trail
- ✅ NO SPIN_COST transaction created

---

### 3. Spin Performance Flow ✅

**User Action:** User spins (costs KES 30, KES 60, etc.)

**Code Path:**
1. `performSpin()` in `/app/actions/spin.ts`
   - Gets SpinWallet for user
   - ✅ **CORRECT:** Checks `spinWallet.balance_cents >= SPIN_COST_CENTS`
   - Selects prize via probability logic
   - ✅ **CORRECT:** Deducts from `spinWallet.balance_cents`
   - ✅ **CORRECT:** Creates SPIN_COST transaction (company revenue)
   - Calls `processPrize()` if won

2. `processPrize()` in `/app/actions/spin.ts`
   - Creates SPIN_WIN transaction
   - Credits prize to user based on type (balance, spins, airtime, etc.)

**Expected Behavior:**
- ✅ `spinWallet.balance_cents` decreases
- ✅ `spinWallet.total_used_cents` increases
- ✅ `spinWallet.total_spins` increases
- ✅ SPIN_COST transaction created (company gets revenue)
- ✅ SPIN_WIN transaction created (if prize won)
- ✅ Prize credited to user

---

## Testing Checklist

### Test 1: Co-op Bank Deposit Increases Balance

**Steps:**
1. Note user's current `spinWallet.balance_cents` (should be 0 initially)
2. Initiate deposit of KES 30 via Co-op Bank
3. Complete payment on phone
4. Poll status until completion
5. Check `getSpinWalletBalance()` response

**Expected:**
```json
{
  "success": true,
  "balance_cents": 3000,
  "balance_kes": "30.00",
  "spin_credits": 0,
  "total_deposited": 3000,
  "total_used": 0,
  "total_spins": 0
}
```

**Verify in Database:**
- `SpinWallet.balance_cents === 3000`
- `SpinWallet.total_deposited_cents === 3000`
- No `Transaction` with `type: 'SPIN_COST'` created

---

### Test 2: Transfer from Main Wallet

**Setup:** User must have KES 30+ in main wallet

**Steps:**
1. Note main wallet balance
2. Note spin wallet balance
3. Call `transferMainToSpinWallet(30)`
4. Verify success response

**Expected:**
```json
{
  "success": true,
  "message": "Successfully transferred KES 30.00 — 1 spin credit(s) added",
  "spin_credits": 1,
  "main_balance": 2700
}
```

**Verify in Database:**
- `Profile.balance_cents` decreased by 3000
- `SpinWallet.balance_cents` increased by 3000
- `Transaction` with `type: 'TRANSFER'` created
- NO `Transaction` with `type: 'SPIN_COST'` created

---

### Test 3: Spin Deducts Balance & Creates Revenue

**Setup:**
1. User has KES 60 in spin wallet (from Test 1 + Test 2, or manual deposit)
2. Note balance before spin: 6000 cents

**Steps:**
1. Call `performSpin(30)` (spin costs KES 30)
2. User wins a prize
3. Check response

**Expected:**
```json
{
  "success": true,
  "prizeType": "KES_5000",
  "prizeName": "KES 5,000",
  "prizeValue": 500000,
  "message": "Congratulations! You won: KES 5,000"
}
```

**Verify in Database:**
```javascript
// SpinWallet should show:
spinWallet.balance_cents === 3000  // 6000 - 3000
spinWallet.total_used_cents === 3000
spinWallet.total_spins === 1

// Transactions should include:
// 1. SPIN_COST (company revenue)
{
  user_id: userId,
  target_type: 'company',
  type: 'SPIN_COST',
  amount_cents: 3000,
  source: 'spin_wallet',
  status: 'completed'
}

// 2. SPIN_WIN (prize won)
{
  user_id: userId,
  target_type: 'user',
  type: 'SPIN_WIN',
  amount_cents: 500000,  // Prize value
  status: 'completed'
}

// User's Profile should show:
profile.balance_cents += 500000  // Prize credited
```

---

### Test 4: Insufficient Balance Check

**Setup:** User has KES 30 in spin wallet

**Steps:**
1. Call `performSpin(60)` (costs KES 60, but only have KES 30)
2. Check response

**Expected:**
```json
{
  "success": false,
  "message": "Insufficient spin wallet balance. You need KES 60.00 but have KES 30.00. Please deposit via M-Pesa."
}
```

**Verify:**
- SpinWallet balance unchanged (3000 cents)
- No SPIN_COST transaction created
- No SPIN_WIN transaction created

---

### Test 5: Multiple Spins Consume Balance

**Setup:** User has KES 120 in spin wallet (4 spins worth)

**Steps:**
1. Perform 3 spins of KES 30 each
2. Check final balance

**Expected:**
```
Initial: 12000 cents
After spin 1: 9000 cents
After spin 2: 6000 cents
After spin 3: 3000 cents
```

**Verify in Database:**
- `spinWallet.total_spins === 3`
- `spinWallet.total_used_cents === 9000`
- 3 SPIN_COST transactions created
- 3 SPIN_WIN transactions created (if all won)

---

## SQL Queries for Verification

### Check User's Spin Wallet Balance

```sql
db.spinwallets.findOne({ user_id: "USER_ID" })
```

Expected output shows `balance_cents: 3000` after KES 30 deposit.

### Check Company Revenue from Spins

```sql
db.transactions.aggregate([
  {
    $match: {
      type: 'SPIN_COST',
      target_type: 'company',
      status: 'completed'
    }
  },
  {
    $group: {
      _id: null,
      total_revenue: { $sum: '$amount_cents' },
      spin_count: { $sum: 1 }
    }
  }
])
```

Should show total revenue from actual spins only, NOT from deposits.

### Check Deposits Without Revenue

```sql
db.transactions.aggregate([
  {
    $match: {
      type: 'TRANSFER',
      target_type: 'spin_wallet',
      source: 'main_wallet_transfer'
    }
  },
  {
    $group: {
      _id: null,
      total_transfers: { $sum: '$amount_cents' },
      transfer_count: { $sum: 1 }
    }
  }
])
```

Should show total transferred amounts, but these are NOT company revenue.

---

## Common Issues & Fixes

### Issue: Balance Not Increasing After Deposit

**Likely Cause:**
- Callback not processing (check logs for `[CoopCallback]` messages)
- Wrong `deposit_type` in MpesaTransaction metadata

**Fix:**
1. Check `MpesaTransaction.metadata.deposit_type === 'spin_wallet'`
2. Verify callback endpoint is receiving POST data
3. Check for database session errors

### Issue: Company Receiving Revenue from Deposits

**Likely Cause:**
- SPIN_COST transaction being created in callback (should not happen)

**Fix:**
1. Verify callback does NOT contain this code:
   ```javascript
   await Transaction.create({ type: 'SPIN_COST', ... })
   ```
2. Ensure only performSpin() creates SPIN_COST transactions

### Issue: User Can Spin Without Balance

**Likely Cause:**
- Balance check is against wrong field (e.g., `spin_credits` instead of `balance_cents`)

**Fix:**
1. Verify performSpin() checks: `spinWallet.balance_cents >= SPIN_COST_CENTS`
2. Not using deprecated `spin_credits` field

---

## Summary of Fixes Applied

✅ **Callback (coop-bank/callback/route.ts):**
- Changed from recording SPIN_COST to crediting `balance_cents`
- Removed immediate company revenue on deposit
- Updated logging to show balance increase

✅ **performSpin (app/actions/spin.ts):**
- Added balance check against `balance_cents`
- Added SPIN_COST transaction creation when spin completes
- Company now only gets revenue when spin actually happens

✅ **transferMainToSpinWallet (app/actions/spin-wallet.ts):**
- Changed from recording SPIN_COST to recording TRANSFER
- Now properly transfers to `balance_cents`
- Company revenue only on actual spins

✅ **Comments & Documentation:**
- Updated misleading comments in spin-wallet.ts
- Clarified accounting model throughout codebase
- Added proper metadata to transactions

---

## Conclusion

The spin wallet system now correctly implements the required accounting:
1. Deposits increase user balance (not company revenue)
2. Transfers increase user balance (not company revenue)
3. **Only actual spins record company revenue**
4. All accounting is properly tracked in Transactions collection

This ensures users are never double-charged and company revenue accurately reflects actual business activity.
