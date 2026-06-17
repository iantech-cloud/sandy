# Registration Update - Testing Checklist

## Critical Path Tests

### Test 1: Signup Form Display
- [ ] Navigate to /auth/sign-up
- [ ] Verify "Full Name" field is displayed (NOT "Username" field)
- [ ] Verify helper text says "We'll automatically create a unique username for you"
- [ ] Verify all other fields present: Email, Phone, Password, Confirm Password, Referral ID

### Test 2: Form Validation
- [ ] Full Name accepts "John Doe" ✓
- [ ] Full Name accepts "Mary-Jane O'Brien" ✓
- [ ] Full Name rejects numbers like "John123" ✗
- [ ] Full Name requires minimum 2 characters
- [ ] Phone validation works for: 0712345678, 712345678, 254712345678
- [ ] Email validation rejects invalid formats
- [ ] Password requires minimum 6 characters

### Test 3: Successful Registration
- [ ] Fill form with valid data
- [ ] Submit registration
- [ ] API generates username and returns it
- [ ] Success screen displays:
  - [ ] "Registration Successful!" heading
  - [ ] Generated username in "Your Account Details" section
  - [ ] Email address displayed
  - [ ] "Next Steps" section with login instructions
- [ ] Generated username follows pattern: lowercase, no spaces, alphanumeric

### Test 4: Duplicate Name Handling
- [ ] Register user 1: "John Doe" → gets "johndoe"
- [ ] Register user 2: "John Doe" → gets different variant ("john.doe" or similar)
- [ ] Verify both registrations succeed with unique usernames
- [ ] Both usernames are professional and memorable

### Test 5: Existing User Email/Phone
- [ ] Try to register with already-registered email
- [ ] Receive "Email already registered" error
- [ ] Try to register with already-registered phone
- [ ] Receive "Phone number already registered" error

### Test 6: Login with New Account
- [ ] Use registered email and password to login
- [ ] Login succeeds
- [ ] Dashboard loads correctly

### Test 7: Profile Page Display
- [ ] Navigate to /dashboard/profile
- [ ] Username is displayed in account details section
- [ ] Username field shows NO edit button or input box
- [ ] Username is read-only
- [ ] All other user info (email, phone, referral code) displays correctly

### Test 8: Settings Page - Profile Update
- [ ] Navigate to /dashboard/settings
- [ ] Find "Update Profile" section
- [ ] Verify NO username field is present
- [ ] Verify Name field is editable
- [ ] Verify Phone field is disabled (with explanation about M-Pesa)
- [ ] Click "Update Profile" button
- [ ] Modify name to "Jane Smith"
- [ ] Verify update succeeds and name changes
- [ ] Verify username STILL matches the auto-generated one (unchanged)

### Test 9: Username Immutability via API
- [ ] Open browser dev tools (Network tab)
- [ ] Make a request to /api/update-profile with username field in JSON
- [ ] Verify username field is ignored in the update
- [ ] Verify user's username remains unchanged
- [ ] API successfully updates other fields (name, bio, phone)

### Test 10: Settings - Other Functions
- [ ] Two-Factor Authentication section loads ✓
- [ ] Anti-Phishing Code section loads ✓
- [ ] M-Pesa Change Request section loads ✓
- [ ] Password Reset section loads ✓
- [ ] All sections function as before (no regression)

### Test 11: Referral Code
- [ ] Profile page shows referral code
- [ ] Referral code is displayed correctly
- [ ] "Copy Code" button works
- [ ] Copied feedback shows

### Test 12: Account Status Display
- [ ] Profile page shows account approval status
- [ ] Shows "Approved" or "Pending Approval" based on account state
- [ ] Status updates reflect correctly

## Edge Cases

### Edge Case 1: Names with Multiple Spaces
- [ ] Input: "John    Doe" (multiple spaces)
- [ ] Expected: Username generated correctly, handles spacing
- [ ] Result: [ ] Pass / [ ] Fail

