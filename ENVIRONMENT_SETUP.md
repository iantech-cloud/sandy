# Environment Configuration Guide

## Problem: M-Pesa Credentials Not Working

Your `.env.local` file contains **string literals** instead of **actual credential values**:

```env
❌ WRONG:
MPESA_CONSUMER_KEY=process.env.MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET=process.env.MPESA_CONSUMER_SECRET

✅ CORRECT:
MPESA_CONSUMER_KEY=your_actual_key_from_daraja
MPESA_CONSUMER_SECRET=your_actual_secret_from_daraja
```

The system reads the literal string `"process.env.MPESA_CONSUMER_KEY"` as a value, not as a reference to an environment variable.

## How to Fix

### 1. Get M-Pesa Daraja Credentials

Go to [Safaricom Daraja Portal](https://developer.safaricom.co.ke/) and:
- Create an application
- Get your **Consumer Key** and **Consumer Secret**
- Get your **Passkey**
- Get your **Short Code** (usually provided: 4182501 for sandbox, different for production)

### 2. Update `.env.local`

Replace placeholders with actual values:

```env
# M-PESA Configuration
MPESA_CONSUMER_KEY=your_consumer_key_1234567890abcdef
MPESA_CONSUMER_SECRET=your_consumer_secret_1234567890abcdef
MPESA_SHORT_CODE=4182501
MPESA_PASS_KEY=your_passkey_1234567890abcdef
MPESA_ENVIRONMENT=sandbox  # Use 'sandbox' for testing, 'production' for live
```

### 3. Other Required Credentials

Also update these in `.env.local`:

```env
# Authentication
NEXTAUTH_SECRET=your_actual_secret_key  # Generate with: openssl rand -base64 32

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Email
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM_ADDRESS=noreply@yourapp.com

# Other APIs
NVIDIA_API_KEY=your_nvidia_key
GEMINI_API_KEY=your_gemini_key
```

### 4. Verify Configuration

After updating, restart your dev server. The console will show:

```
✅ M-Pesa Daraja service initialized with ShortCode: 4182501
```

Or if still missing:

```
❌ [v0] M-Pesa Configuration: {
  hasConsumerKey: false,
  hasConsumerSecret: false,
  hasShortCode: true,
  hasPasskey: false,
  missingCredentials: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASS_KEY']
}
```

## Environment Variable Rules

- `.env.local` contains **actual values**
- `.env.example` shows **placeholder examples**
- `process.env.VAR_NAME` in `.env.local` is treated as a literal string, not a reference
- Never commit `.env.local` to git

## For Vercel Deployment

Set environment variables in Vercel Project Settings → Environment Variables:

```
MPESA_CONSUMER_KEY=production_consumer_key
MPESA_CONSUMER_SECRET=production_consumer_secret
MPESA_SHORT_CODE=short_code_for_production
MPESA_PASS_KEY=production_passkey
MPESA_ENVIRONMENT=production
MONGODB_URI=production_database_uri
NEXTAUTH_SECRET=production_secret
```

## Debugging

If you still get credential errors:

1. Check that values are actual strings, not `process.env.*` references
2. Restart the dev server after changing `.env.local`
3. Check console logs for which credentials are missing
4. Verify credentials are valid in Daraja portal
5. For sandbox testing, use sandbox credentials

## Support

- M-Pesa Daraja Docs: https://developer.safaricom.co.ke/
- NextAuth: https://authjs.dev/
- MongoDB: https://www.mongodb.com/docs/
