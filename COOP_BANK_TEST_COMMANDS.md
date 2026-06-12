# HustleHub Co-operative Bank Token & STK Push Test Commands

## Overview
HustleHub uses **Co-operative Bank's STK Push API** for M-Pesa payments. The flow requires:
1. **Generate Bearer Token** - OAuth2 client credentials grant
2. **Initiate STK Push** - Send payment prompt to user's phone
3. **Monitor Callback** - `/api/mpesa/callback` receives payment completion

---

## Standalone Curl Commands

### 1. Generate Access Token

```bash
curl -X POST "https://openapi.co-opbank.co.ke/token" \
  -H "Authorization: Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials"
```

**Expected Response (200 OK):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Replace `Basic MktETXRDZnpfSHZzcUYzaFNBemxjUmQx` with your Co-op Bank credentials.**

---

### 2. Initiate STK Push (with Bearer Token)

```bash
TOKEN="your_bearer_token_here"

curl -X POST "https://openapi.co-opbank.co.ke/FT/stk/1.0.0" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "PhoneNumber": "254712345678",
    "Amount": "100",
    "AccountReference": "HUSTLEHUB001",
    "TransactionDesc": "Platform Activation"
  }'
```

**Expected Response (200 OK):**
```json
{
  "MessageCode": "0",
  "MessageDescription": "Success",
  "MessageReference": "12345",
  "OperatorTxnID": "rk500012345"
}
```

User will receive STK push on their phone → enter M-Pesa PIN → callback sent to `/api/mpesa/callback`.

---

### 3. Check Payment Status

```bash
TOKEN="your_bearer_token_here"

curl -X POST "https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "MessageReference": "12345"
  }'
```

---

## Full Automated Test Script

See `hustlehub-token-test.sh` for a complete shell script that:
- Generates token
- Initiates STK Push
- Handles errors and retries
- Pretty-prints responses

Run:
```bash
bash hustlehub-token-test.sh
```

---

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process payment callback |
| 401 | Invalid token | Re-generate token, check BASIC_AUTH |
| 400 | Bad request | Validate payload (PhoneNumber format, Amount) |
| 500 | Server error | Retry with backoff |
| 504 | Gateway timeout | Retry or check status via Enquiry endpoint |

---

## Common Issues

### "Invalid token"
- Token expired (valid for 3600 seconds)
- BASIC_AUTH credentials incorrect
- **Solution:** Re-generate token before STK push

### "Invalid PhoneNumber"
- Must be 12 digits: `254712345678` (not `0712345678` or `+254712345678`)
- **Solution:** Use `getMpesaPhoneFormat()` utility

### "Insufficient Balance"
- User doesn't have enough M-Pesa credit
- **Solution:** User needs to load M-Pesa or use different number

### No callback received
- Check `/api/mpesa/callback` logs for errors
- Verify callback URL is accessible from Co-op Bank servers
- Check firewall/VPN blocking

---

## Integration Points in HustleHub

- **Token Generation:** `app/lib/services/coop-bank.ts` → `getAccessToken()`
- **STK Push:** `app/actions/deposit.ts` → `processMpesaDeposit()`
- **Callback Handler:** `app/api/mpesa/callback/route.ts`
- **Status Check:** `app/actions/deposit.ts` → `checkMpesaPaymentStatus()`

---

## Environment Variables Required

```env
# Co-op Bank credentials (Base64 encoded)
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx

# Optional: Custom endpoints (defaults to production)
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_URL=/token
COOP_BANK_STK_URL=/FT/stk/1.0.0
COOP_BANK_STATUS_URL=/Enquiry/STK/1.0.0/
```
