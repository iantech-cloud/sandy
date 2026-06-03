# Payment Timeout and Recovery Fix

## Overview
Fixed critical issues preventing payments from completing:
- API requests timing out without response (500 errors)
- Token cache not invalidated on errors (retry fails)
- Pending transactions blocking new payment attempts indefinitely
- NaN values in database causing MongoDB casting errors

---

## Issues Resolved

### 1. HTTP 500 Timeout Errors from Co-op Bank API
**Problem:**
- Token requests and STK Push requests had no timeout
- Requests could hang indefinitely
- ngrok tunnel or API infrastructure issues → frozen requests

**Symptoms:**
```
[v0] Token request failed: { status: 500, error: '...' }
Co-op Bank token request failed (500): ...
```

**Fix:**
- Added 60-second AbortController timeout to all fetch requests
- Token endpoint: POST /token (60s timeout)
- STK Push endpoint: POST /FT/stk/1.0.0 (60s timeout)
- Prevents hanging and allows retry mechanism

### 2. Token Cache Persists After Error
**Problem:**
- Token request fails → cache is NOT cleared
- "Try again" button → still tries to use old/invalid token
- Cascading failures: Token error → STK Push error → User sees failure

**Symptoms:**
- First attempt: Token request fails
- Click "Try again": Still uses old cache → Still fails
- Root cause: Cache not invalidated on error

**Fix:**
```typescript
// OLD: Cache never cleared on error
// NEW: Clear cache on ANY error
try {
  const response = await fetch(this.tokenUrl, { ... });
  // ... handle response
} catch (error) {
  this.tokenCache = null;  // Clear on error
  throw error;
}
```

### 3. "You Have a Pending Transaction" Blocking
**Problem:**
- Spin wallet: Transaction stuck as 'pending' indefinitely
- User clicks "Try again" → "You have a pending transaction" forever
- Old transactions never cleaned up

**Symptoms:**
- User initiates payment
- No M-Pesa prompt (API timeout)
- Tries again → "You have a pending M-Pesa transaction" error
- Can't proceed for hours/days

**Fix:**
- Spin wallet: Only block pending transactions < 5 minutes old
- Deposit: Only block pending transactions < 3 minutes old
- Auto-cleanup: Mark old pending transactions as 'timeout'
- New attempt after timeout window can proceed

```typescript
// Only block RECENT pending (within 5 min)
const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
const recentPending = await MpesaTransaction.findOne({
  status: { $in: ['initiated', 'pending'] },
  created_at: { $gt: fiveMinutesAgo },  // Only recent ones
});

// Auto-cleanup old pending transactions
await MpesaTransaction.updateMany(
  { status: { $in: ['initiated', 'pending'] }, created_at: { $lt: fiveMinutesAgo } },
  { status: 'timeout', result_desc: 'Timed out after 5 minutes' }
);
```

### 4. NaN Error in result_code
**Problem:**
- Status check returns ResponseCode = undefined
- parseInt(undefined || '1', 10) → parseInt('1', 10) → Correct
- But sometimes gets NaN value
- MongoDB casting error: "Cast to Number failed for value NaN"

**Symptoms:**
```
CastError: Cast to Number failed for value "NaN" at path "result_code"
```

**Fix:**
```typescript
// Safe parse with NaN check
const resultCode = parseInt(statusResponse.ResponseCode || '1', 10);
const safeResultCode = isNaN(resultCode) ? 1 : resultCode;

await MpesaTransaction.findByIdAndUpdate(id, {
  result_code: safeResultCode,  // Safe value
  ...
});
```

---

## Complete Flow After Fix

### Scenario: Token Request Fails → User Retries

**Attempt 1:**
1. User clicks "Activate Account"
2. Token request → API timeout (after 60s)
3. Cache cleared automatically
4. Error: "Failed to initiate payment"
5. User sees: "Try again" button

**Attempt 2 (Click "Try again"):**
1. Service checks cache → Empty (cleared from error)
2. Token request → NEW attempt (not using old cache)
3. Token succeeds → STK Push initiated
4. Phone receives M-Pesa prompt
5. User enters PIN → Payment succeeds

