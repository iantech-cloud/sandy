# Authentication & Payment Issues Audit Report

## Executive Summary
This report documents critical issues preventing users from successfully activating accounts and logging in after payment. The issues span across registration, activation, and session management layers.

---

## CRITICAL ISSUES FOUND

### 1. ❌ CRITICAL: User Status Logic Flaw in JWT Callback
**Location:** `auth.ts` - jwt callback, session callback

**Problem:**
```javascript
// Current logic in auth.ts - WRONG!
is_verified: profile.is_verified ?? false,
is_active: profile.is_active ?? false,
is_approved: profile.is_approved ?? false,
approval_status: profile.approval_status || 'pending',
rank: profile.rank || 'Unactivated',
```

Users after activation have:
- `is_active: true`
- `is_approved: true`
- `approval_status: "approved"`
- `rank: "Bronze"`

BUT the JWT/session callback is NOT being refreshed after activation payment completes. The JWT token still contains OLD values from initial login.

**Impact:**
- Users pay and get activated in DB
- But their session still shows `is_active: false`
- Dashboard shows "Not activated" even though they're activated
- They can't access dashboard routes that check `session.user.is_active`

**Root Cause:**
The JWT callback only updates on fresh signIn (trigger === 'signIn'). If a user logs in, the JWT is created with `is_active: false`. Even when they complete activation payment, the token isn't refreshed unless they manually log out and back in.

**Solution:**
Need to trigger a session refresh after activation payment completes.

---

### 2. ❌ CRITICAL: No Session Refresh After Activation Payment
**Location:** `app/actions/activation.ts` - completeActivationAfterPayment()

**Problem:**
The `completeActivationAfterPayment()` function updates the database correctly:
```javascript
userProfile.is_active = true;
userProfile.approval_status = 'approved';
userProfile.is_approved = true;
userProfile.rank = 'Bronze';
await userProfile.save();
```

BUT it does NOT refresh the user's session. The JWT token in NextAuth still has the old values.

**Impact:**
- User completes activation payment
- Database is updated correctly
- But user's session is stale
- User sees "Account not activated" messages
- Protected routes redirect them away

**Solution:**
Use `revalidateTag('user-profile')` or similar caching strategy, and implement a session refresh endpoint.

---

### 3. ❌ CRITICAL: Dashboard Route Protection Not Checking Session
**Location:** Various pages using middleware

**Problem:**
Middleware and protected pages might not be checking the CURRENT session state. They're checking cached/stale session values.

**Solution:**
Need to ensure every protected route/component validates session freshness.

---

### 4. ❌ HIGH: Missing Email Verification for New Registrations
**Location:** `app/api/auth/register/route.ts`

**Problem:**
Registration route creates users with `is_verified: false` but there's no email verification flow required:
```javascript
const newProfileData = {
  // ...
  is_verified: false,  // ← Set to false
};
```

But the activation page doesn't require email verification before payment. Users might not receive verification emails or skip them.

**Impact:**
- User registers → `is_verified: false`
- They proceed directly to activation
- Email might never be verified
- Inconsistent user state in DB

**Solution:**
Either:
1. Require email verification BEFORE allowing activation payment, OR
2. Auto-mark as verified immediately upon registration, OR
3. Verify email AFTER successful payment activation

---

### 5. ❌ HIGH: Multiple Profile Schemas/Fields Mismatch
**Location:** `app/lib/models.ts` vs `app/lib/models/Profile.ts`

**Problem:**
There are TWO different Profile schema definitions:

**File 1:** `app/lib/models.ts` (149+ lines)
- Has extensive fields: antiPhishingCode, twoFASecret, etc.

**File 2:** `app/lib/models/Profile.ts` (100+ lines)
- Different field definitions
- Different validations
- Different defaults

Which one is actually being used?

**Impact:**
- Inconsistent schema expectations
- Queries might use wrong fields
- Data doesn't save/load correctly
- Activation logic might read from wrong fields

**Solution:**
Consolidate to single Profile schema definition.

---

### 6. ❌ HIGH: JWT Token Not Updated After User Activation
**Location:** `auth.ts` - session callback

**Problem:**
The session callback builds session from token:
```javascript
async session({ session, token }) {
  if (!token || !token.userId) {
    return session;
  }
  
  // Copies token values - but token might be stale!
  session.user.is_active = token.is_active as boolean ?? false;
  session.user.is_approved = token.is_approved as boolean ?? false;
  // ...
}
```

When user completes activation payment, the JWT token still has OLD values. The session callback just copies stale data.

**Solution:**
Implement session refresh mechanism that invalidates/updates JWT after activation.

---

### 7. ❌ MEDIUM: No Session Refresh Endpoint
**Location:** Missing API endpoint

**Problem:**
There's no `/api/auth/refresh-session` endpoint that users can call after activation to update their session.

**Solution:**
Create endpoint that:
1. Reads current user profile from DB
2. Updates JWT token with fresh data
3. Returns updated session

---

### 8. ❌ MEDIUM: Activation Payment Callback Uses Cache that Isn't Invalidated
**Location:** `app/api/payments/coop-bank/callback/route.ts`

