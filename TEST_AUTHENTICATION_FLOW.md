# Authentication Flow - Manual Testing Guide

## Pre-Test Checklist
- [ ] All code changes deployed
- [ ] Dev server running: `npm run dev`
- [ ] Access: http://localhost:5000
- [ ] Browser dev tools open (F12)
- [ ] Console tab ready to check for `[v0]` logs

---

## Test 1: New User Registration & Activation

### Step 1.1: Create Test Account
```
URL: http://localhost:5000/auth/sign-up
1. Fill in form:
   - Full Name: "Test User"
   - Email: "test_USER_[TIMESTAMP]@example.com" (make unique)
   - Phone: "0791234567"
   - Password: "TestPassword123!"
   - Referral: "SANDY001" (or valid referral code)

2. Submit form
   
3. ✅ EXPECT:
   - Success message
   - Redirected to /auth/login
   - Can see in console: "Registration successful"
```

### Step 1.2: Verify User Created in DB
```javascript
// In MongoDB console:
db.profiles.findOne({ email: "test_USER_[TIMESTAMP]@example.com" });

// Should return:
{
  _id: "...",
  email: "test_user_[timestamp]@example.com",
  username: "...",
  is_active: false,          // ✅ Should be false
  approval_status: "pending", // ✅ Should be pending
  rank: "Unactivated",        // ✅ Should be Unactivated
  status: "pending",
  is_verified: false,
  phone_number: "0791234567",
  activation_paid_at: null    // ✅ Should be null (not paid yet)
}
```

---

## Test 2: Login & Check Initial Session

### Step 2.1: Log In
```
URL: http://localhost:5000/auth/login
1. Enter:
   - Email: [your test email]
   - Password: "TestPassword123!"

2. Submit
   
3. ✅ EXPECT:
   - Redirected to /auth/activate (not logged in yet)
   - Session shows is_active: false
```

### Step 2.2: Check JWT Token
```javascript
// In browser console:
fetch('/api/auth/user')
  .then(r => r.json())
  .then(data => console.log('Session:', data));

// Should show:
{
  user: {
    id: "...",
    email: "test_user_[timestamp]@example.com",
    is_active: false,           // ✅ Correct - not yet activated
    approval_status: "pending",  // ✅ Correct
    rank: "Unactivated",         // ✅ Correct
    activation_paid_at: null
  }
}
```

---

## Test 3: Initiate Activation Payment

### Step 3.1: Start Payment Flow
```
URL: http://localhost:5000/auth/activate
1. Enter phone number: 0791234567
2. Click "Pay KES 95"
3. ✅ EXPECT:
   - Redirected to /auth/activate/mpesa-waiting?messageReference=...
   - M-Pesa prompt appears on phone
   - Console shows: "[v0] Activation polling attempt 1"
```

### Step 3.2: Check Payment Record in DB
```javascript
// In MongoDB console:
db.activation_payments.findOne({ status: 'pending' });

// Should show:
{
  _id: "...",
  user_id: "[user id]",
  amount_cents: 9500,  // ✅ KES 95
  status: "pending",   // ✅ Waiting for payment
  phone_number: "254791234567",
  checkout_request_id: "ACT...",
  created_at: ISODate("...")
}
```

---

## Test 4: Complete Payment Simulation

### Step 4.1: Manual Payment (Dev Only)
If you have a test M-Pesa account:
1. Confirm M-Pesa prompt on your phone
2. Enter PIN
3. Wait for confirmation

Otherwise, simulate payment:
```javascript
// In MongoDB console - SIMULATE SUCCESSFUL PAYMENT:
db.mpesa_transactions.updateOne(
  { checkout_request_id: "ACT..." },
  {
    $set: {
      status: 'completed',
      result_code: 0,
      result_desc: 'The service request has been processed successfully.',
      completed_at: new Date(),
      mpesa_receipt_number: 'TEST123456'
    }
  }
);
```

### Step 4.2: Watch Payment Waiting Page
```
Expected behavior:
1. Polling continues every 4 seconds
2. Console shows: "[v0] Activation polling attempt X"
3. When payment completes:
   - Status changes to "SUCCESS"
   - Console shows: "✅ Status mapped to success"
   - Page redirects to waiting screen
```

---

## Test 5: Account Activation & Session Refresh (KEY TEST ✅)

### Step 5.1: Trigger Activation
```
What happens automatically:
1. Payment callback received
2. completeActivationAfterPayment() runs
3. Database updated:
   - is_active: true
   - approval_status: "approved"
   - rank: "Bronze"
   - activation_paid_at: [now]

4. ✅ Session refresh called
5. Console shows: "[v0] Session refreshed successfully"
```

### Step 5.2: Verify DB Updated
```javascript
// In MongoDB console:
db.profiles.findOne({ email: "test_user_[timestamp]@example.com" });

// Should NOW show:
{
  _id: "...",
  is_active: true,            // ✅ CHANGED TO TRUE
  approval_status: "approved", // ✅ CHANGED TO APPROVED
  rank: "Bronze",              // ✅ CHANGED TO BRONZE
  activation_paid_at: ISODate("2024-..."), // ✅ NOW HAS DATE
  status: "active"
}
```

### Step 5.3: Check Session Updated
```javascript
// In browser console:
fetch('/api/auth/user')
  .then(r => r.json())
  .then(data => console.log('Updated Session:', data));

// Should NOW show:
{
  user: {
    id: "...",
    is_active: true,            // ✅ UPDATED!
    approval_status: "approved", // ✅ UPDATED!
    rank: "Bronze",              // ✅ UPDATED!
    isActivationPaid: true
  }
}
```

---

## Test 6: Dashboard Access

