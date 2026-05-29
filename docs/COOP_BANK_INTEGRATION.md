# Co-operative Bank M-Pesa Integration Guide

This guide covers the complete implementation of Co-operative Bank's M-Pesa STK Push payment API for HustleHub Africa.

## Overview

The Co-operative Bank integration provides:
- **STK Push**: Prompt users to enter M-Pesa PIN on their phones
- **Transaction Status**: Query payment status in real-time
- **Callback Handling**: Automatic payment confirmation and wallet crediting
- **Multiple Deposit Types**: Regular wallet, spin wallet, and account activation

## Environment Variables

Add these to your `.env` or project settings:

```env
# Co-operative Bank Credentials
COOP_BANK_CLIENT_ID=your-client-id
COOP_BANK_CLIENT_SECRET=your-client-secret
COOP_BANK_OPERATOR_CODE=your-operator-code
COOP_BANK_ENVIRONMENT=sandbox  # or 'production'

# Callback URL (must be publicly accessible)
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

## API Endpoints

### 1. Initiate STK Push
**POST** `/api/payments/coop-bank/stk-push`

Initiates an M-Pesa payment prompt on the customer's phone.

**Request:**
```json
{
  "amount": 1000,
  "phoneNumber": "254707919065",
  "narration": "Payment to HustleHub Africa",
  "depositType": "wallet"
}
```

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "messageReference": "SANDY1706234567890ABC",
    "operatorTxnID": "operator-transaction-id",
    "conversationID": "conversation-id",
    "transactionId": "mongodb-transaction-id",
    "amount": 1000,
    "phoneNumber": "254707919065"
  },
  "message": "STK Push initiated. Please check your phone to complete the payment."
}
```

**Phone Number Formats Accepted:**
- `254707919065` (E.164)
- `07919065` (Short format - will be converted to 254)
- `+254707919065` (With +)

**Deposit Types:**
- `wallet` - Regular wallet top-up (default)
- `spin_wallet` - Spin wallet deposit
- `activation` - Account activation payment

---

### 2. Check Transaction Status
**GET** `/api/payments/coop-bank/status?messageReference=SANDY1706234567890ABC`

Checks the current status of a payment transaction.

**Response:**
```json
{
  "success": true,
  "data": {
    "messageReference": "SANDY1706234567890ABC",
    "status": "completed",
    "amount": 1000,
    "cached": false,
    "lastCheckedAt": "2024-01-26T10:30:45.123Z",
    "liveData": {
      "responseCode": "0",
      "responseDescription": "Success"
    }
  }
}
```

**Possible Statuses:**
- `pending` - Payment not yet confirmed
- `completed` - Payment successful
- `failed` - Payment failed
- `cancelled` - User cancelled the payment
- `timeout` - Payment timed out

---

### 3. Payment Callback
**POST** `/api/payments/coop-bank/callback`

Automatic callback from Co-operative Bank when payment is confirmed. This route is configured in the Co-op Bank dashboard.

**Callback Flow:**
1. User completes M-Pesa payment
2. Co-op Bank sends confirmation to callback URL
3. System updates transaction status
4. System credits user's wallet/account

---

## Frontend Usage

### Using the Payment Hook

```typescript
import { useCoopBankPayment } from '@/app/hooks/useCoopBankPayment';

function PaymentComponent() {
  const {
    loading,
    error,
    transactionId,
    messageReference,
    initiatePayment,
    pollTransactionStatus,
    reset,
  } = useCoopBankPayment();

  const handlePayment = async () => {
    // 1. Initiate STK Push
    const result = await initiatePayment({
      amount: 1000,
      phoneNumber: '0707919065',
      narration: 'Wallet Top-up',
      depositType: 'wallet',
    });

    if (!result.success) {
      console.error('Payment failed:', result.error);
      return;
    }

    console.log('STK Push initiated:', result.messageReference);

    // 2. Poll for payment confirmation
    const status = await pollTransactionStatus(result.messageReference!);

    if (status?.data?.status === 'completed') {
      console.log('✅ Payment successful!');
      // Redirect or update UI
    } else if (status?.data?.status === 'cancelled') {
      console.log('❌ Payment cancelled by user');
    }
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? 'Processing...' : 'Pay with M-Pesa'}
      </button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### Manual Status Checking

```typescript
const { checkStatus } = useCoopBankPayment();

