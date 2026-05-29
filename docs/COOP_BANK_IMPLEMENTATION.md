# Co-operative Bank M-Pesa Integration Guide

## Overview

This guide covers the full implementation of Co-operative Bank's M-Pesa STK push payment integration for HustleHub Africa.

## Environment Variables

Add these to your `.env.local` or Vercel project settings:

```bash
# Co-operative Bank Credentials
COOP_BANK_CLIENT_ID=your-coop-bank-client-id
COOP_BANK_CLIENT_SECRET=your-coop-bank-client-secret
COOP_BANK_OPERATOR_CODE=your-operator-code
COOP_BANK_ENVIRONMENT=sandbox  # or production
```

## Integration Architecture

### 1. **Service Layer** (`app/lib/services/coop-bank.ts`)
- Handles authentication with Co-op Bank API
- Manages token generation and caching
- Implements STK push, status check, and callback processing

### 2. **API Endpoints**

#### STK Push - Initiate Payment
```
POST /api/payments/coop-bank/stk-push
Content-Type: application/json

{
  "amount": 1000,
  "phoneNumber": "254707919065",
  "narration": "Payment for services"
}

Response:
{
  "success": true,
  "messageReference": "ref123456",
  "data": {
    "conversationID": "abc123"
  }
}
```

#### Status Check - Poll Transaction Status
```
POST /api/payments/coop-bank/status
Content-Type: application/json

{
  "messageReference": "ref123456"
}

Response:
{
  "success": true,
  "data": {
    "status": "completed",
    "receiptNumber": "LK123ABCD",
    "amount": 1000
  }
}
```

#### Callback - Receive Payment Notifications
```
POST /api/payments/coop-bank/callback
X-Callback-Token: signature

Body:
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0,
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 1000 },
          { "Name": "MpesaReceiptNumber", "Value": "LK123ABCD" },
          { "Name": "TransactionDate", "Value": "20260528092225" },
          { "Name": "PhoneNumber", "Value": "254707919065" }
        ]
      }
    }
  }
}
```

### 3. **Frontend Hook** (`app/hooks/useCoopBankPayment.ts`)
React hook for managing payment flows:

```typescript
const { initiatePayment, isLoading, error } = useCoopBankPayment();

const result = await initiatePayment({
  amount: 1000,
  phoneNumber: "254707919065",
  narration: "Payment description"
});
```

### 4. **UI Component** (`app/components/CoopBankPaymentButton.tsx`)
Ready-to-use payment button:

```typescript
<CoopBankPaymentButton
  amount={1000}
  phoneNumber="254707919065"
  narration="Payment for services"
  onSuccess={(ref) => console.log('Payment initiated:', ref)}
  onError={(err) => console.error('Payment failed:', err)}
/>
```

## Payment Flow

1. **User Initiates Payment**
   - User enters amount and phone number
   - Frontend calls `/api/payments/coop-bank/stk-push`

2. **STK Prompt Sent to M-Pesa**
   - Co-op Bank API receives request with Bearer token
   - M-Pesa STK prompt appears on customer's phone
   - Customer enters PIN to authorize

3. **Real-time Callback**
   - M-Pesa processes transaction
   - Co-op Bank sends callback to `/api/payments/coop-bank/callback`
   - Callback updates transaction status in database

4. **Status Polling (Optional)**
   - Frontend can poll `/api/payments/coop-bank/status`
   - Returns transaction status: pending, completed, failed, cancelled

## Key Features

✓ **Automatic Token Management** - Tokens cached and refreshed automatically
✓ **Error Handling** - Comprehensive error messages and retry logic
✓ **Callback Verification** - Validates callback authenticity
✓ **Type Safety** - Full TypeScript support with complete types
✓ **Environment-Based Config** - Sandbox and production support
✓ **Phone Number Validation** - Ensures proper Kenyan format (254XXXXXXXXX)
✓ **Amount Validation** - Minimum amount checking
✓ **Unique References** - Generates unique MessageReference for each transaction

