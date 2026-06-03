# Payment Status Debugging Guide

## Quick Diagnostic Flow

When a user reports payment issues, follow this checklist:

### 1. Check Environment Variables
```bash
echo $COOP_BANK_BASIC_AUTH       # Should start with "Basic"
echo $COOP_BANK_OPERATOR_CODE   # Should be "SANDRA"
echo $COOP_BANK_BASE_URL         # Should be "https://openapi.co-opbank.co.ke"
```

### 2. Run Authentication Test
```bash
node scripts/test-coop-token.js
```

Expected output:
```
✅ All environment variables are set
✓ Bearer Token format is correct
✓ Token obtained successfully, expires in: 3600 seconds
```

### 3. Monitor Console During Payment

Open browser DevTools Console and watch for these log patterns:

#### STK Push Initiation
```javascript
[v0] STK Push Request Details:
[v0]   Phone: 254707919065
[v0]   Amount: 1 KES
[v0]   Message Reference: SANDY1719...
[v0]   Callback URL: https://...

[v0] STK Push Payload: { MessageReference: "SANDY...", ... }
[v0] STK Push Response Status: 200
[v0] Normalizing STK Push response: MessageCode->ResponseCode
[v0] Normalized STK Push Response: { ResponseCode: "0", ... }
```

#### Status Polling (Activation)
```javascript
[v0] Activation polling attempt 1: {
  status: 'pending',
  resultCode: '1',
  resultDesc: null,
  source: 'coop_api'
}
⏳ Transaction still pending - M-Pesa is processing, will check again
```

#### Status Polling (Deposit)
```javascript
[Deposit] Payment status check: {
  messageReference: 'SANDY...',
  responseCode: '1',
  mappedStatus: 'pending',
  description: 'PROCESSING'
}
[Deposit waiting] Status received: {
  status: 'pending',
  resultCode: '1',
  resultDesc: '',
  source: 'api'
}
⏳ Transaction still pending - continuing to poll
```

#### Status Polling (Spin Wallet)
```javascript
[SpinWallet] Payment status check: {
  messageReference: 'SPIN...',
  responseCode: '1',
  mappedStatus: 'pending',
  description: 'PROCESSING'
}
[SpinWallet] ⏳ Payment still pending - continue polling
```

#### On Completion
```javascript
[v0] Activation polling attempt 2: {
  status: 'completed',
  resultCode: '0',
  resultDesc: 'REQUEST COMPLETED',
  source: 'coop_api'
}
✅ Status mapped to success
[Activation] Activation triggered from status poll
```

## Common Issues & Solutions

### Issue: "Failed to initiate payment. Please try again."

**Check #1: Is Bearer Token Valid?**
```bash
node scripts/test-coop-token.js
```

If fails, verify:
- `COOP_BANK_BASIC_AUTH` is set and starts with "Basic "
- Base64 encoded credentials are correct
- Token endpoint is reachable

**Check #2: Is the response code being normalized?**

Look for these logs in the console:
```
[v0] Normalizing STK Push response: MessageCode->ResponseCode
```

If missing, the API response isn't being normalized - check `app/lib/services/coop-bank.ts` line ~250

**Check #3: Is the payment status showing?**

In the waiting page, check:
```javascript
console.log('paymentStatus:', paymentStatus); // Add this temporarily
```

Should show:
```javascript
{ status: 'processing', resultCode: null, resultDesc: null }
```

NOT:
```javascript
{ status: 'failed', error: '...' }
```

### Issue: Page shows "Processing" but never updates

**Check #1: Is polling happening?**

Look for repeated logs:
```
[v0] Activation polling attempt 1: ...
[v0] Activation polling attempt 2: ...
[v0] Activation polling attempt 3: ...
```

If not appearing, polling might be disabled. Check:
- `isPolling` state in waiting component
- `POLLING_INTERVAL` is set (default 4000ms)
- Network tab shows repeated requests to `/checkActivationPaymentStatus`

**Check #2: Is Co-op Bank responding?**

Network tab → look for requests to:
- `/api/payments/coop-bank/stk-push/route.ts` (should return 200)
- Check response has `ResponseCode: "0"`

**Check #3: Is the callback being received?**

Server logs should show:
```
[CoopCallback] Received at 2024-06-03T10:30:00.000Z { MessageReference: "SANDY...", ResponseCode: "0", ... }
[CoopCallback] Status mapped: { responseCode: "0", mappedStatus: "completed" }
```

### Issue: User paid but showing "Failed" after completion

**Check #1: Response code mapping**

Verify the response code value:
```javascript
console.log('ResponseCode:', statusResponse.ResponseCode);
```

Should be:
- `'0'` for success
- `'1'` for pending
- `'2002'` for cancelled
- `'2001'` for timeout
- Anything else = failed

**Check #2: Status normalized correctly**

Check that `mapResponseCode()` is being used:
```javascript
// Should see one of:
[Activation] Status check: { responseCode: '0', mappedStatus: 'completed', ... }
[Deposit] Payment status check: { responseCode: '0', mappedStatus: 'completed', ... }
[SpinWallet] Payment status check: { responseCode: '0', mappedStatus: 'completed', ... }
```

