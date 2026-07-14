# M-PESA Daraja Complete Integration Guide

This guide covers the complete implementation of Safaricom M-PESA Daraja APIs for HustleHub Africa, including STK Push, C2B (Spin Wallet/Chat Foreigners), B2C (Wallet Payouts), and B2B payments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [API Types](#api-types)
4. [Implementation Guide](#implementation-guide)
5. [Production Deployment](#production-deployment)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

1. **Safaricom Daraja Account**
   - Register at https://developer.safaricom.co.ke
   - Create a Daraja app in the portal
   - Get Consumer Key and Consumer Secret

2. **M-PESA Business Account**
   - PayBill number OR
   - Buy Goods number OR
   - Till Number

3. **SSL Certificate**
   - Valid HTTPS certificate for your domain
   - Required for production deployments

4. **IP Whitelisting Access**
   - Access to your server/network firewall
   - To whitelist Safaricom IPs for callbacks

---

## Environment Setup

### 1. Add Environment Variables

Create or update `.env.local` (development) or set in Vercel (production):

```env
# OAuth Credentials (from Daraja Portal)
DARAJA_CONSUMER_KEY=your_consumer_key_here
DARAJA_CONSUMER_SECRET=your_consumer_secret_here

# Business Credentials
DARAJA_BUSINESS_SHORT_CODE=600123
DARAJA_PASSKEY=your_passkey_here

# Initiator Credentials (for B2C, B2B, Balance, Reversal)
DARAJA_INITIATOR_NAME=api_operator
DARAJA_INITIATOR_PASSWORD=your_initiator_password_here

# URLs
DARAJA_BASE_URL=https://sandbox.safaricom.co.ke  # Change to production URL when going live
DARAJA_OAUTH_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query

# M-PESA Public Key Certificates (for B2C, B2B, Balance, Reversal)
# These are used to encrypt security credentials
MPESA_PUBLIC_KEY_SANDBOX=-----BEGIN CERTIFICATE-----
MIIDdjCCAlogAwIBAgIRAK8YM7nzwDQdoJHKBhGxbm8wDQYJKoZIhvcNAQELBQAw
...
-----END CERTIFICATE-----

MPESA_PUBLIC_KEY_PRODUCTION=-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
```

### 2. Get Public Key Certificates

Download from Daraja Portal:
- **Sandbox**: Daraja > Settings > Security Credentials > Download Sandbox Certificate
- **Production**: Daraja > Settings > Security Credentials > Download Production Certificate

Convert to PEM format and add to environment variables.

---

## API Types

### 1. STK Push (M-PESA Express) - Activation
**Purpose**: Prompt user to enter M-PESA PIN on their phone

**Endpoint**: `POST /api/payments/daraja/stkpush`

**Use Cases**:
- Payment collection from customers
- One-time purchases
- Subscription payments
- Gig/service payments

**Request**:
```json
{
  "phoneNumber": "254712345678",
  "amount": 5000,
  "accountReference": "ORDER-123",
  "description": "Gig service payment",
  "callbackUrl": "https://yourdomain.com/api/payments/daraja/callback"
}
```

---

### 2. C2B Registration (Customer to Business) - Spin Wallet / Chat Foreigners

#### Step 1: Register Short Code
**Endpoint**: `POST /api/payments/daraja/c2b/register`

Registers your business short code to accept payments. Do this once during setup.

```json
{
  "shortCode": "600123",
  "validationUrl": "https://yourdomain.com/api/payments/daraja/c2b/validate",
  "confirmationUrl": "https://yourdomain.com/api/payments/daraja/c2b/confirm",
  "responseType": "Completed"
}
```

#### Step 2: Handle Validation
**Endpoint**: `POST /api/payments/daraja/c2b/validate` (receives webhook from Safaricom)

Safaricom calls this when customer initiates payment. Validate and return:
- `ResultCode: 0` - Accept payment
- `ResultCode: 1` - Reject payment

**Validation Logic**:
- Verify bill reference exists
- Check account status
- Validate amount
- Detect fraud

#### Step 3: Handle Confirmation
**Endpoint**: `POST /api/payments/daraja/c2b/confirm` (receives webhook from Safaricom)

Safaricom calls this after money is received. Process the payment:
- Update payment status
- Mark invoice as paid
- Credit customer account
- Send confirmation

---

### 3. B2C Payments (Business to Customer) - Spin Wallet Payouts

**Purpose**: Send money from your business account to customer M-PESA wallets

**Endpoint**: `POST /api/payments/daraja/b2c`

**Use Cases**:
- Salary disbursement
- Freelancer/gig worker payments
- Wallet top-ups
- Promotional credits
- Refunds

**Command IDs**:
- `SalaryPayment`: Regular salary
- `BusinessPayment`: General business payment
- `PromotionPayment`: Promotional funds

**Request**:
```json
{
  "phoneNumber": "254712345678",
  "amount": 5000,
  "commandId": "BusinessPayment",
  "remarks": "Gig completion payment",
  "callbackUrl": "https://yourdomain.com/api/payments/daraja/callback"
}
```

**Flow**:
1. B2C request sent to Safaricom
2. Money deducted from your account
3. Money added to customer's M-PESA wallet
4. Callback received with status

---

### 4. B2B Payments (Business to Business)

**Purpose**: Transfer funds between business accounts

**Endpoint**: `POST /api/payments/daraja/b2b`

**Command IDs**:
- `BusinessPayBill`: Pay bill to another business
- `MerchantToMerchantTransfer`: Merchant transfer
- `DisburseFundsToBusiness`: Disburse to business account

**Request**:
```json
{
  "amount": 50000,
  "partyA": "600123",
  "partyB": "600456",
  "accountReference": "INV-2024-001",
  "remarks": "Payment for services",
  "commandId": "BusinessPayBill",
  "callbackUrl": "https://yourdomain.com/api/payments/daraja/callback"
}
```

---

### 5. Account Balance Query

**Purpose**: Check current M-PESA account balance

**Endpoint**: `GET /api/payments/daraja/balance?shortCode=600123&callbackUrl=...`

Result is sent asynchronously to your callback URL.

---

### 6. Transaction Reversal

**Purpose**: Reverse a previously completed transaction

**Not yet implemented** - Will be added for production.

---

## Implementation Guide

### 1. STK Push Implementation

```typescript
// Frontend (e.g., checkout button)
const handlePayment = async () => {
  const response = await fetch('/api/payments/daraja/stkpush', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber: '254712345678',
      amount: 5000,
      accountReference: 'ORDER-123',
      description: 'Gig payment',
      callbackUrl: `${window.location.origin}/api/payments/daraja/callback`
    })
  });
  
  const result = await response.json();
  console.log(result);
  // Show loading: "Waiting for M-PESA PIN prompt..."
};
```

### 2. C2B Implementation

**Initial Setup** (Run once):
```bash
curl -X POST https://yourdomain.com/api/payments/daraja/c2b/register \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "shortCode": "600123",
    "validationUrl": "https://yourdomain.com/api/payments/daraja/c2b/validate",
    "confirmationUrl": "https://yourdomain.com/api/payments/daraja/c2b/confirm"
  }'
```

**Payment Flow**:
1. Customer dials `*714*686#` (example)
2. Selects "Pay Bill"
3. Enters your short code (600123)
4. Enters invoice number / account reference
5. Enters amount
6. Safaricom calls your validation endpoint → validate → respond
7. Safaricom calls your confirmation endpoint → process → respond

### 3. B2C Implementation

```typescript
// Backend (Node.js/TypeScript)
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

// Send payment to gig worker
const result = await MpesaDarajaService.initiateB2CPayment(
  '254712345678',        // phone number
  5000,                  // amount in KES
  'BusinessPayment',     // command ID
  'Payment for completed gig',  // remarks
  'https://yourdomain.com/api/payments/daraja/callback'  // callback URL
);

console.log(result);
// { ConversationID: "...", OriginatorConversationID: "...", ResponseCode: "0" }
```

---

## Production Deployment

### 1. Environment Variables

Update all URLs from `sandbox.safaricom.co.ke` to production:

```env
DARAJA_BASE_URL=https://api.safaricom.co.ke
DARAJA_OAUTH_URL=https://api.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query
```

Update production certificate:
```env
MPESA_PUBLIC_KEY_PRODUCTION=-----BEGIN CERTIFICATE-----
...
-----END CERTIFICATE-----
```

### 2. Callback URL Registration

Register your callback URLs in Daraja Portal:
- STK Push callback: `https://yourdomain.com/api/payments/daraja/callback`
- C2B validation: `https://yourdomain.com/api/payments/daraja/c2b/validate`
- C2B confirmation: `https://yourdomain.com/api/payments/daraja/c2b/confirm`
- B2C callback: `https://yourdomain.com/api/payments/daraja/callback`

### 3. IP Whitelisting

Whitelist Safaricom IPs in your firewall to accept callbacks:

```
196.201.214.200
196.201.214.206
196.201.213.114
196.201.214.207
196.201.214.208
196.201.213.44
196.201.212.127
196.201.212.138
196.201.212.129
196.201.212.136
196.201.212.74
196.201.212.69
```

### 4. SSL Certificate

Ensure your domain has a valid SSL certificate:
- Use Let's Encrypt (free)
- Or purchase commercial certificate
- Verify HTTPS works: `https://yourdomain.com`

### 5. Database Schema

Create tables for payment tracking:

```sql
-- Payments table
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20),  -- pending, completed, failed, cancelled
  result_code INTEGER,
  mpesa_receipt_number TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- C2B Payments
CREATE TABLE c2b_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_id TEXT UNIQUE,
  phone_number TEXT,
  amount DECIMAL(10, 2),
  bill_ref TEXT,
  status VARCHAR(20),  -- validated, confirmed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- B2C Payments
CREATE TABLE b2c_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT UNIQUE,
  originator_conversation_id TEXT,
  recipient_phone TEXT,
  amount DECIMAL(10, 2),
  status VARCHAR(20),  -- initiated, completed, failed
  result_code INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Testing

### 1. Sandbox Testing

Use Safaricom's simulator to test:
1. Go to Daraja Portal > Tools > Simulator
2. Select your app
3. Choose API to test
4. Run test request
5. Check response

### 2. Local Testing with Ngrok

For testing callbacks locally:

```bash
# Start your dev server
npm run dev

# In another terminal, expose your local server
ngrok http 3000

# Update callback URLs to use ngrok URL
# https://abc123.ngrok.io/api/payments/daraja/callback
```

### 3. Test Scenarios

**STK Push**:
1. Call API with test phone number
2. Look for M-PESA prompt
3. Complete or cancel
4. Verify callback received

**C2B**:
1. Register short code
2. Dial USSD code
3. Complete payment
4. Verify validation and confirmation called

**B2C**:
1. Call API with recipient phone
2. Recipient receives M-PESA notification
3. Verify callback with status

---

## Troubleshooting

### OAuth Token Errors

**Error**: "Invalid grant type passed"
- **Cause**: Wrong grant_type parameter
- **Solution**: Ensure grant_type is `client_credentials`

**Error**: "Invalid Consumer Key or Secret"
- **Cause**: Wrong credentials
- **Solution**: Verify in Daraja Portal > My Apps

### Payment Failures

**Error**: "Invalid phone number"
- **Cause**: Wrong format
- **Solution**: Use `254XXXXXXXXX` format

**Error**: "Insufficient balance"
- **Cause**: Account has insufficient funds
- **Solution**: Top-up your M-PESA account

### Callback Issues

**Callbacks not received**:
1. Verify callback URL is public (HTTPS)
2. Whitelist Safaricom IPs in firewall
3. Check server logs
4. Verify callback URL in Daraja Portal

**"Callback processing error"**:
1. Check endpoint response is JSON
2. Verify your endpoint returns 200 OK
3. Check for unhandled exceptions

### Security Issues

**Error**: "Invalid security credential"
- **Cause**: Wrong encryption or public key
- **Solution**: Verify public key certificate matches environment

**Error**: "Invalid signature"
- **Cause**: Credentials encrypted with wrong key
- **Solution**: Use correct sandbox/production certificate

---

## Support

For issues:
1. Check error code in Daraja docs
2. Review console logs
3. Contact Safaricom: `apisupport@safaricom.co.ke`
4. Visit: https://developer.safaricom.co.ke/support

---

## Resources

- [Safaricom Daraja Documentation](https://developer.safaricom.co.ke/docs)
- [M-PESA API Guide](https://developer.safaricom.co.ke/docs/mpesa)
- [Getting Started Guide](https://developer.safaricom.co.ke/docs/getting-started)
- [API Simulator](https://developer.safaricom.co.ke/tools/simulator)