### Step 6.1: Navigate to Dashboard
```
URL: http://localhost:5000/dashboard

✅ EXPECT:
- Page loads successfully
- Shows "Welcome, [username]!"
- Status bar shows "Activated" (not "Pending Activation")
- All protected features accessible
- No "Activate Account" prompts
```

### Step 6.2: Check User Status Widget
```javascript
// Look for elements showing:
- Activation Status: "Active" ✅
- Rank: "Bronze" ✅
- Account Status: "Verified" ✅
```

---

## Test 7: Re-Login Test (Verify Persistence)

### Step 7.1: Log Out
```
1. Click user menu
2. Click "Logout"
3. Redirected to /auth/login
```

### Step 7.2: Log Back In
```
1. Enter email & password
2. Click "Login"

✅ EXPECT:
- Session immediately shows is_active: true
- NO redirect to /auth/activate
- Goes straight to /dashboard
- Shows "Activated" status
```

---

## Test 8: Session Refresh Endpoint (Direct Test)

### Step 8.1: Test Endpoint
```bash
# Make authenticated request to refresh endpoint
curl -X POST http://localhost:5000/api/auth/refresh-session \
  -H "Content-Type: application/json" \
  -b "sessionToken=..." # Include session cookie

# Response should be:
{
  "success": true,
  "message": "Session refreshed successfully",
  "session": {
    "user": {
      "id": "...",
      "email": "test_user_[timestamp]@example.com",
      "is_active": true,            # ✅ Fresh from DB
      "approval_status": "approved", # ✅ Fresh from DB
      "rank": "Bronze",              # ✅ Fresh from DB
      ...
    }
  }
}
```

---

## Test 9: Activation Status Check Logic

### Step 9.1: Test Edge Cases
```javascript
// In MongoDB console - Create test profiles with different statuses:

// Case 1: Activated
db.profiles.insertOne({
  email: "activated@test.com",
  is_active: true,
  approval_status: "approved",
  rank: "Bronze"
});

// Case 2: Not Activated
db.profiles.insertOne({
  email: "pending@test.com",
  is_active: false,
  approval_status: "pending",
  rank: "Unactivated"
});

// Case 3: Partial (shouldn't happen)
db.profiles.insertOne({
  email: "partial@test.com",
  is_active: true,
  approval_status: "pending",
  rank: "Unactivated"
});

// Case 4: Upgraded (valid)
db.profiles.insertOne({
  email: "upgraded@test.com",
  is_active: true,
  approval_status: "approved",
  rank: "Gold"
});
```

### Step 9.2: Verify Logic
```javascript
// Test the activation check function
// Should return:
// Case 1: isActivationPaid = true ✅
// Case 2: isActivationPaid = false ✅
// Case 3: isActivationPaid = false ✅
// Case 4: isActivationPaid = true ✅
```

---

## Console Log Checklist

### ✅ Expected Logs During Flow
```
[v0] Auth attempt for email: test_user_@example.com
[v0] Auth successful for user: test_user_@example.com
[v0] Processing activation for payment: ...
[v0] Fresh profile fetched: { ... is_active: true ... }
[v0] User profile updated: { is_active: true, approval_status: "approved", rank: "Bronze" }
[v0] Session refresh requested for user: ...
[v0] Session refreshed successfully: { id: "...", is_active: true, ... }
🎉 Activation completed successfully
```

### ❌ Errors to Watch For
```
❌ "[v0] Auth failed: User not found"
❌ "Auth failed: Invalid password"
❌ "Failed to update user profile"
❌ "Session refresh error"
❌ "Failed to complete activation"
```

---

## Database Verification Queries

Run these to verify everything worked:

```javascript
// 1. Count activated users
db.profiles.countDocuments({
  is_active: true,
  approval_status: "approved",
  activation_paid_at: { $exists: true }
});
// Should be > 0 ✅

// 2. Find your test user
db.profiles.findOne({ email: "test_user_[timestamp]@example.com" });
// Should show is_active: true ✅

// 3. Find activation payments
db.activation_payments.find({ status: "completed" }).limit(5);
// Should see recent payments ✅

// 4. Find activation transactions
db.transactions.find({
  type: "ACCOUNT_ACTIVATION",
  status: "completed"
}).limit(5);
// Should see recent activations ✅
```

---

## Success Criteria

Test is ✅ PASSED if:
- [ ] User registers successfully
- [ ] Session shows is_active: false after login
- [ ] Payment can be initiated
- [ ] Payment callback triggers
- [ ] Database is updated with is_active: true
- [ ] Session refresh is called
- [ ] Session shows is_active: true after activation
- [ ] Dashboard is accessible
- [ ] Status shows "Activated"
- [ ] Re-login doesn't require activation again
- [ ] All expected logs appear in console
- [ ] No errors in browser console
- [ ] No errors in server logs

---

## Troubleshooting

### Issue: "Session refresh failed"
```
1. Check /api/auth/refresh-session endpoint exists
2. Verify endpoint returns 200 OK
3. Check user ID is being passed correctly
4. Check database connection is active
```

### Issue: "Still shows not activated after payment"
```
1. Check database was actually updated
2. Verify session refresh was called
3. Try refreshing page (Ctrl+Shift+R)
4. Try clearing browser cookies
5. Check for errors in browser console
```

### Issue: "Payment never completes"
```
1. Check M-Pesa mock is working
2. Verify payment callback is being triggered
3. Check /api/payments/coop-bank/callback route exists
4. Monitor server logs for callback errors
```

---

## Notes
- All `[v0]` prefixed logs are for debugging these authentication issues
- Remove or reduce these logs before production deployment
- Keep database queries handy for quick verification
- Test both happy path and edge cases

