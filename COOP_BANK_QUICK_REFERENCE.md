# Co-op Bank Integration - Quick Reference

## Endpoints (3 Total)

```
1. Token Endpoint
   POST https://openapi.co-opbank.co.ke/token
   Authorization: Basic <COOP_BANK_BASIC_AUTH>
   
2. STK Push Endpoint
   POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0
   Authorization: Bearer <TOKEN>
   
3. Status Check Endpoint
   POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0
   Authorization: Bearer <TOKEN>
```

## Response Codes (Terminal States = Stop Polling)

| Code | Status | Terminal? | Action |
|------|--------|-----------|--------|
| `0` | `completed` | ✅ Yes | Credit balance |
| `S_001` | `pending` | ❌ No | Poll again |
| `1` | `pending` | ❌ No | Poll again |
| `1037` | `timeout` | ✅ Yes | Stop polling |
| `2001` | `timeout` | ✅ Yes | Stop polling |
| `2002` | `cancelled` | ✅ Yes | Stop polling |
| Other | `failed` | ✅ Yes | Stop polling |

## Key Issues Fixed

### 1. Response Code 1037 (No User Response)
- **Issue:** Treated as intermediate, kept polling forever
- **Fix:** Now mapped to `'timeout'` (terminal state)
- **Result:** Polling stops when user cancels STK

### 2. S_001 Code Handling
- **Issue:** Fell through to default, marked as failed
- **Fix:** Explicitly mapped to `'pending'`
- **Result:** Shows "Processing" instead of "Failed"

### 3. Bearer Token Caching
- **Issue:** Cached token used, API returned 500 errors
- **Fix:** Fresh token for each STK/status call
- **Result:** Automatic retry on failure

### 4. Balance Updated While Processing
- **Issue:** Balance marked updated before transaction completed
- **Fix:** Only set `balance_updated` for terminal states
- **Result:** Callback can still update balance

## Testing

### Quick Test
```bash
# Node.js (recommended)
node scripts/test-coop-endpoints.js

# Bash script
bash scripts/test-coop-endpoints.sh

# Manual curl
curl -X POST https://openapi.co-opbank.co.ke/token \
  -H "Authorization: Basic YOUR_COOP_BANK_BASIC_AUTH" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

## Environment Variables

```
COOP_BANK_BASIC_AUTH=Basic <base64-encoded-credentials>
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0
```

## Transaction Flow

```
1. User initiates payment
   ↓
2. POST /FT/stk/1.0.0 (STK Push)
   Bearer token sent in header
   ↓
3. STK prompt shown to user
   ↓
4. Loop: POST /Enquiry/STK/1.0.0 (Status Check)
   ├─ MessageCode: "S_001" → keep polling
   ├─ MessageCode: "0" → completed ✓
   ├─ MessageCode: "1037" → user cancelled ✗
   └─ Stop polling
   ↓
5. Result: Success or Failure
```

## Common Issues & Solutions

### Issue: "Missing Authorization Header"
```json
{"fault":{"code":900902,"message":"Missing ********":"Invalid Credentials..."}}
```
**Solution:** 
- Token endpoint: Use `Authorization: Basic ...`
- STK Push: Use `Authorization: Bearer ...`
- Status: Use `Authorization: Bearer ...`

### Issue: User Cancels But System Keeps Polling
**Solution:** Check response code `1037` is handled:
```typescript
if (responseCode === '1037') {
  return 'timeout'; // Terminal state
}
```

### Issue: Status Shows Failed But Money Was Deducted
**Solution:** Check `balance_updated` is NOT set while pending:
```typescript
if (status === 'pending') {
  // DO NOT set balance_updated
  // Allows callback to still update balance
}
```

## Files to Know

| File | Purpose |
|------|---------|
| `app/lib/services/coop-bank.ts` | CoopBankService class |
| `app/actions/activation.ts` | Account activation payments |
| `app/actions/deposit.ts` | Wallet deposit payments |
| `app/actions/spin.ts` | Spin wheel payments |
| `app/actions/spin-wallet.ts` | Spin wallet logic |
| `scripts/test-coop-endpoints.js` | Endpoint testing |
| `COOP_BANK_RESPONSE_CODES.md` | Full code reference |
| `COOP_BANK_ENDPOINT_VERIFICATION.md` | Detailed guide |

## Monitoring

### Success Logs
```
[v0] Token Request (Attempt 1/2):
[v0] Token obtained successfully (expires in 3600s)
[v0] STK Push Request Details: ...
[v0] STK Status Result: {"MessageCode":"0","MessageDescription":"SUCCESS"}
```

### Failure Logs
```
[v0] Terminal error code: 1037 - stopping polling
[v0] Token request failed (500)
[v0] Retrying in 1000ms...
```

## Deployment Checklist

- [ ] COOP_BANK_BASIC_AUTH set in production
- [ ] COOP_BANK_OPERATOR_CODE is "SANDRA"
- [ ] All endpoints using HTTPS
- [ ] Bearer tokens not logged in production
- [ ] Polling timeout is 5 minutes max
- [ ] Database transactions are atomic
- [ ] Callbacks are verified before processing
- [ ] Error responses are monitored

