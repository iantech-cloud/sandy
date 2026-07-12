# Chronic Activation Bug - Root Cause & Fix

## Problem
Users were successfully paying for account activation but their accounts were NOT being activated. The payment would complete, but the user profile was never updated to reflect activation.

## Root Cause
The bug was in the activation logic check in `/app/actions/activation.ts` line 649:

### BEFORE (WRONG):
```typescript
const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';
```

This used **OR (`||`)** logic, which was incorrect because:
- If `approval_status === 'pending'` AND `rank === 'Unactivated'` → `false || false` = `false` (correct to proceed)
- If `approval_status === 'approved'` AND `rank === 'Unactivated'` → `true || false` = `true` (WRONG - returns early thinking account is activated)
- If `approval_status === 'pending'` AND `rank === 'Bronze'` → `false || true` = `true` (WRONG - returns early thinking account is activated)

The function would incorrectly think the account was already activated in cases where only ONE field had been updated, causing it to skip the rest of the activation logic.

### AFTER (CORRECT):
```typescript
const isActivationPaid = userProfile.approval_status === 'approved' && userProfile.rank !== 'Unactivated';
```

Now uses **AND (`&&`)** logic:
- If `approval_status === 'approved'` AND `rank !== 'Unactivated'` → BOTH must be true to skip
- Otherwise, activation proceeds normally and updates both fields

## Why It Wasn't Caught
1. The recovery job (`/api/payments/coop-bank/recover`) exists and DOES eventually catch and activate "paid-but-not-activated" accounts
2. However, the recovery job runs on a 5-minute schedule (or less often if not configured)
3. Between payment and recovery, users see their accounts as NOT activated, creating frustration
4. Some users might never trigger recovery if the `CRON_SECRET` is not configured, or if the recovery job is not running

## Where The Bug Was Fixed
1. **`/app/actions/activation.ts` line 649** - `completeActivationAfterPayment()` function - main logic
2. **`/app/actions/activation.ts` line 442** - `initiateActivationPayment()` function - duplicate prevention
3. **`/app/api/payments/coop-bank/callback/route.ts` line 327** - Enhanced logging for background activation

## Additional Improvements Made
- Added better logging in the callback to track when background activation fires
- Improved error handling to distinguish between activation failures and silently caught errors
- Added contextual logging to help diagnose similar issues in the future

## Testing
To verify the fix:
1. Make a payment with `approval_status === 'pending'` and `rank === 'Unactivated'`
2. Confirm payment succeeds
3. Verify that user profile is updated with `approval_status === 'approved'` AND `rank === 'Bronze'`
4. If background activation fails, the recovery job will catch it within 5 minutes

## Recovery Mechanism
If the background activation fails for any reason:
1. The recovery job queries for `status: 'completed'` and `processed_by_system: { $ne: true }`
2. It calls `completeActivationAfterPayment()` again (idempotent)
3. The account will be activated within the next scheduled recovery run (default: every 5 minutes)

**IMPORTANT**: Ensure `CRON_SECRET` is set in environment variables and the recovery endpoint is being called regularly to guarantee activation completes even if background processing fails.
