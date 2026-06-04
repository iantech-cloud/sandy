# Transaction Mapping & Error Message Fixes

## Problem Summary

### Issue 1: Spin Wallet Balance Updated for Failed Transactions
When a transaction failed (e.g., wrong PIN), the spin wallet was setting `balance_updated: true`, preventing the transaction from being properly marked as failed.

**Log Before Fix:**
```
MessageCode: "2001" (Invalid/No Response)
mappedStatus: "timeout"
balance_updated: true ← WRONG!
```

**Impact:** Failed transactions looked like they were processed, causing confusion about payment status.

### Issue 2: Poor Error Messages for Users
Generic messages like "Payment status: timeout" instead of specific, helpful messages.

**Examples:**
- Wrong PIN → Should show: "No response from M-Pesa. Check your history."
- User cancelled → Should show: "You cancelled the M-Pesa prompt."
- Still processing → Should show: "Still being processed. Please wait..."

## Solutions Implemented

### 1. Fixed Spin Wallet Balance Update Logic

**File:** `app/actions/spin.ts`

**Change:** Only set `balance_updated = true` for `completed` status

```typescript
// BEFORE (WRONG)
if (['failed', 'cancelled', 'timeout'].includes(status)) {
  updateData.balance_updated = true; // ← Sets it for failures
}

// AFTER (CORRECT)
if (status === 'completed') {
  updateData.balance_updated = true; // ← Only for success
}

// Failures and pending - balance_updated left false/unchanged
if (['failed', 'cancelled', 'timeout'].includes(status)) {
  // Do NOT set balance_updated
}
```

### 2. Added User-Friendly Error Messages

**Files:**
- `app/actions/activation.ts`
- `app/actions/deposit.ts`
- `app/actions/spin.ts`

**New Message Logic:**
```typescript
function getStatusUserMessage(status: string, responseDescription?: string): string {
  switch (status) {
    case 'completed':
      return 'Payment successful! Credits added.';
    case 'failed':
      return `Payment failed: ${responseDescription || 'Try again'}`;
    case 'timeout':
      return 'No response from M-Pesa. Check your history.';
    case 'cancelled':
      return 'You cancelled the M-Pesa prompt.';
    case 'pending':
      return 'Still being processed. Please wait...';
  }
}
```

## Response Code Mapping

| Code | Maps To | balance_updated | Message |
|------|---------|-----------------|---------|
| `'0'` | `completed` | ✅ TRUE | Success |
| `'2001'` | `timeout` | ❌ FALSE | No M-Pesa response |
| `'2002'` | `cancelled` | ❌ FALSE | User cancelled |
| `'1037'` | `timeout` | ❌ FALSE | No response from user |
| `'S_001'` | `pending` | ❌ FALSE | Still processing |
| `'1'` | `pending` | ❌ FALSE | Still processing |
| Other | `failed` | ❌ FALSE | Error |

## Example Scenarios

### Scenario 1: User Enters Wrong PIN
```
1. Co-op Bank returns:
   MessageCode: "2001"
   MessageDescription: "The initiator information is invalid."

2. System maps to:
   status: "timeout"
   balance_updated: false ← Correct!

3. User sees:
   "No response from M-Pesa. Check your history."
```

### Scenario 2: User Cancels STK
```
1. Co-op Bank returns:
   MessageCode: "2002"
   MessageDescription: "User cancelled"

2. System maps to:
   status: "cancelled"
   balance_updated: false ← Correct!

3. User sees:
   "You cancelled the M-Pesa prompt."
```

### Scenario 3: Payment Succeeds
```
1. Co-op Bank returns:
   MessageCode: "0"
   MessageDescription: "SUCCESS"

2. System maps to:
   status: "completed"
   balance_updated: true ← Correct!

3. User sees:
   "Payment successful! Your spin credits have been added."
```

### Scenario 4: Still Processing
```
1. Co-op Bank returns:
   MessageCode: "S_001"
   MessageDescription: "PROCESSING"

2. System maps to:
   status: "pending"
   balance_updated: false ← Correct!

3. User sees:
   "Payment is still being processed. Please wait..."
```

## Files Modified

### 1. app/actions/spin.ts
- Fixed `syncSpinDepositTransactionWithMpesaStatus()` to NOT set `balance_updated` for failed states
- Added user-friendly error messages in return response
- Added logging for failed transaction states

### 2. app/actions/activation.ts
- Improved error messages with specific status text
- Clear differentiation between different failure modes
- Better success confirmation message

### 3. app/actions/deposit.ts
- Added `getDepositUserMessage()` helper function
- Consistent error messaging across all three wallets
- Clear communication of payment status to users

## Database Impact

### Transaction Record (balance_updated field)
- **Before Fix:** Set to TRUE for both success AND failures
- **After Fix:** Set to TRUE only for completed transactions

### MpesaTransaction Record (status field)
- **Before Fix:** Different wallets mapped codes differently
- **After Fix:** All use `CoopBankService.mapResponseCode()` consistently

### SpinWallet Record
- **Before Fix:** balance_updated prevented proper status tracking
- **After Fix:** Transactions properly marked as succeeded/failed

## Testing Checklist

### Activation Wallet
- [ ] Wrong PIN → Shows "No response from M-Pesa"
- [ ] User cancels → Shows "You cancelled"
- [ ] Success → Shows "Payment successful!"
- [ ] Still processing → Shows "Still being processed"

### Deposit Wallet
- [ ] Wrong PIN → Shows proper error
- [ ] Success → Shows "Wallet has been credited"
- [ ] Timeout → Shows helpful message

### Spin Wallet
- [ ] Wrong PIN → Shows "No response from M-Pesa"
- [ ] User cancels → Shows "You cancelled"
- [ ] Success → Shows "Spin credits have been added"
- [ ] balance_updated ONLY set for completed
- [ ] Failed transactions NOT processed for balance

## Console Logs to Monitor

### Successful Processing
```
[v0] Token obtained successfully (expires in 3600s)
[v0] STK Push Request Details: ...
[v0] STK Status Result: {"MessageCode":"0",...}
🔄 Successfully synced spin deposit transaction status to: completed
```

### Failed Transaction (Wrong PIN)
```
[v0] STK Status Result: {"MessageCode":"2001","MessageDescription":"The initiator information is invalid."}
[v0] Terminal error code: 2001 - stopping polling
[SpinWallet] TIMEOUT transaction - balance_updated NOT set
```

### Pending Status
```
[v0] STK Status Result: {"MessageCode":"S_001","MessageDescription":"PROCESSING"...}
[v0] Intermediate S_* code: S_001 - continuing to poll
[SpinWallet] Transaction still PROCESSING - NOT marking balance_updated yet
```

## Deployment Notes

✅ No database schema changes
✅ No migration required
✅ Backward compatible
✅ Immediate fix - no gradual rollout needed
✅ All three wallets now have consistent behavior

## Future Improvements

1. Add SMS notification when payment fails
2. Provide direct link to M-Pesa history for failed transactions
3. Add retry button for timeout scenarios
4. Send confirmation SMS on success

