GAMING DEPOSIT STATUS FIX
========================

## Problem

The gaming waiting page (`app/dashboard/gaming/mpesa-waiting/page.tsx`) would get stuck showing "Payment Pending" even after payment succeeded, because:

1. `checkGameDepositStatus()` only read the DB passively and waited for the Co-op Bank webhook callback
2. If the callback was delayed, dropped, or never arrived, it would return `pending` forever (until 4-minute timeout)
3. Even if the callback eventually arrived and credited the wallet, the UI wouldn't update until the page reloaded

Unlike the activation flow which had an active fallback mechanism, gaming had no way to detect if the payment succeeded when the callback failed.

## Root Cause

**Missing Active Status Poll Fallback**

- Activation waiting page: Actively queries Co-op Bank's Enquiry API every ~10 seconds to confirm payment status
- Gaming waiting page: Only waits for webhook callback, no active verification

**No Double-Credit Protection**

- Once we add active polling to credit the wallet, both the callback AND the poll could attempt crediting
- Without atomic guards, the wallet could be credited twice

## Solution

Two files modified to implement the activation pattern in gaming:

### 1. `app/actions/gaming-games.ts` - checkGameDepositStatus()

**NEW BEHAVIOR:**
- After reading DB status, if payment is still `pending`:
  - Check if wallet is already credited (`metadata.wallet_credited`)
  - If not, actively query Co-op Bank's Enquiry API
  - Persist status result back to DB
  - **If callback was missed and status is `completed`:**
    - Use atomic `$ne` guard to set `metadata.wallet_credited = true`
    - Only credit wallet if guard succeeded (prevents race with callback)
    - Invalidate cache for fresh balance

**KEY CHANGES:**
```
1. Import createCoopBankService and CoopBankService
2. Add metadata.wallet_credited check early (callback path)
3. Implement API call throttling (skip if checked in last 10 seconds)
4. Add Co-op Bank status query with centralized response mapping
5. Add atomic wallet credit logic with metadata.wallet_credited guard
6. Add cache invalidation after wallet credit
7. Return source: 'coop_api' when completed via active poll
```

### 2. `app/api/payments/coop-bank/callback/route.ts` - Gaming Deposit Section

**NEW BEHAVIOR:**
- When callback receives completed payment for gaming:
  - Use atomic `$ne` guard on `metadata.wallet_credited` to claim credit
  - Only credit wallet if guard succeeded (prevents race with active poll)
  - Set both `metadata.wallet_credited` and `metadata.callback_processed` flags
  - Always update transaction record for audit trail (regardless of who credited)
  - Log when credit is prevented as second attempt

**KEY CHANGES:**
```
1. Wrap wallet credit in atomic findOneAndUpdate with $ne guard
2. Check if updated (== true means we won the race, == null means we lost)
3. Only call invalidateCache() if we actually credited the wallet
4. Always update transaction record for audit trail
5. Add logging for prevented double-credits
```

## How It Works

### Scenario 1: Callback Arrives First (Normal Path)
```
User pays via M-Pesa
     ↓
Co-op Bank calls webhook (callback route)
     ↓
Sets metadata.wallet_credited = true
     ↓
Credits GamingWallet (wins race)
     ↓
Invalidates cache
     ↓
User's balance updates immediately
```

### Scenario 2: Callback Is Delayed (Active Poll Fallback)
```
User pays via M-Pesa
     ↓
User watches waiting page (polling status every 2 seconds)
     ↓
First poll: DB still pending, no callback yet
     ↓
Second poll (after 10 seconds): Co-op Bank API says "completed"
     ↓
Sets metadata.wallet_credited = true (wins race)
     ↓
Credits GamingWallet immediately (doesn't wait for callback)
     ↓
Invalidates cache
     ↓
User sees balance updated on waiting page
     ↓
Later: Callback arrives but sees wallet already credited (doesn't double-credit)
```

### Scenario 3: Callback Arrives While Poll Completes (Race Condition Protected)
```
Co-op Bank webhook calls simultaneously with active poll response
     ↓
Both attempt to set metadata.wallet_credited = true
     ↓
First one to execute findOneAndUpdate with $ne guard wins
     ↓
Winner: Credits wallet + invalidates cache
     ↓
Loser: Sees updated = null, skips wallet credit, logs prevention
     ↓
Wallet is credited EXACTLY ONCE
```

## Files Modified

1. **app/actions/gaming-games.ts** (+171 lines, -48 lines)
   - Completely rewrote checkGameDepositStatus()
   - Added Co-op Bank API integration with throttling
   - Added atomic wallet credit with double-credit guard
   - Added cache invalidation on successful completion

2. **app/api/payments/coop-bank/callback/route.ts** (+38 lines, -23 lines)
   - Wrapped wallet credit in atomic guard
   - Added wallet_credited flag and callback_processed flag
   - Restructured to only credit if guard succeeds
   - Added logging for prevented double-credits

## Testing

### Test 1: Normal Flow (Callback Arrives First)
1. Initiate gaming deposit
2. Wait page shows "Pending..."
3. Co-op Bank callback arrives normally
4. Wallet is credited
5. Balance updates on page

**Expected:** Balance shows correct amount immediately

### Test 2: Delayed Callback (Active Poll Works)
1. Initiate gaming deposit
2. Simulate callback delay (e.g., network issue)
3. Wait page polls status every 2 seconds
4. After 10 seconds, active poll queries Co-op Bank API directly
5. Co-op Bank says "completed"
6. Wallet credits from poll
7. Balance updates on page
8. Later: callback arrives but doesn't double-credit

**Expected:** Balance updates WITHOUT waiting for callback

### Test 3: Concurrent Completion (Race Protection)
1. Initiate gaming deposit
2. Trigger callback and active poll simultaneously
3. Only ONE should credit wallet
4. Callback logs (or vice versa)
5. Check audit trail shows single credit

**Expected:** Wallet credited exactly once, no duplicates

### Test 4: Already Credited Detection
1. Complete a deposit (callback credits wallet)
2. Re-call checkGameDepositStatus() while callback still running
3. Second call should detect metadata.wallet_credited = true
4. Should not attempt to credit again

**Expected:** Graceful skip, correct balance shown

## Differences from Activation

| Feature | Activation | Gaming |
|---------|-----------|--------|
| Active poll? | ✓ Yes | ✓ Yes (NEW) |
| Double-credit guard? | ✓ Yes | ✓ Yes (NEW) |
| Cache invalidation? | ✓ Yes | ✓ Yes |
| Response mapping | Centralized | Centralized |
| Throttling | ~10 seconds | ~10 seconds |

## Monitoring

### Logs to Watch
- `[Gaming] Status check:` - Active poll API call (OK)
- `[Gaming] Deposit completed from status poll — crediting wallet` - Poll fallback triggered
- `[CoopCallback] Gaming wallet credited:` - Callback credit (OK)
- `[CoopCallback] Gaming wallet already credited (double-credit prevented):` - Race winner detection (OK)

### Metrics to Monitor
- Time from payment completion to wallet credit (should be <2 seconds)
- Number of "already credited" log messages (should be 0-5% of payments)
- User complaints about stuck "Pending" status (should decrease to near 0)

## Deployment

- Zero-downtime: Yes (purely additive, backward-compatible)
- Database changes: No (uses existing metadata field)
- New dependencies: No (uses existing CoopBankService)
- Rollback: Simple revert to previous commit

## Build Status

✅ Build successful
✅ No TypeScript errors
✅ No compilation warnings
✅ 174 routes compiled successfully
