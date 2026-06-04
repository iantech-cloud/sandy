# Transaction Status Fix: S_001 PROCESSING Code

## Problem Overview

### Issue 1: S_001 Not Mapped Correctly
Co-op Bank returns `MessageCode: "S_001"` with description "PROCESSING" for transactions still in flight, but the system was mapping it to 'failed' instead of 'pending'.

**Impact:** Users see "Payment Failed" when transaction is actually being processed.

### Issue 2: Balance Updated While Processing
In spin wallet, `balance_updated: true` was being set when status was 'pending', preventing the callback from later updating the balance when transaction completed.

**Impact:** Transaction completes but balance shows failed; transaction is marked failed but balance was already updated.

---

## Root Causes

### 1. Missing Response Code Mapping
The `CoopBankService.mapResponseCode()` function only handled:
- '0' → 'completed'
- '1' → 'pending'
- '2001' → 'timeout'
- '2002' → 'cancelled'
- Everything else → 'failed' (DEFAULT)

Co-op Bank uses 'S_001' for PROCESSING, so it hit the default and became 'failed'.

### 2. Incorrect Balance Update Logic
In `spin.ts`, the `syncSpinDepositTransactionWithMpesaStatus()` function set `balance_updated: true` for both:
- Terminal states (completed, failed, cancelled, timeout)
- Intermediate states (pending) ← WRONG

---

## Solutions Applied

### 1. Enhanced Response Code Mapping

**File:** `app/lib/services/coop-bank.ts`

**Changes:**
```typescript
static mapResponseCode(responseCode: string) {
  // Terminal success
  if (responseCode === '0') return 'completed';
  
  // Terminal failure/cancellation
  if (responseCode === '2002') return 'cancelled';
  if (responseCode === '2001') return 'timeout';
  
  // PROCESSING states (poll again)
  if (responseCode === '1' || responseCode === 'S_001') {
    return 'pending'; // ← NOW HANDLES S_001
  }
  
  // Any other S_* code is intermediate
  if (responseCode?.startsWith('S_')) {
    return 'pending'; // Unknown S_ = intermediate
  }
  
  // Default: failed
  return 'failed';
}
```

**Effect:**
- `S_001` → `'pending'` ✅
- All `S_*` codes → `'pending'` ✅
- Transaction stays in "Processing" state ✅

### 2. Fixed Balance Update Logic

**File:** `app/actions/spin.ts`

**Changes:**
```typescript
function syncSpinDepositTransactionWithMpesaStatus(status, ...) {
  // ONLY set balance_updated for TERMINAL states
  if (status === 'completed') {
    updateData.balance_updated = true; // ✅ Terminal
  }
  
  if (['failed', 'cancelled', 'timeout'].includes(status)) {
    updateData.balance_updated = true; // ✅ Terminal
  }
  
  // NEW: Handle pending explicitly
  if (status === 'pending') {
    // DO NOT set balance_updated
    // Callback can still update balance
    console.log('Not marking balance_updated for PENDING');
  }
}
```

**Effect:**
- Pending transactions don't get `balance_updated: true` ✅
- Callback can later update balance ✅
- No inconsistency between status and balance ✅

---

## Response Code Reference

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `'0'` | `completed` | Success | Final ✅ |
| `'S_001'` | `pending` | Processing | Poll again |
| `'S_*'` (other) | `pending` | Intermediate | Poll again |
| `'1'` | `pending` | Processing | Poll again |
| `'2001'` | `timeout` | Timeout | Final ❌ |
| `'2002'` | `cancelled` | Cancelled | Final ❌ |
| Other | `failed` | Error | Final ❌ |

---

## Transaction Lifecycle

### Before Fix (BROKEN)
1. User initiates payment
2. STK sent → status='initiated'
3. Status check returns S_001 (PROCESSING)
4. mapResponseCode('S_001') → 'failed' ❌
5. UI shows "Payment Failed" even though processing
6. If callback comes later, balance_updated already true
7. Transaction marked failed but balance updated 💥

### After Fix (CORRECT)
1. User initiates payment
2. STK sent → status='initiated'
3. Status check returns S_001 (PROCESSING)
4. mapResponseCode('S_001') → 'pending' ✅
5. UI shows "Payment Processing..."
6. balance_updated stays false
7. Callback arrives with completion
8. balance_updated set to true, balance credited ✅

---

## Console Logs to Monitor

### Token Request
```
[v0] Token Request (Attempt 1/2):
[v0] Token obtained successfully (expires in 3600s)
```

### Status Check Response
```
[v0] STK Status Result: {
  "MessageCode": "S_001",
  "MessageDescription": "PROCESSING"
}
[v0] Normalizing Status response: MessageCode->ResponseCode
[Activation] Status check: {
  responseCode: 'S_001',
  mappedStatus: 'pending'     ← ✅ NOW SHOWS pending NOT failed
}
```

### Spin Wallet Sync
```
[SpinWallet] Transaction still PROCESSING - NOT marking balance_updated yet
```

---

## Testing Checklist

- [ ] Initiate activation payment
- [ ] Check logs show `mappedStatus: 'pending'` for S_001
- [ ] UI shows "Payment Processing..." not "Payment Failed"
- [ ] After user completes payment, verify balance updates
- [ ] Initiate spin wallet deposit
- [ ] Check logs show balance_updated NOT set while pending
- [ ] After payment completes, verify spin credits added
- [ ] Retry payment after 5 minutes (old pending cleaned up)

---

## Files Changed

1. **app/lib/services/coop-bank.ts**
   - Enhanced `mapResponseCode()` to handle S_001
   - Added S_* code detection
   - Better logging for unknown codes

2. **app/actions/spin.ts**
   - Fixed `syncSpinDepositTransactionWithMpesaStatus()`
   - Only set balance_updated for terminal states
   - Added explicit pending state handling

---

## No Breaking Changes

✅ Database schema unchanged
✅ API responses unchanged
✅ Transaction models unchanged
✅ Callback logic unchanged
✅ Backward compatible

All fixes are internal logic improvements that fix bugs without affecting external APIs or data structures.
