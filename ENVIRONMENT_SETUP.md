# Environment Setup Guide - M-PESA Daraja Integration

## Quick Start

This guide explains what environment variables you need to add to make the M-PESA Daraja integration work.

### What You Need (Minimum)

For **STK Push (customer payments only)**:
```env
DARAJA_CONSUMER_KEY=your-key
DARAJA_CONSUMER_SECRET=your-secret
DARAJA_BUSINESS_SHORT_CODE=600123
DARAJA_PASSKEY=your-passkey
DARAJA_CALLBACK_URL=https://your-domain.com/api/payments/daraja/callback
```

That's it! STK Push is the most common payment type and requires only these variables.

### Get Credentials

1. Go to https://developer.safaricom.co.ke/
2. Create a Daraja account
3. Create a new sandbox app
4. You'll get **Consumer Key** and **Consumer Secret** - these are your OAuth credentials
5. Create an M-PESA test app to get **Passkey** and **Business Short Code**

### Optional: For Payouts & Transfers

If you want to implement B2C (payouts), B2B (business transfers), or other features:

```env
# Only add if implementing payouts
DARAJA_INITIATOR_NAME=api_operator
DARAJA_INITIATOR_PASSWORD=your-encrypted-password

# Public keys for encryption (if implementing B2C/B2B)
MPESA_PUBLIC_KEY_SANDBOX=...
MPESA_PUBLIC_KEY_PRODUCTION=...
```

**Important**: B2C and B2B features are optional. Start with STK Push first.

## Required Environment Variables

### STK Push (Customer Payments)

| Variable | Example | Required | Description |
|----------|---------|----------|-------------|
| `DARAJA_CONSUMER_KEY` | `x1A2b3C4d5E6f` | Yes | OAuth consumer key from Daraja |
| `DARAJA_CONSUMER_SECRET` | `AbC123DeF456GhI` | Yes | OAuth consumer secret from Daraja |
| `DARAJA_BUSINESS_SHORT_CODE` | `600123` | Yes | Your M-PESA business short code |
| `DARAJA_PASSKEY` | `bfb279f9437...` | Yes | M-PESA passkey for STK Push |
| `DARAJA_CALLBACK_URL` | `https://...api/payments/daraja/callback` | Yes | Where M-PESA sends transaction notifications |

### Optional: URLs (Defaults Provided)

These have defaults but can be overridden:

```env
# OAuth endpoints
DARAJA_BASE_URL=https://sandbox.safaricom.co.ke
DARAJA_OAUTH_URL=https://sandbox.safaricom.co.ke/oauth/v1/generate
DARAJA_STK_PUSH_URL=https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest
DARAJA_STATUS_CHECK_URL=https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query

# Callback URLs
DARAJA_C2B_VALIDATION_URL=https://your-domain.com/api/payments/daraja/c2b/validate
DARAJA_C2B_CONFIRMATION_URL=https://your-domain.com/api/payments/daraja/c2b/confirm
DARAJA_B2C_RESULT_URL=https://your-domain.com/api/payments/daraja/callback
DARAJA_B2B_RESULT_URL=https://your-domain.com/api/payments/daraja/callback
```

### Optional: Payout Features (B2C, B2B)

Only add if implementing business payouts:

```env
# For B2C, B2B, Balance Query, Reversal
DARAJA_INITIATOR_NAME=api_operator
DARAJA_INITIATOR_PASSWORD=your-encrypted-password

# Encryption keys for security credentials
MPESA_PUBLIC_KEY_SANDBOX=-----BEGIN PUBLIC KEY-----\n...
MPESA_PUBLIC_KEY_PRODUCTION=-----BEGIN PUBLIC KEY-----\n...
```

## Callback URL Registration

### Critical: Register with Safaricom

After setting `DARAJA_CALLBACK_URL`, you **must** register it with Safaricom:

1. Log in to https://developer.safaricom.co.ke/
2. Go to your app settings
3. In "API Configuration" section, paste your callback URL
4. Daraja will test it - ensure it responds with 200 OK
5. Save changes

### Testing Locally with ngrok

To test callbacks on your laptop before deployment:

```bash
# Install ngrok: https://ngrok.com/
ngrok http 3000

# You'll get a URL like: https://abc123.ngrok.io
# Add to .env:
DARAJA_CALLBACK_URL=https://abc123.ngrok.io/api/payments/daraja/callback

# Register this temporary URL in Daraja portal for testing
```

### Production Deployment

When going live:

1. Get production credentials from Daraja
2. Update all URLs to use your production domain
3. Register production callback URL with Daraja
4. Whitelist Safaricom IPs (listed in DARAJA_COMPLETE_SETUP.md)
5. Switch Daraja app from Sandbox to Production
6. Update all environment variables with production values

## Migration from Co-op Bank

The old Co-op Bank variables are **no longer used**:

```env
# These are DEPRECATED - can be removed
COOP_BANK_BASIC_AUTH=...  # NOT USED
COOP_BANK_OPERATOR_CODE=... # NOT USED
```

All payment functionality now uses M-PESA Daraja.

## Environment Setup Steps