## Usage Examples

### Basic Payment Button
```tsx
import { CoopBankPaymentButton } from '@/components/CoopBankPaymentButton';

export function CheckoutPage() {
  return (
    <CoopBankPaymentButton
      amount={5000}
      phoneNumber="254707919065"
      narration="Course subscription"
      onSuccess={(ref) => {
        // Handle success - e.g., redirect to confirmation page
        router.push(`/payment/success/${ref}`);
      }}
    />
  );
}
```

### Manual Payment Initiation
```tsx
import { useCoopBankPayment } from '@/hooks/useCoopBankPayment';

export function CustomPayment() {
  const { initiatePayment, isLoading, error } = useCoopBankPayment();

  const handleCustomPayment = async () => {
    const result = await initiatePayment({
      amount: 10000,
      phoneNumber: userPhone,
      narration: "Custom transaction"
    });

    if (result.success) {
      console.log('Transaction reference:', result.messageReference);
    }
  };

  return <button onClick={handleCustomPayment}>Pay Now</button>;
}
```

### Check Transaction Status
```tsx
const { initiatePayment } = useCoopBankPayment();

// Get transaction status
const statusResponse = await fetch('/api/payments/coop-bank/status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messageReference: 'ref123456' })
});

const { data } = await statusResponse.json();
console.log('Transaction status:', data.status); // pending, completed, failed, cancelled
```

## Database Schema (Recommended)

Store transactions for audit and reconciliation:

```sql
CREATE TABLE coop_bank_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  message_reference VARCHAR(255) UNIQUE NOT NULL,
  amount INTEGER NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  status VARCHAR(50) NOT NULL,
  mpesa_receipt_number VARCHAR(50),
  result_code INTEGER,
  result_description TEXT,
  callback_received BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_message_reference ON coop_bank_transactions(message_reference);
CREATE INDEX idx_user_id ON coop_bank_transactions(user_id);
CREATE INDEX idx_status ON coop_bank_transactions(status);
```

## Callbacks Configuration

### Register Callback URL
In Co-op Bank Portal:
1. Go to API Settings → Callbacks
2. Register your callback URL: `https://hustlehubafrica.com/api/payments/coop-bank/callback`
3. Ensure your server is publicly accessible and accepts HTTPS

### Callback Signature Verification
The integration validates callback signatures to prevent spoofing:
- Extract signature from `X-Callback-Token` header
- Verify against Co-op Bank's public key

## Testing

Use the demo page to test the integration:
```
GET /demo/coop-bank-payment
```

Test with these credentials:
- Amount: Any value (minimum 1 KES)
- Phone: 254707919065 (or your test number)
- Environment: sandbox (for testing)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Invalid token" | Check COOP_BANK_CLIENT_ID and CLIENT_SECRET are correct |
| "Invalid phone number" | Ensure format is 254XXXXXXXXX |
| "Callback not received" | Verify callback URL is publicly accessible and HTTPS |
| "STK prompt not shown" | Check phone number is valid M-Pesa registered number |
| "CORS errors" | Callbacks should be server-to-server, not browser |

## Security Considerations

1. **Never expose credentials** - Store in environment variables only
2. **Validate callbacks** - Always verify callback signatures
3. **Use HTTPS** - All API communication must be encrypted
4. **Rate limiting** - Implement rate limits on payment endpoints
5. **Amount validation** - Validate amounts on backend before processing
6. **Phone validation** - Sanitize and validate phone numbers

## Support

For issues with the Co-op Bank API:
- Co-op Bank Developer Portal: https://developer.co-opbank.co.ke
- Documentation: Check the API reference section

For application issues:
- Review logs in `/app/api/payments/coop-bank/` routes
- Check environment variables are set correctly
- Verify callback URL configuration in Co-op Bank portal