const status = await checkStatus('SANDY1706234567890ABC');
console.log('Current status:', status.data?.status);
```

---

## Database Schema

### MpesaTransaction Model

```typescript
interface MpesaTransaction {
  _id: ObjectId;
  user_id: string;
  amount_cents: number;
  phone_number: string;
  source: 'coop_bank' | 'safaricom';
  status: 'initiated' | 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  merchant_request_id: string;
  checkout_request_id: string; // Message reference
  mpesa_receipt_number?: string;
  result_code: number;
  result_desc: string;
  callback_payload: any;
  callback_received_at?: Date;
  is_activation_payment: boolean;
  metadata: {
    deposit_type: 'wallet' | 'spin_wallet' | 'activation';
    message_reference: string;
    operator_txn_id: string;
    conversation_id: string;
    payment_method: string;
    initiated_at: string;
    callback_processed: boolean;
    callback_processed_at: string;
  };
  created_at: Date;
  updated_at: Date;
}
```

---

## Configuration in Co-operative Bank Dashboard

1. **Login** to Co-op Bank Developer Portal
2. **Navigate** to Registered Callbacks
3. **Add New Callback:**
   - **URL:** `https://your-domain.com/api/payments/coop-bank/callback`
   - **Event Type:** STK Push Response
   - **Active:** Yes
4. **Save** and note the callback ID

---

## Testing

### Sandbox Credentials
```
Client ID: MktDMtCfz_HvlqF3hSAzlcRd1LWUa
Client Secret: UVC7dc448JelmeρHovnfzV0VAIcca
Operator Code: SANDRA
Environment: sandbox
```

### Test Flow
```bash
# 1. Initiate payment
curl -X POST https://your-domain/api/payments/coop-bank/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "phoneNumber": "254707919065",
    "narration": "Test Payment",
    "depositType": "wallet"
  }'

# 2. Check status
curl https://your-domain/api/payments/coop-bank/status?messageReference=SANDY... \
  -H "Content-Type: application/json"
```

---

## Error Handling

### Common Error Codes

| Code | Meaning | Resolution |
|------|---------|-----------|
| `2001` | Timeout | Payment was not completed within time limit. User can retry. |
| `2002` | User Cancelled | User cancelled the M-Pesa prompt. |
| `2003` | Invalid Phone | Phone number format is incorrect. Validate and retry. |
| `2004` | Insufficient Funds | User doesn't have enough M-Pesa balance. |

### Retry Logic

The frontend hook includes exponential backoff:
- Starts with 2-second delay
- Increases by 1.5x each attempt
- Caps at 10 seconds
- Max 60 attempts = ~10 minutes polling window

---

## Security Considerations

1. **Validate Phone Numbers:** Use regex `/^254[17]\d{8}$/`
2. **Store Credentials:** Keep in environment variables, never commit
3. **HTTPS Only:** Callbacks must be over HTTPS
4. **Idempotency:** System prevents double-crediting with `callback_processed` flag
5. **Amount Limits:** Validate 1 KES ≤ amount ≤ 999,999 KES
6. **Rate Limiting:** Implement on payment endpoints to prevent abuse

---

## Monitoring & Logging

All payment operations log with `[CoopBank]`, `[API]`, or `[Callback]` prefixes:

```
[CoopBank] Fetching new access token...
[API] STK Push initiated successfully
[Callback] Payment processing completed successfully
```

Monitor these logs to track:
- Failed token refreshes
- Failed STK initiations
- Callback processing failures
- Duplicate payment attempts

---

## Fallback to Legacy M-Pesa (Safaricom)

If Co-op Bank integration fails, the system can fall back to legacy M-Pesa:

```typescript
// In deposit/payment component
const paymentMethods = [
  { id: 'coop_bank', name: 'M-Pesa via Co-op Bank' },
  { id: 'safaricom', name: 'M-Pesa (Legacy)' },
];
```

---

## Support & Troubleshooting

### Issue: "Token retrieval failed"
- Verify `COOP_BANK_CLIENT_ID` and `COOP_BANK_CLIENT_SECRET` are correct
- Check Co-op Bank API credentials haven't expired
- Ensure `COOP_BANK_ENVIRONMENT` matches API version

### Issue: "STK Push failed"
- Verify phone number format matches `^254[17]\d{8}$`
- Check amount is within valid range (1-999,999 KES)
- Ensure callback URL is public and HTTPS

### Issue: "Callback not received"
- Verify callback URL in Co-op Bank dashboard
- Check firewall/security groups allow Co-op Bank IPs
- Monitor logs for callback processing errors

---

## Implementation Checklist

- [ ] Add environment variables (`COOP_BANK_*`)
- [ ] Configure callback URL in Co-op Bank dashboard
- [ ] Test STK push initiation
- [ ] Test payment confirmation callback
- [ ] Test transaction status polling
- [ ] Test wallet crediting
- [ ] Test spin wallet crediting
- [ ] Test activation payment flow
- [ ] Implement error handling UI
- [ ] Set up monitoring/alerts
- [ ] Test with production Co-op Bank credentials
- [ ] Deploy to production