### Step 1: Get Daraja Credentials

Go to https://developer.safaricom.co.ke/:
- Create account
- Create new app → Get Consumer Key + Secret
- Create M-PESA test app → Get Passkey + Short Code

### Step 2: Update `.env.local` or `.env` File

```env
# Required for STK Push
DARAJA_CONSUMER_KEY=your-consumer-key
DARAJA_CONSUMER_SECRET=your-consumer-secret
DARAJA_BUSINESS_SHORT_CODE=600123
DARAJA_PASSKEY=your-passkey

# Required for callbacks
DARAJA_CALLBACK_URL=https://your-domain.com/api/payments/daraja/callback
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Step 3: Register Callback URL

1. In Daraja portal, go to "API Configuration"
2. Paste your callback URL
3. Test that it responds with 200 OK
4. Save

### Step 4: Test Payment Flow

1. Try making a test payment
2. Check if you receive callback in logs
3. Verify `/api/payments/daraja/callback` receives data

### Step 5: Go Live

When ready for production:
1. Get production credentials
2. Switch Daraja app from Sandbox to Production
3. Update all URLs to production domain
4. Update environment variables
5. Re-register callback URLs
6. Deploy to production

## Troubleshooting

### "Daraja credentials not configured"

**Problem**: Getting error about missing credentials

**Solution**: Check that `DARAJA_CONSUMER_KEY` and `DARAJA_CONSUMER_SECRET` are set in `.env` and app can access them.

```bash
# Verify in deployed app logs:
console.log('Key:', process.env.DARAJA_CONSUMER_KEY) // Should show partial key
```

### "Callback URL not responding"

**Problem**: Daraja can't reach your callback URL

**Solution**:
- Ensure URL is HTTPS (not HTTP) for production
- Use ngrok for local testing
- Check firewall allows inbound from Safaricom IPs
- Verify callback endpoint returns `200 OK`

### "Invalid phone number"

**Problem**: Phone number format error

**Solution**: 
- Use Kenyan format: 254XXXXXXXXX or 07XXXXXXXXX or 01XXXXXXXXX
- App automatically normalizes to 254XXXXXXXXX format
- Example: `0712345678` → `254712345678`

### "Transaction callback not received"

**Problem**: Payment completes but callback doesn't arrive

**Solution**:
1. Check callback URL is registered with Daraja
2. Verify URL is publicly accessible
3. Check app logs for incoming requests
4. Ensure endpoint returns `200 OK` response
5. Whitelist Safaricom IPs if using firewall
6. Use ngrok for local testing

## What Each Endpoint Does

### Required for STK Push
- `POST /api/payments/daraja/stkpush` - Initiate payment prompt
- `GET /api/payments/daraja/status` - Check payment status
- `POST /api/payments/daraja/callback` - Receive payment results

### Optional for Future Features
- `POST /api/payments/daraja/b2c` - Send money to customer
- `POST /api/payments/daraja/b2b` - Business transfers
- `GET /api/payments/daraja/balance` - Check account balance
- `POST /api/payments/daraja/c2b/register` - Setup C2B
- `POST /api/payments/daraja/c2b/validate` - Validate C2B payment
- `POST /api/payments/daraja/c2b/confirm` - Confirm C2B payment

## Support & Resources

- Daraja Docs: https://developer.safaricom.co.ke/docs
- API Reference: https://developer.safaricom.co.ke/api
- Sandbox Testing: Use sandbox credentials to test without real money
- Production: Switch to production when ready to accept live payments

## Security Notes

1. **Never commit `.env` files** - They contain secrets
2. **Consumer Secret is sensitive** - Treat like a password
3. **Callback URLs must be HTTPS** - Never HTTP in production
4. **Whitelist Safaricom IPs** - Only accept callbacks from legitimate sources
5. **Store public keys securely** - Use environment variables, not code
6. **Validate all inputs** - Phone numbers, amounts, etc.

## Quick Reference

### Most Common: STK Push Only

```env
DARAJA_CONSUMER_KEY=xxx
DARAJA_CONSUMER_SECRET=xxx
DARAJA_BUSINESS_SHORT_CODE=600123
DARAJA_PASSKEY=xxx
DARAJA_CALLBACK_URL=https://your-domain.com/api/payments/daraja/callback
```

### Development: Local Testing

```env
# Same as above, but use ngrok URL:
DARAJA_CALLBACK_URL=https://abc123.ngrok.io/api/payments/daraja/callback
```

### Production: Live Payments

```env
# Use production credentials and URLs
DARAJA_CONSUMER_KEY=prod-key
DARAJA_CONSUMER_SECRET=prod-secret
DARAJA_CALLBACK_URL=https://hustlehubafrica.com/api/payments/daraja/callback
# (Same for other variables)
```

## Need Help?

Check these files for more details:
- `docs/DARAJA_COMPLETE_SETUP.md` - Full implementation guide
- `MPESA_DARAJA_README.md` - Integration overview
- `app/lib/utils/callback-registration.ts` - Callback validation

Questions? Check the Daraja portal: https://developer.safaricom.co.ke/
