# Survey Payment System - Complete Fix Documentation

## Problem Statement
Survey payment implementation was failing with validation error:
```
MpesaTransaction validation failed: account_reference: Path `account_reference` is required.
```

The issue was that survey-payments.ts wasn't following the same pattern as activation.ts for payment processing.

## Root Causes Fixed

### 1. Missing Required Fields in MpesaTransaction
**Issue**: The MpesaTransaction creation was missing required fields:
- `account_reference` (required)
- `transaction_desc` (required)
- `checkout_request_id` (required for callback matching)

**Fix**: Updated `/app/actions/survey-payments.ts` to include all required fields:
```typescript
const mpesaTransaction = new MpesaTransaction({
  user_id: user._id,
  amount_cents: amountInCents,
  phone_number: phoneNumber,
  account_reference: `SURVEY-${surveyId.substring(0, 8)}`,  // ✓ Added
  transaction_desc: `Survey access payment - Survey ID: ${surveyId}`,  // ✓ Added
  checkout_request_id: messageReference,  // ✓ Added
  status: 'initiated',
  source: 'survey_payment',
  metadata: {
    survey_id: surveyId,
    payment_reason: 'survey_access',
    user_username: user.username,
    initiated_at: new Date().toISOString(),
  },
});
```

### 2. Incorrect STK Push API Call
**Issue**: survey-payments.ts was calling `initiateSTKPush()` with an object parameter, but the Coop Bank service expects positional parameters.

**Wrong**:
```typescript
await coopBankService.initiateSTKPush({
  phoneNumber,
  amount: amountInKsh,
  accountReference: `SURVEY_${surveyId}`,
  description: `Sandy Survey Access - ${amountInKsh} KSH`,
  callbackUrl,
  messageReference
});
```

**Correct**:
```typescript
await coopBank.initiateSTKPush(
  phoneNumber,           // param 1
  amountInKsh,          // param 2
  `Sandy Survey Access - KES ${amountInKsh}`,  // param 3 (narration)
  callbackUrl,          // param 4
  messageReference      // param 5 (optional)
);
```

### 3. Missing Callback Integration
**Issue**: Payment callback wasn't properly handling survey payments. Survey payment completion wasn't being tracked.

**Fix**: Enhanced `/app/api/payments/coop-bank/callback/route.ts`:
- Added import for `completeSurveyPayment`
- Implemented fire-and-forget background processing for survey payments
- Returns success immediately while processing access unlock in background
- Similar pattern to activation payment for consistency

### 4. Incorrect Metadata Query Format
**Issue**: Queries for nested metadata fields were using wrong syntax: `metadata: { survey_id: surveyId }` instead of dot notation.

**Fix**: Updated all metadata queries to use dot notation:
```typescript
// Wrong
'metadata': { 'survey_id': surveyId }

// Correct
'metadata.survey_id': surveyId
```

### 5. Missing Transaction Audit Records
**Issue**: No Transaction records were created for survey payments, making audit trails incomplete.

**Fix**: Added Transaction record creation before STK push:
```typescript
await Transaction.create({
  user_id: user._id,
  amount_cents: amountInCents,
  type: 'SURVEY_PAYMENT',
  description: `Survey payment for survey: ${surveyId}`,
  status: 'pending',
  mpesa_transaction_id: mpesaTransaction._id,
  target_type: 'survey',
  target_id: surveyId,
  metadata: {
    phoneNumber,
    provider: 'coop_bank',
    messageReference,
    initiated_at: new Date().toISOString(),
  },
});
```

## Implementation Details

### Payment Flow
1. **Initiate** → `initiateSurveyPayment(surveyId)`
   - Validates user and phone number
   - Checks for existing payments
   - Creates MpesaTransaction with all required fields
   - Creates audit Transaction record
   - Calls Co-op Bank STK Push API
   - Returns messageReference for polling

2. **Callback** → `/api/payments/coop-bank/callback` (POST)
   - Receives payment result from Co-op Bank
   - Updates MpesaTransaction status
   - Triggers background `completeSurveyPayment()`
   - Returns immediately (doesn't block on processing)

3. **Complete** → `completeSurveyPayment(messageReference, surveyId)`
   - Finds transaction by messageReference (idempotency)
   - Updates transaction status to 'completed'
   - Updates Transaction audit record status
   - User can now access the survey

### Key Features

✓ **Idempotency**: messageReference used as idempotency key - safe for retry
✓ **Fire-and-Forget**: Callback returns immediately, processing happens in background
✓ **Audit Trail**: All transactions logged to Transaction collection
✓ **Error Handling**: Comprehensive try-catch with error logging
✓ **Consistency**: Follows same pattern as activation.ts for maintainability

## Files Modified

1. **app/actions/survey-payments.ts**
   - Fixed `initiateSurveyPayment()` - now creates MpesaTransaction with all required fields
   - Fixed STK Push API call - correct positional parameters
   - Fixed metadata queries - using dot notation
   - Enhanced error handling and logging
   - Updated `completeSurveyPayment()` - uses messageReference for idempotency
   - Updated `getSurveyPaymentStatus()` - fixed metadata queries

2. **app/api/payments/coop-bank/callback/route.ts**
   - Added `completeSurveyPayment` import
   - Enhanced survey payment callback handler
   - Implemented background processing pattern
   - Added proper success response messaging

## Testing

To test the survey payment flow:

1. **Initiate Payment**:
   ```typescript
   const result = await initiateSurveyPayment('survey_id_here');
   console.log(result);
   // Should return: { success: true, data: { messageReference, amount: 30, ... } }
   ```

2. **Check Payment Status**:
   ```typescript
   const status = await getSurveyPaymentStatus('survey_id_here');
   console.log(status);
   // Should return: { success: true, data: { paid: false, pendingPayment: true } }
   ```

3. **After Payment**:
   - User receives M-Pesa prompt on phone
   - Completes payment in M-Pesa app
   - Co-op Bank sends callback to `/api/payments/coop-bank/callback`
   - System processes payment in background
   - User can start survey

## Troubleshooting

### Error: "account_reference is required"
- Check that `initiateSurveyPayment()` is creating MpesaTransaction with `account_reference` field
- Verify it follows format: `SURVEY-${surveyId.substring(0, 8)}`

### Error: "STK Push initiation failed"
- Check Co-op Bank service credentials in `.env`
- Verify phone number format: Should be `254XXXXXXXXX` format
- Check callback URL is reachable from Co-op Bank servers

### Error: "Transaction not found"
- Verify messageReference matches between initial request and callback
- Check database for MpesaTransaction record with matching checkout_request_id

## Related Files
- `/app/lib/models.ts` - MpesaTransaction schema
- `/app/lib/services/coop-bank.ts` - CoopBankService.initiateSTKPush()
- `/app/actions/activation.ts` - Reference implementation for consistency