**Problem:**
After calling `completeActivationAfterPayment()`, the callback route doesn't revalidate user's session cache:
```javascript
// Line 306 in callback
await completeActivationAfterPayment(updated._id.toString());

// But no revalidation of user session
```

**Solution:**
Add revalidation:
```javascript
revalidatePath('/dashboard');
// More importantly:
await invalidateUserSession(userId);
```

---

### 9. ❌ MEDIUM: Activation Check Logic Uses Wrong Fields
**Location:** `app/actions/activation.ts` - checkActivationStatus()

**Problem:**
```javascript
const isActivationPaid = userProfile.approval_status !== 'pending' || userProfile.rank !== 'Unactivated';
```

This uses OR logic, which means if EITHER field indicates activation, it returns true. But after payment, both should be updated.

Correct logic should be AND:
```javascript
const isActivationPaid = userProfile.approval_status === 'approved' && userProfile.rank !== 'Unactivated';
```

**Impact:**
- Incorrect activation status detection
- Users might be told they're activated when they're not
- Or vice versa

---

### 10. ❌ MEDIUM: Login Redirect Not Based on Activation Status
**Location:** `app/auth/login/LoginContent.tsx`

**Problem:**
After successful login, doesn't check if user is activated. Should redirect to activation page if not activated.

**Solution:**
After login success, check:
```javascript
if (!session.user.is_active) {
  router.push('/auth/activate');
}
```

---

### 11. ❌ MEDIUM: Middleware Not Enforcing Activation Status
**Location:** `middleware.ts`

**Problem:**
Need to verify middleware is checking `session.user.is_active` correctly.

**Solution:**
Add explicit checks for activation status in middleware.

---

## SUMMARY OF PAYMENT FLOW ISSUES

### Current Broken Flow:
1. User registers ✅ (Works)
2. User logs in ✅ (Works)
3. User initiates activation payment ✅ (Works)
4. Payment callback succeeds ✅ (Database updated correctly)
5. User is redirected to dashboard ❌ (BUT session shows not activated)
6. User sees "Account not activated" message ❌
7. User clicks "Activate" again ❌ (Already activated in DB, shows "Account is already activated")
8. User is stuck in limbo ❌

### Why This Happens:
The JWT token was created at login with `is_active: false`. When payment completes, the database is updated but the JWT token is NOT invalidated or refreshed. NextAuth keeps serving the stale token.

---

## RECOMMENDED FIXES (Priority Order)

### Priority 1: Session Refresh After Activation
**File:** `app/actions/activation.ts`
```typescript
// After userProfile.save() in completeActivationAfterPayment():
// Option A: Invalidate session cache
revalidateTag(`user-${userProfile._id}`);

// Option B: Better - create session refresh action
await invalidateUserSession(userProfile._id.toString());
```

### Priority 2: Create Session Refresh Endpoint
**File:** Create `app/api/auth/refresh-session/route.ts`
```typescript
export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Re-fetch user from DB
  const profile = await Profile.findById(session.user.id);
  
  // Update JWT by calling jwt callback with 'update' trigger
  // This invalidates old token and creates new one
  
  return NextResponse.json({ success: true });
}
```

### Priority 3: Call Refresh After Activation in Frontend
**File:** `app/auth/activate/mpesa-waiting/MpesaWaitingContent.tsx`
```typescript
// After payment succeeds, call:
await fetch('/api/auth/refresh-session', { method: 'POST' });
await router.push('/dashboard');
```

### Priority 4: Fix Activation Status Check Logic
**File:** `app/actions/activation.ts` - checkActivationStatus()
```typescript
// Change from OR to AND
const isActivationPaid = 
  userProfile.approval_status === 'approved' && 
  userProfile.rank !== 'Unactivated';
```

### Priority 5: Consolidate Profile Schema
**Action:** Delete `app/lib/models/Profile.ts` and use only `app/lib/models.ts`

### Priority 6: Add Email Verification Requirement
**File:** `app/actions/auth.ts` - registerUser()
Decide: Verify before activation or after activation?

---

## TESTING CHECKLIST

After fixes:
- [ ] User registers
- [ ] User logs in (should have `is_active: false`)
- [ ] User initiates activation payment
- [ ] Payment callback triggers
- [ ] `completeActivationAfterPayment()` runs
- [ ] Session refresh endpoint is called
- [ ] Check session: `is_active` should be `true`
- [ ] Redirect to `/dashboard` works
- [ ] Dashboard shows "Activated" status
- [ ] Second login shows `is_active: true` from start

---

## DATABASE CONSISTENCY CHECK

Run these queries to verify:

```javascript
// Find users who are activated in DB but show not activated to frontend
db.profiles.find({
  is_active: true,
  is_approved: true,
  approval_status: 'approved',
  rank: { $ne: 'Unactivated' }
})

// These users are stuck - they're activated in DB but their sessions are stale
```

---

## NEXT STEPS

1. Implement Priority 1-3 fixes immediately
2. Deploy and test with test accounts
3. Implement Priority 4-6 for stability
4. Monitor user feedback
5. Consider forcing re-login for affected users