### Scenario: User Abandons Payment → Retries After 5 Minutes

**Initial Attempt (5:00 PM):**
1. User initiates spin wallet payment
2. No M-Pesa prompt (API issue or user closes app)
3. Transaction marked: status='pending', created_at=5:00 PM

**Retry at 5:02 PM (2 minutes later):**
- "You have a pending transaction" (within 5-min window)
- Button disabled → Wait for 3 more minutes

**Retry at 5:06 PM (6 minutes later):**
- Old transaction auto-cleaned: status='timeout'
- New payment attempt succeeds
- Fresh transaction created

---

## Environment Changes
None - all fixes are code-level, no env var changes needed.

## Database Changes
No schema changes. Only status values change:
- `pending` → `timeout` (for old transactions > timeout window)

## Testing Checklist

### Token Timeout Testing
```bash
# 1. Test timeout enforcement
node scripts/test-coop-token.js
# Should timeout after 60 seconds if server unresponsive

# 2. Test retry after timeout
# First attempt: Timeout error
# Second attempt: New token request (not cached)
```

### Pending Transaction Cleanup
```bash
# Check spin wallet (5-min window)
db.mpesatransactions.find({ 
  status: { $in: ['initiated', 'pending'] },
  created_at: { $lt: new Date(Date.now() - 5*60*1000) }
})
# Should return 0 (auto-cleaned)

# Check deposit (3-min window)
db.mpesatransactions.find({ 
  status: { $in: ['initiated', 'pending'] },
  source: 'wallet',
  created_at: { $lt: new Date(Date.now() - 3*60*1000) }
})
# Should return 0 (auto-cleaned)
```

### Full Payment Flow
1. ✅ Activation: Click activate → Shows processing → Auto-activates
2. ✅ Deposit: Initiate → Shows processing → Wallet updates on payment
3. ✅ Spin: Pay KES 30 → Shows processing → Spin credits added

---

## Console Logs to Monitor

### Token Generation
```
[v0] Co-op Bank Token Request:
[v0]   Token URL: https://openapi.co-opbank.co.ke/token
[v0]   Using Bearer Token auth with Authorization header
[v0]   Timeout: 60 seconds
[v0] Token obtained successfully, expires in: 3600 seconds
```

### Cache Usage
```
[v0] Using cached token, expires in: 1234 seconds
```

### Error Handling
```
[v0] Token request error: Timeout or error message
[v0] Token request error cleared cache - retry will attempt fresh token
```

### Transaction Cleanup
```
[Deposit] Cleaning up 2 stale pending transactions for user 123
[Spin] Cleaning up 1 stale pending transactions for user 456
```

---

## Architecture Summary

```
User Action
    ↓
initiatePayment()
    ↓
getAccessToken()
    ├─ Check cache (valid?)
    ├─ Yes → Return token
    └─ No → Fetch new
        ├─ Timeout 60sec
        └─ Error → Clear cache
    ↓
initiateSTKPush()
    ├─ Timeout 60sec
    └─ Error → Return error
    ↓
Client polls status every 4 seconds
    ↓
checkStatus()
    ├─ Valid? Return
    ├─ Terminal? Return
    └─ Pending? Keep polling
    ↓
Payment completes or times out
    └─ Auto-cleanup of stale pending
```

---

## Files Modified
1. `app/lib/services/coop-bank.ts` - Added timeout + cache clearing
2. `app/actions/activation.ts` - Safe result_code parsing
3. `app/actions/deposit.ts` - Safe parsing + stale cleanup
4. `app/actions/spin.ts` - Stale cleanup

---

## Deployment Notes
- No breaking changes
- No new environment variables
- No database migrations needed
- Backward compatible with existing transactions
- Safe to deploy immediately

---

## Future Improvements
1. Add exponential backoff to token request retries
2. Add circuit breaker pattern for API failures
3. Add metrics tracking for timeout occurrences
4. Implement token refresh preemptively (not on demand)
5. Add dead letter queue for transactions in error state
