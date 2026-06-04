# Co-op Bank Endpoint Verification Guide

## Quick Test

### Option 1: Using Node.js (Recommended)
```bash
node scripts/test-coop-endpoints.js
```

### Option 2: Using Bash Script
```bash
bash scripts/test-coop-endpoints.sh
```

### Option 3: Manual curl Testing

#### 1. Get Bearer Token
```bash
curl -X POST https://openapi.co-opbank.co.ke/token \
  -H "Authorization: Basic YOUR_COOP_BANK_BASIC_AUTH" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

**Expected Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

#### 2. Initiate STK Push
```bash
curl -X POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "MessageReference": "ACT1234567890TEST",
    "CallBackUrl": "https://yourdomain.com/callback",
    "OperatorCode": "SANDRA",
    "TransactionCurrency": "KES",
    "MobileNumber": "254700000000",
    "Narration": "Test Payment",
    "Amount": 1,
    "MessageDateTime": "2026-06-04T10:00:00.000Z",
    "OtherDetails": [
      {
        "Name": "ReferenceNumber",
        "Value": "ACT1234567890TEST"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "MessageCode": "0",
  "MessageDescription": "REQUEST ACCEPTED FOR PROCESSING",
  "MessageReference": "ACT1234567890TEST",
  "ConversationID": "..."
}
```

#### 3. Check Transaction Status
```bash
curl -X POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "MessageReference": "ACT1234567890TEST"
  }'
```

**Expected Response (while processing):**
```json
{
  "MessageCode": "S_001",
  "MessageDescription": "PROCESSING",
  "MessageReference": "ACT1234567890TEST"
}
```

**Expected Response (after success):**
```json
{
  "MessageCode": "0",
  "MessageDescription": "SUCCESS",
  "MessageReference": "ACT1234567890TEST",
  "TransactionAmount": "1.00",
  "MobileNumber": "254700000000"
}
```

**Expected Response (after user cancels):**
```json
{
  "MessageCode": "1037",
  "MessageDescription": "No response from user.",
  "MessageReference": "ACT1234567890TEST"
}
```

## Response Code Reference

| Code | Meaning | Continue Polling? |
|------|---------|-------------------|
| 0 | Success | ❌ No (terminal) |
| 1 | Processing | ✅ Yes (intermediate) |
| S_001 | Processing | ✅ Yes (intermediate) |
| 1037 | No response from user | ❌ No (terminal) |
| 2001 | User timeout | ❌ No (terminal) |
| 2002 | User cancelled | ❌ No (terminal) |
| Other | Error | ❌ No (terminal) |

## Environment Variables

Ensure these are set in `.env.local`:

```
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx...
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0
```

## Verification Checklist

### Token Endpoint
- [ ] Bearer token obtained successfully
- [ ] Token is valid JWT format
- [ ] Token expires in ~3600 seconds
- [ ] Token can be used in subsequent requests

### STK Push Endpoint
- [ ] Accepts POST requests with Bearer token
- [ ] Returns MessageCode '0' for success
- [ ] Returns MessageReference matching request
- [ ] Returns ConversationID for callback matching

### Status Check Endpoint
- [ ] Accepts POST requests with Bearer token
- [ ] Returns MessageCode matching transaction state
- [ ] Properly returns S_001 for processing
- [ ] Properly returns 1037 for user cancellation
- [ ] Properly returns 0 for completion

## Common Issues

### "Invalid Credentials" Error
```
{"fault":{"code":900902,"message":"Missing ********":"Invalid Credentials. Make sure your API invocation call has a header: 'Authorization : Bearer ACCESS_TOKEN' or 'Authorization : Basic ACCESS_TOKEN' or 'apikey: API_KEY'"}}
```

**Solution:**
- Check COOP_BANK_BASIC_AUTH format (must start with "Basic ")
- Verify no trailing spaces or newlines in the value
- Ensure Bearer token is in correct format (from token endpoint)
- Use correct Authorization header for each endpoint:
  - Token: `Authorization: Basic ...`
  - STK Push: `Authorization: Bearer ...`
  - Status: `Authorization: Bearer ...`

### "Missing MessageReference"
```
{"fault":{"code":400,"message":"Bad Request"}}
```

**Solution:**
- Ensure MessageReference is included in request body
- MessageReference must match between STK Push and Status Check
- Use alphanumeric characters, no special characters except underscore

### No Response from Server
**Solution:**
- Verify baseUrl is correct: https://openapi.co-opbank.co.ke
- Check network connectivity
- Verify firewall/proxy allows HTTPS requests
- Add timeout handling (60 seconds is safe)

## Testing Flow

1. **Get Token**
   ```
   POST /token with Basic auth
   → Get Bearer token
   ```

2. **Initiate STK**
   ```
   POST /FT/stk/1.0.0 with Bearer token
   → Get MessageCode: "0" (accepted)
   ```

3. **Poll Status**
   ```
   POST /Enquiry/STK/1.0.0 with Bearer token
   → Get MessageCode: "S_001" (processing)
   → Loop: check every 4 seconds
   ```

4. **User Action**
   ```
   User enters M-Pesa PIN or cancels
   → Bank processes request
   ```

5. **Final Poll**
   ```
   POST /Enquiry/STK/1.0.0 with Bearer token
   → Get MessageCode: "0" (success) or "1037" (cancelled)
   → Stop polling
   ```

## Production Checklist

- [ ] COOP_BANK_BASIC_AUTH is set and not committed to git
- [ ] COOP_BANK_OPERATOR_CODE is set correctly
- [ ] All endpoints are using HTTPS
- [ ] Bearer tokens are cached securely (in memory, not localStorage)
- [ ] Polling stops at terminal response codes
- [ ] Callbacks are verified before processing
- [ ] Error responses are logged and monitored
- [ ] Rate limiting is respected (don't poll too frequently)

