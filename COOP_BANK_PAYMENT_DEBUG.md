# Co-operative Bank STK Push Payment Debugging Guide

## Current Issue: "Failed to initiate payment"

The STK Push is returning an error during initiation. Follow these steps to diagnose:

## Step 1: Verify Environment Variables

Run the validation script:

```bash
node scripts/validate-env.js
```

Ensure these are present:
```
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0/
```

## Step 2: Test Bearer Token Authentication

Run the token test script:

```bash
node scripts/test-coop-token.js
```

This will:
- Verify `COOP_BANK_BASIC_AUTH` format
- Authenticate with `/token` endpoint
- Return a Bearer token for subsequent calls

**Expected output:**
```
✓ OAuth2 Bearer token obtained successfully!
✓ Your COOP_BANK_BASIC_AUTH and COOP_BANK_OPERATOR_CODE are correct.
```

## Step 3: Check Server Logs During Payment Attempt

When initiating a payment, check for these logs in your dev server output:

### STK Push Request Logs (should appear in `/api/payments/coop-bank/stk-push`)

```
[v0] STK Push Request Details:
[v0]   Phone: 254707919065
[v0]   Amount: 1 KES
[v0]   Message Reference: SANDY1717410000ABC123
[v0]   Callback URL: https://...../api/payments/coop-bank/callback

[v0] STK Push Payload:
{
  "MessageReference": "SANDY1717410000ABC123",
  "CallBackUrl": "https://...",
  "OperatorCode": "SANDRA",
  "TransactionCurrency": "KES",
  "MobileNumber": "254707919065",
  "Narration": "Payment to HustleHub Africa",
  "Amount": 1,
  "MessageDateTime": "2026-06-03T...",
  "OtherDetails": [
    {
      "Name": "ReferenceNumber",
      "Value": "SANDY1717410000ABC123"
    }
  ]
}

[v0] STK Push Response Status: 200
[v0] STK Push Success Response:
{
  "ResponseCode": "0",
  "ResponseDescription": "Request processed successfully",
  ...
}
```

If you see `ResponseCode: "0"`, the STK Push was successful.

### Common Error Responses

**401 Unauthorized:**
```
[v0] STK Push Error Response: {"error": "invalid_client"}
```
- Fix: Verify `COOP_BANK_BASIC_AUTH` is correct

**400 Bad Request:**
```
[v0] STK Push Error Response: {"error": "invalid_request"}
```
- Could be wrong payload format
- Check: Phone number (must be 254XXXXXXXXX)
- Check: Amount (must be integer KES value)

**500 Server Error:**
- Co-op Bank API is down
- Try again in a few moments

## Step 4: Database Transaction Record

After initiating payment, check MongoDB for the transaction record:

```bash
# Connect to MongoDB
db.mpesatransactions.findOne({
  checkout_request_id: "SANDY1717410000ABC123"  # Use your message reference
})
```

You should see:
```json
{
  "user_id": "...",
  "amount_cents": 100,
  "phone_number": "254707919065",
  "status": "initiated",
  "source": "coop_bank",
  "checkout_request_id": "SANDY1717410000ABC123",
  "metadata": {
    "deposit_type": "wallet",
    "message_reference": "SANDY1717410000ABC123",
    "payment_method": "coop_bank_stk_push",
    "initiated_at": "2026-06-03T10:20:00Z"
  }
}
```

## Step 5: Check Transaction Status

Once payment is initiated, the user gets an STK prompt on their phone. Check status:

**Browser Console / Network Request:**
```
GET /api/payments/coop-bank/status?messageReference=SANDY1717410000ABC123
```

**Response Logs (server):**
```
[CoopStatus] Checking transaction: {
  messageReference: "SANDY1717410000ABC123",
  userId: "..."
}
[CoopStatus] Transaction found: { ... }
[CoopStatus] Querying Co-op Bank API for status...
[v0] STK Status Request:
[v0]   Message Reference: SANDY1717410000ABC123
[v0]   Status URL: https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
[v0] STK Status Response Status: 200
[v0] STK Status Result: {
  "ResponseCode": "1",  // 1 = Still pending
  "ResponseDescription": "Request sent to customer"
}
```

**Status Codes:**
- `0` = Completed ✓
- `1` = Pending (still waiting for user)
- `2001` = Timeout
- `2002` = User cancelled
- Other = Failed

## Step 6: Callback Processing

When payment succeeds on the user's phone, Co-op Bank POSTs to `/api/payments/coop-bank/callback`:

**Logs to expect:**
```
[CoopCallback] Received at 2026-06-03T10:25:00Z
{
  "MessageReference": "SANDY1717410000ABC123",
  "ResponseCode": "0",
  "ResponseDescription": "STK request has been accepted for processing",
  "OperatorTxnID": "ABC123456",
  "Amount": 1,
  "PhoneNumber": "254707919065",
  "TransactionDate": "2026-06-03 10:25:00"
}

[CoopCallback] depositType: wallet | status: completed
[CoopCallback] User wallet credited: +KES 1 (user: ...)
[CoopCallback] Processing complete: {
  messageReference: "SANDY1717410000ABC123",
  paymentStatus: "completed"
}
```

Transaction status in DB updates to `completed`.

## Troubleshooting Checklist

### Payment Initiation Fails

- [ ] Run `node scripts/validate-env.js` — all vars present?
- [ ] Run `node scripts/test-coop-token.js` — Bearer token works?
- [ ] Check phone number format: Must be `254` + 9 digits
- [ ] Check amount: Must be integer KES (1-999999)
- [ ] Check callback URL: Must be publicly accessible (not localhost)
- [ ] Check ngrok tunnel is running: `ngrok http 5000`
- [ ] Check `NEXT_PUBLIC_BASE_URL` matches your ngrok URL or production domain

### STK Prompt Doesn't Appear on Phone

- [ ] Phone number is correct and has M-Pesa active
- [ ] Amount is valid (KES 1-999999)
- [ ] Check Co-op Bank API status: https://openapi.co-opbank.co.ke

### Payment Stuck in "Initiated" Status

- [ ] Wait 60 seconds
- [ ] Manual status check: `GET /api/payments/coop-bank/status?messageReference=...`
- [ ] Check MongoDB for transaction record
- [ ] User may have cancelled on their phone

### Callback Not Received

- [ ] Callback URL must be public (test with curl from external host)
- [ ] Check firewall/IP whitelist
- [ ] Co-op Bank may be unable to reach your server
- [ ] Check server logs for POST requests to `/api/payments/coop-bank/callback`

## Testing Workflow

1. **Validate Environment**
   ```bash
   node scripts/validate-env.js
   ```

2. **Test Bearer Token**
   ```bash
   node scripts/test-coop-token.js
   ```

3. **Start Dev Server**
   ```bash
   npm run dev
   ```

4. **Start ngrok Tunnel** (in another terminal)
   ```bash
   ngrok http 5000
   ```

5. **Update `.env.local`**
   - Set `NEXT_PUBLIC_BASE_URL` to your ngrok URL

6. **Initiate Test Payment** (in app UI)
   - Phone: 254707919065 (test number)
   - Amount: 1 KES
   - Watch server logs

7. **Monitor Status** 
   - Browser DevTools → Network tab
   - Watch for GET requests to `/api/payments/coop-bank/status`
   - Server logs show `[CoopStatus]` entries

8. **Complete on Phone**
   - Enter M-Pesa PIN on test phone
   - Watch for callback logs: `[CoopCallback]`

## Key Logs Summary

| Log Prefix | Meaning |
|-----------|---------|
| `[v0]` | Core service (token, STK Push, Status queries) |
| `[API]` | STK Push route `/api/payments/coop-bank/stk-push` |
| `[CoopStatus]` | Status check route `/api/payments/coop-bank/status` |
| `[CoopCallback]` | Callback route `/api/payments/coop-bank/callback` |

## Still Having Issues?

1. Collect all logs from server when payment fails
2. Check MongoDB for transaction records
3. Test with `curl` directly against Co-op Bank API using provided Bearer token
4. Verify callback URL is reachable from external network

Example curl test:
```bash
# Get Bearer token
BEARER=$(curl -s -X POST https://openapi.co-opbank.co.ke/token \
  -H "Authorization: Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  | jq -r '.access_token')

# Initiate STK Push
curl -X POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0 \
  -H "Authorization: Bearer $BEARER" \
  -H "Content-Type: application/json" \
  -d '{
    "MessageReference": "TEST001",
    "CallBackUrl": "https://yourdomain.com/api/payments/coop-bank/callback",
    "OperatorCode": "SANDRA",
    "TransactionCurrency": "KES",
    "MobileNumber": "254707919065",
    "Narration": "Test Payment",
    "Amount": 1,
    "MessageDateTime": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
    "OtherDetails": [{"Name": "Test", "Value": "1"}]
  }'
```