**Check #3: Terminal state handling**

After 'completed' status, page should update UI:
```
✅ Status mapped to success
```

And the status should change to `{ status: 'success', ... }`

## Response Code Reference

| Code | Status | Meaning | Action |
|------|--------|---------|--------|
| `0` | `completed` | ✅ Payment successful | Show success, proceed |
| `1` | `pending` | ⏳ Still processing | Continue polling |
| `2001` | `timeout` | ⏱️ Request timed out | Show timeout message |
| `2002` | `cancelled` | ❌ User cancelled | Show cancellation |
| Other | `failed` | ❌ Payment failed | Show error message |

## Logging Prefixes

Understand what each prefix means:

| Prefix | Source | Meaning |
|--------|--------|---------|
| `[v0]` | Service layer | Core payment service operations |
| `[Activation]` | `app/actions/activation.ts` | Activation payment status checks |
| `[Deposit]` | `app/actions/deposit.ts` | Main wallet deposit checks |
| `[SpinWallet]` | `app/actions/spin-wallet.ts` | Spin wallet deposit checks |
| `[CoopCallback]` | `app/api/payments/coop-bank/callback/route.ts` | Webhook callback handler |
| `[CoopStatus]` | `app/api/payments/coop-bank/status/route.ts` | Status endpoint |

## Performance Checklist

**Fast Payment (< 15 seconds):**
- STK Push sent
- User enters PIN immediately
- Callback received
- Page shows success

Expected logs timeline:
- 0s: STK Push initiated
- 1-5s: Polling starts (shows "pending")
- 5-10s: User enters PIN
- 10-15s: Callback received, status updated

**Slow Payment (15-60 seconds):**
- Normal - user takes time to enter PIN
- Polling continues showing "pending"
- Once callback received, immediate success

**Timeout (> 2 minutes):**
- Expected if user never completes
- Page shows "Payment Timeout"
- Check `POLLING_INTERVAL` and `MAX_POLLING_ATTEMPTS`

## Test Payment Flow

### Activation Payment Test
```
1. Go to /auth/activate
2. Fill in form
3. Click "Activate with M-Pesa"
4. Watch console - should see STK Push logs
5. On phone - should see STK prompt
6. Enter M-Pesa PIN
7. Dashboard should auto-load after payment
```

### Deposit Payment Test
```
1. Go to /dashboard/wallet
2. Click "Deposit"
3. Enter amount
4. Click "Deposit with M-Pesa"
5. Watch console - should see deposit logs
6. On phone - should see STK prompt
7. Enter M-Pesa PIN
8. Wallet balance should update after payment
```

### Spin Wallet Test
```
1. Go to /dashboard/spin
2. Click "Buy Spin (KES 30)"
3. Watch console - should see spin logs
4. On phone - should see STK prompt
5. Enter M-Pesa PIN
6. Spin credits should increase after payment
```

## Advanced Debugging

### Enable Verbose Mode (Development Only)

In waiting component:
```typescript
const DEBUG = process.env.NODE_ENV === 'development';

if (DEBUG) {
  console.log('[DEBUG] Full payment status:', {
    paymentStatus,
    pollingCount,
    timeLeft,
    isPolling,
    messageReference,
  });
}
```

### Check Database Status Directly

```bash
# Connect to MongoDB
mongo your_connection_string

# Check transaction
db.mpesatransactions.findOne({ checkout_request_id: "SANDY..." })

# Should show:
{
  _id: ObjectId(...),
  status: "completed",      # or "pending", "failed", etc.
  result_code: 0,
  result_desc: "REQUEST COMPLETED",
  mpesa_receipt_number: "SGN...",
  callback_received_at: ISODate(...),
  completed_at: ISODate(...)
}
```

### Check Callback Logs

```bash
# Recent callbacks
tail -f server-logs.txt | grep "CoopCallback"

# Should show:
[CoopCallback] Received at 2024-06-03T10:30:00Z { MessageReference: "SANDY...", ResponseCode: "0" }
[CoopCallback] Status mapped: { responseCode: "0", mappedStatus: "completed" }
```

## Common Query Patterns

### "Payment succeeded but wallet not updated"
1. Check callback was received
2. Verify transaction status = 'completed'
3. Check `callback_received_at` timestamp
4. Look for wallet credit transaction in Transaction ledger

### "STK Push never arrived on phone"
1. Check phone number format (should be 254XXXXXXXXX)
2. Verify `COOP_BANK_OPERATOR_CODE` is correct
3. Check `COOP_BANK_STK_PUSH_ENDPOINT` is correct
4. Look for API error in response

### "Polling shows pending indefinitely"
1. Check callback timeout (default 2 minutes)
2. Verify user actually entered PIN
3. Check if callback endpoint is reachable
4. Monitor Co-op Bank API rate limits

## Support Resources

- Co-op Bank API Docs: Check SANDRA_OTIENO_SCHOLINE.postman_collection.json
- Status Flow: See STK_WALLET_STATUS_FIX_COMPLETE.md
- Response Mapping: See app/lib/services/coop-bank.ts line 359-374
- Integration Tests: Run `node scripts/test-stk-push.js`