### Edge Case 2: Single Letter Names
- [ ] Input: "A B"
- [ ] Expected: Generate username from these letters
- [ ] Result: [ ] Pass / [ ] Fail

### Edge Case 3: Very Long Names
- [ ] Input: "Christopher Alexander Montgomery III"
- [ ] Expected: Username generated successfully
- [ ] Result: [ ] Pass / [ ] Fail

### Edge Case 4: Unicode or Accented Characters (if supported)
- [ ] Input: "José María"
- [ ] Expected: Either accepted or rejected consistently
- [ ] Result: [ ] Pass / [ ] Fail

## Data Integrity Tests

### Data Test 1: Existing Users Unaffected
- [ ] Query database for existing users
- [ ] Verify their usernames unchanged
- [ ] Verify their profile data intact

### Data Test 2: New Users Have Unique Usernames
- [ ] Register 5 new users
- [ ] Query database
- [ ] Verify all 5 have unique usernames
- [ ] Verify all follow lowercase pattern

### Data Test 3: Password Hashing
- [ ] Register new user with password "TestPassword123"
- [ ] Verify stored password is hashed (NOT plaintext)
- [ ] Login works with correct password
- [ ] Login fails with incorrect password

## Performance Tests

### Performance Test 1: Registration Speed
- [ ] Register 10 users sequentially
- [ ] Each registration completes within 2 seconds
- [ ] No timeout errors
- [ ] All usernames generated correctly

### Performance Test 2: Duplicate Check Performance
- [ ] Register user with common name that already exists
- [ ] Alternative username generated within 500ms
- [ ] No database timeouts
- [ ] Request completes successfully

## Browser Compatibility

- [ ] Works on Chrome/Chromium
- [ ] Works on Firefox
- [ ] Works on Safari
- [ ] Works on Mobile Safari (iOS)
- [ ] Works on Mobile Chrome (Android)

## Accessibility Tests

- [ ] Form labels are properly associated with inputs
- [ ] Required fields marked with asterisk (*)
- [ ] Error messages are announced to screen readers
- [ ] Tab order is logical
- [ ] Keyboard navigation works (Tab, Enter)

## Regression Tests

- [ ] Login page still works ✓
- [ ] Logout still works ✓
- [ ] Profile page loads for existing users ✓
- [ ] Settings page loads for existing users ✓
- [ ] Existing features (2FA, anti-phishing) not broken ✓
- [ ] M-Pesa change requests still work ✓
- [ ] Password reset still works ✓

## Sign-Off

| Component | Tested | Status | Notes |
|-----------|--------|--------|-------|
| Signup Form | [ ] | [ ] Complete / [ ] Issues | |
| Username Generation | [ ] | [ ] Complete / [ ] Issues | |
| Registration API | [ ] | [ ] Complete / [ ] Issues | |
| Profile Page | [ ] | [ ] Complete / [ ] Issues | |
| Settings Page | [ ] | [ ] Complete / [ ] Issues | |
| Update Profile API | [ ] | [ ] Complete / [ ] Issues | |
| Overall System | [ ] | [ ] Ready / [ ] Needs Work | |

**Tested By**: ___________________
**Date**: ___________________
**Environment**: [ ] Local / [ ] Staging / [ ] Production
**Approval**: [ ] Approved / [ ] Rejected (please explain below)

**Notes/Issues Found**:
```
(Document any issues or edge cases discovered during testing)
```

---

## Quick Test Script (for developers)

```bash
# Test 1: Check TypeScript compilation
pnpm exec tsc --noEmit -p tsconfig.json

# Test 2: Check for console errors
# (Open browser, check console tab in dev tools)

# Test 3: Check database - list users and their usernames
# (Run in MongoDB directly to verify generation results)

# Test 4: Test API endpoint manually
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phone": "0712345678",
    "password": "TestPass123",
    "referralId": "TESTREF"
  }'
```

