# Session Switch Fix - ReferenceError: sessionData is not defined

## Issue
When a user tried to login while already logged in with a different account, the application threw:
```
ReferenceError: sessionData is not defined
    at handlePasswordSubmit (LoginContent.tsx:947:56)
```

## Root Cause
The code was trying to access `sessionData?.user?.email` but `sessionData` was never defined as a variable. The component only received `hasExistingSession` as a boolean prop, not the actual session data.

## Solution
Instead of relying on an undefined `sessionData` variable, we now:
1. Call `getSession()` from next-auth/react to fetch the current session when needed
2. Check if the current user's email differs from the login attempt email
3. Automatically call `signOut()` if accounts are different
4. Wait 500ms for logout to complete before attempting new login

## Files Modified
- `/app/auth/login/LoginContent.tsx`
  - Line 677-686: Fixed `handlePasswordSubmit` to use `getSession()` instead of `sessionData`
  - Line 745-754: Fixed `handle2FASubmit` to use `getSession()` instead of `sessionData`

## User Flow (Account Switching)
1. User logged in as Account A
2. User tries to login as Account B on login page
3. System detects different email addresses
4. Automatic logout from Account A
5. Login proceeds with Account B
6. No more ReferenceError - seamless account switching

## Testing
- Build verified successfully
- No TypeScript errors
- Account switching now works without errors
