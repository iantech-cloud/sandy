# STK Push Response Field Mapping Fix

## Problem

The STK Push was successfully being sent to Co-op Bank API and returning a success response:

```
[v0] STK Push Response Status: 200
[v0] STK Push Success Response: {
  "MessageReference": "ACT1780482632221QCV2AD",
  "MessageDateTime": "2026-06-03T13:06:34",
  "MessageCode": "0",
  "MessageDescription": "REQUEST ACCEPTED FOR PROCESSING"
}
```

**But** the activate page was showing "Failed to initiate payment. Please try again." instead of the waiting page.

### Root Cause

The Co-op Bank STK Push API endpoint returns:
- `MessageCode` (not `ResponseCode`)
- `MessageDescription` (not `ResponseDescription`)

But our TypeScript interfaces and validation code was checking for:
- `ResponseCode`
- `ResponseDescription`

This caused the check `if (stkResponse.ResponseCode !== '0')` to fail because `ResponseCode` was `undefined`.

## Solution

### 1. Updated Interfaces

Both `STKPushResponse` and `TransactionStatusResponse` now include the alternate field names:

```typescript
export interface STKPushResponse {
  // Standard fields (after mapping)
  ResponseCode: string;
  ResponseDescription: string;
  
  // ⚠️  Co-op Bank STK Push API uses these field names
  MessageCode?: string;
  MessageDescription?: string;
  MessageDateTime?: string;
}
```

### 2. Response Normalization

Added normalization logic in both `initiateSTKPush()` and `getTransactionStatus()` methods:

```typescript
// Normalize response fields
if (result.MessageCode && !result.ResponseCode) {
  console.log('[v0] Normalizing STK Push response: MessageCode->ResponseCode');
  result.ResponseCode = result.MessageCode;
}
if (result.MessageDescription && !result.ResponseDescription) {
  console.log('[v0] Normalizing STK Push response: MessageDescription->ResponseDescription');
  result.ResponseDescription = result.MessageDescription;
}
```

### 3. Enhanced Logging

All response normalization is now logged with detailed diagnostic information:

```
[v0] Normalized STK Push Response: {
  ResponseCode: "0",
  ResponseDescription: "REQUEST ACCEPTED FOR PROCESSING",
  MessageReference: "ACT1780482632221QCV2AD"
}
```

## What Changed

### Files Modified

1. **`app/lib/services/coop-bank.ts`**
   - Updated `STKPushResponse` interface to include `MessageCode`, `MessageDescription`, `MessageDateTime`
   - Updated `TransactionStatusResponse` interface similarly
   - Added response normalization in `initiateSTKPush()` method
   - Added response normalization in `getTransactionStatus()` method
   - Enhanced logging for all response mappings

### Behavior

- **Before**: STK Push response with `MessageCode: "0"` would fail because code checked for undefined `ResponseCode`
- **After**: STK Push response is normalized automatically, `ResponseCode` is set to `"0"`, validation passes ✓

## Testing

To verify the fix works:

```bash
# 1. Go to /auth/activate
# 2. Enter a valid phone number
# 3. Click "Pay KES 90 via Co-op Bank"
# 4. Watch the console logs:
#    ✓ [v0] Normalized STK Push Response: { ResponseCode: "0", ... }
#    ✓ Should redirect to /auth/activate/mpesa-waiting (not show error)
# 5. Check your phone for the M-Pesa STK prompt
```

## Related Code Paths

1. **Activation Payment Initiation**
   - `app/auth/activate/ActivateComponent.tsx` → calls `initiateActivationPayment()`
   - `app/actions/activation.ts` → calls `coopBank.initiateSTKPush()`
   - ✅ Now works correctly with normalized response

2. **Wallet Deposit Initiation**
   - `app/actions/deposit.ts` → calls `coopBank.initiateSTKPush()`
   - ✅ Now works correctly with normalized response

3. **Status Polling**
   - `app/api/payments/coop-bank/status/route.ts` → calls `coopBank.getTransactionStatus()`
   - ✅ Now works correctly with normalized response

## Fallback Behavior

The normalization is **non-destructive**:
- If `ResponseCode` already exists, it's not overwritten
- If `MessageCode` doesn't exist, nothing happens
- All responses continue to work regardless of field name format

This ensures compatibility with any future API changes or different environment configurations.

## Development Notes

When debugging STK push issues, look for these log patterns:

```
[v0] STK Push Request Details:      ← Shows what we're sending
[v0] STK Push Payload:              ← Complete request body
[v0] STK Push Response Status: 200  ← HTTP status
[v0] STK Push Success Response:     ← Raw API response
[v0] Normalizing STK Push response: ← Field mapping happening
[v0] Normalized STK Push Response:  ← Final normalized fields
```

If `Normalizing...` doesn't appear, the API already returned `ResponseCode` (some endpoints might do this).
