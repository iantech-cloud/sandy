# M-PESA Daraja Integration Setup

This document guides you through setting up the M-PESA Daraja API integration for HustleHub Africa.

## Overview

The Daraja integration replaces the previous Co-op Bank payment system, allowing users to make payments via M-PESA (Safaricom's mobile money service).

## Prerequisites

1. **Safaricom Developer Account**: Sign up at https://developer.safaricom.co.ke
2. **Daraja Portal Access**: Create a Daraja account
3. **Sandbox Environment**: Create a sandbox app to get credentials

## Getting Started

### Step 1: Create a Safaricom Developer Account

1. Visit https://developer.safaricom.co.ke
2. Sign up with your email
3. Verify your email address
4. Complete your profile

### Step 2: Create a Daraja App

1. Log in to the Developer Portal
2. Navigate to "My Apps" or "Daraja Portal"
3. Create a new app in the sandbox environment
4. Get your credentials:
   - **Consumer Key** (API Key)
   - **Consumer Secret** (API Secret)
   - **Business Short Code** (Your merchant code)
   - **Passkey** (Used to generate password for token)

### Step 3: Configure Environment Variables

Add the following to your `.env.local` or `.env` file:

```env
# M-PESA Daraja Configuration
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here
DARAJA_BUSINESS_SHORT_CODE=your_short_code_here
DARAJA_PASSKEY=your_passkey_here

# API URLs (change to production URLs when deploying)
DARAJA_BASE_URL=https://sandbox.safaricom.co.ke
DARAJA_OAUTH_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query

# Base URL for callbacks
BASE_URL=http://localhost:3000  # Update for production
```

## API Endpoints

### 1. Generate Access Token

**Endpoint**: `GET /api/payments/daraja/token`

Returns an OAuth access token. This is automatically called by the service.

### 2. Initiate Payment (STK Push)

**Endpoint**: `POST /api/payments/daraja/stkpush`

Sends an M-PESA prompt to the customer's phone.

**Request**:
```json
{
  "amount": 100,
  "phoneNumber": "254791234567",
  "accountReference": "INV001",
  "description": "Payment for freelance work"
}
```

**Response**:
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_...",
  "merchantRequestId": "123-456-789",
  "message": "Payment initiated successfully"
}
```

### 3. Check Transaction Status

**Endpoint**: `POST /api/payments/daraja/status`

Query the status of a payment.

**Request**:
```json
{
  "checkoutRequestId": "ws_CO_..."
}
```

**Response**:
```json
{
  "success": true,
  "resultCode": "0",
  "resultDesc": "The service request has been accepted successfully",
  "amount": 100,
  "mpesaReceiptNumber": "PEG4K1GTRY"
}
```

### 4. Webhook Callback

**Endpoint**: `POST /api/payments/daraja/callback`

Safaricom sends payment status updates to this endpoint. Configure this URL in your Daraja dashboard.

## Implementation Example

```typescript
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

// Initiate a payment
const response = await MpesaDarajaService.initiatePayment(
  {
    amount: 500,
    phoneNumber: '0791234567',
    accountReference: 'JOB123',
    description: 'Payment for completed job',
  },
  'https://yoursite.com/api/payments/daraja/callback'
);

if (response.success) {
  console.log('STK Push sent:', response.checkoutRequestId);
} else {
  console.error('Payment failed:', response.error);
}
```

## Testing in Sandbox

### Using the Simulator

1. Log in to Daraja Portal
2. Go to "Simulator" section
3. Select your app
4. Test authentication and payment endpoints

### Test Phone Numbers

Safaricom provides test phone numbers:
- `254700000000` - Test phone for sandbox
- Amount: Any amount between KES 1 and KES 10,000

### Webhook Testing

Use Postman or similar tool to simulate callbacks:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "16813-3651308-1",
      "CheckoutRequestID": "ws_CO_191220191020375734",
      "ResultCode": 0,
      "ResultDesc": "The service request has been accepted successfully",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 500
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "PEG4K1GTRY"
          },
          {
            "Name": "PhoneNumber",
            "Value": "254700000000"
          }
        ]
      }
    }
  }
}
```

## Production Migration

When moving to production:

### 1. Update Environment Variables

```env
# Change to production URLs
DARAJA_BASE_URL=https://api.safaricom.co.ke
DARAJA_OAUTH_URL=https://api.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query

# Use your actual domain
BASE_URL=https://yourdomain.com
```

### 2. Configure Callback URL

In Daraja dashboard, update the callback URL to your production URL.

### 3. Test with Real Users

1. Get production credentials from Safaricom (different from sandbox)
2. Test with small amounts first
3. Monitor logs for any issues

## Troubleshooting

### Issue: "Invalid grant type passed"

**Solution**: Ensure `grant_type=client_credentials` is in the OAuth request.

### Issue: "Token authentication failed"

**Solution**: Check that Consumer Key and Secret are correctly configured.

### Issue: "Callback not received"

**Solution**: 
- Verify callback URL is publicly accessible
- Check firewall/security settings
- Use `BASE_URL` environment variable correctly
- Monitor logs for incoming requests

### Issue: "Invalid phone number format"

**Solution**: Phone numbers should be in format `254XXXXXXXXX` (country code + 10 digits).

## Security Considerations

1. **Never expose credentials**: Keep Consumer Key and Secret in environment variables
2. **Validate callbacks**: Verify callback requests are from Safaricom
3. **HTTPS only**: Always use HTTPS in production
4. **Rate limiting**: Implement rate limiting on payment endpoints
5. **Audit logs**: Log all payment transactions for compliance

## Additional Resources

- [Safaricom Developer Portal](https://developer.safaricom.co.ke)
- [Daraja API Documentation](https://developer.safaricom.co.ke/docs)
- [Postman Collection](https://developer.safaricom.co.ke/resources)
- [API Support](mailto:apisupport@safaricom.co.ke)
