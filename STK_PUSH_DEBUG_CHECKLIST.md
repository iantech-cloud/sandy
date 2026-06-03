# STK Push Debug Checklist

Quick reference for diagnosing STK push issues.

## If User Sees "Failed to Initiate Payment"

### 1. Check Console Logs
Look for these patterns:

```
✅ EXPECTED: [v0] STK Push Response Status: 200
✅ EXPECTED: [v0] Normalizing STK Push response: MessageCode->ResponseCode
✅ EXPECTED: [v0] Normalized STK Push Response: { ResponseCode: "0", ... }

❌ PROBLEM: [v0] STK Push Error Response: <error details>
❌ PROBLEM: Missing "Normalizing..." log (field mapping didn't happen)
```

### 2. Check Backend Logs for These Steps
```
[v0] createCoopBankService - Environment vars:    ← Service initialized
[v0] Co-op Bank Token Request:                     ← Getting Bearer token
[v0] Token obtained successfully, expires in: 3600 seconds   ← Token cached
[v0] STK Push Request Details:                     ← Request prepared
[v0] STK Push Payload: {...}                       ← Full payload shown
[API] Calling coopBank.initiateSTKPush with: {...} ← Action called service
[v0] STK Push Response Status: 200                 ← HTTP success
[v0] STK Push Success Response: {...}              ← Raw API response
[v0] Normalizing STK Push response:                ← Field mapping
[v0] Normalized STK Push Response: {...}           ← After normalization
```

### 3. Verify Environment Variables
```bash
node scripts/validate-env.js
```

Expected output:
```
✓ COOP_BANK_BASIC_AUTH           = Basic MktETXRDZnpfSH...
✓ COOP_BANK_OPERATOR_CODE        = SANDRA
✓ All Co-op Bank OAuth2 credentials are configured
```

### 4. Test Bearer Token
```bash
node scripts/test-coop-token.js
```

Expected output:
```
✅ Bearer Token format is correct
✅ All environment variables are set
Response Status: 200 OK
✅ OAuth2 Bearer token obtained successfully!
```

## STK Push Response Field Reference

### Co-op Bank API Returns This
```json
{
  "MessageReference": "ACT...",
  "MessageDateTime": "2026-06-03T13:06:34",
  "MessageCode": "0",
  "MessageDescription": "REQUEST ACCEPTED FOR PROCESSING"
}
```

### Our Service Normalizes To This
```json
{
  "MessageReference": "ACT...",
  "ResponseCode": "0",
  "ResponseDescription": "REQUEST ACCEPTED FOR PROCESSING",
  "MessageDateTime": "2026-06-03T13:06:34"
}
```

### Success Codes
```
ResponseCode: "0"  → Success (STK prompt sent)
ResponseCode: "2001" → Timeout (no user response)
ResponseCode: "2002" → Cancelled (user rejected)
ResponseCode: "1"  → Pending (still processing)
Other codes → Failure
```

## Common Issues & Solutions

### Issue: "Invalid phone number"
**Check**:
- Phone starts with `0` or `254` or `+254`
- If registered phone is `07...`, must use `07...` (not `2547...`)
- No spaces or special characters

### Issue: "Phone number does not match"
**Check**:
- User's registered phone number in database
- Entry phone number matches exactly
- Some systems store as `254...`, some as `07...`

### Issue: "Account is already activated"
**Check**:
- User's `approval_status` field (should be "pending" for activation)
- User's `rank` field (should be "Unactivated" for activation)
- If both conditions false, account is already active

### Issue: "Failed to initiate payment" (Still!)
**Check** in order:
1. **Bearer Token**
   ```bash
   node scripts/test-coop-token.js
   ```
   - If fails → COOP_BANK_BASIC_AUTH is invalid
   - Fix: Check Postman collection and update env var

2. **Console Logs**
   ```
   [v0] STK Push Response Status: ???
   ```
   - If not 200 → API returned error
   - Check error response for reason

3. **Response Normalization**
   ```
   [v0] Normalizing STK Push response:
   ```
   - If missing → might be checking wrong field
   - Verify ResponseCode is actually set

4. **Database Records**
   ```
   MpesaTransaction: { checkout_request_id: "ACT...", status: "initiated" }
   ActivationPayment: { status: "pending", checkout_request_id: "ACT..." }
   ```
   - Should be created BEFORE API call
   - Use `messageReference` as lookup key

## Log Levels

### 🔵 Blue Logs `[v0]`
- Service layer operations
- Token requests/caching
- Request/response details
- Response normalization

### 🟢 Green Logs `[API]`
- API route operations
- Service initialization
- Transaction creation
- Response to client

### 🟠 Orange Logs `[Activation]` or `[CoopStatus]`
- Activation-specific logic
- Status checking
- Database operations

### 🔴 Red Logs `ERROR`
- Failures
- Missing records
- API errors

## Testing Locally

### 1. Full Flow Test
```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Check env
node scripts/validate-env.js

# Terminal 3: Test token
node scripts/test-coop-token.js
```

### 2. Browser Test
1. Navigate to `http://localhost:3000/auth/activate`
2. Enter phone: `07...` (must match registered number)
3. Click "Pay KES 90 via Co-op Bank"
4. **Expected**: Redirects to waiting page with URL like:
   ```
   /auth/activate/mpesa-waiting?messageReference=ACT...&amount=90...
   ```
5. **Not expected**: Error message displayed

### 3. Check Logs
```bash
# Watch logs during payment
tail -f ~/.pm2/logs/next*.log | grep -E "^\[v0\]|\[API\]"
```

## Response Normalization Details

### Why It's Needed

The Co-op Bank API has different endpoint response formats:
- **STK Push**: Returns `MessageCode` + `MessageDescription`
- **Status Check**: Might return `ResponseCode` + `ResponseDescription` (or the other way)
- **Different environments**: Different endpoints return different field names

### How It Works

In `app/lib/services/coop-bank.ts`:

```typescript
// If API returned MessageCode, map it to ResponseCode
if (result.MessageCode && !result.ResponseCode) {
  result.ResponseCode = result.MessageCode;
  console.log('[v0] Normalizing STK Push response: MessageCode->ResponseCode');
}

// Same for description
if (result.MessageDescription && !result.ResponseDescription) {
  result.ResponseDescription = result.MessageDescription;
  console.log('[v0] Normalizing STK Push response: MessageDescription->ResponseDescription');
}
```

### Safe Because
- ✅ Non-destructive (doesn't overwrite existing fields)
- ✅ Backwards compatible (if API returns ResponseCode, nothing changes)
- ✅ Centralized (happens in service, affects all callers)
- ✅ Logged (every normalization is tracked)
- ✅ Flexible (works with any API variant)

## Quick Links

- **Technical Fix**: [`STK_PUSH_RESPONSE_FIX.md`](./STK_PUSH_RESPONSE_FIX.md)
- **Issue Report**: [`ACTIVATION_PAYMENT_FIX.md`](./ACTIVATION_PAYMENT_FIX.md)
- **Full Implementation**: [`COOP_BANK_README.md`](./COOP_BANK_README.md)
- **Payment Debugging**: [`COOP_BANK_PAYMENT_DEBUG.md`](./COOP_BANK_PAYMENT_DEBUG.md)
