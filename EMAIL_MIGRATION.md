# Email Migration: SMTP to Resend

## Overview
This document outlines the complete migration of the HustleHub Africa email system from SMTP (Gmail) to **Resend**, a modern email delivery platform.

## Changes Made

### 1. **Removed Dependencies**
- ❌ `nodemailer` - No longer needed (Resend is the new provider)
- The package is still installed but not used. You can optionally remove it later.

### 2. **Updated Email Files**

#### `app/actions/email.ts`
- **Replaced**: `nodemailer` with `Resend`
- **Updated Functions**:
  - `sendSupportEmail()` - Support form emails
  - `sendVerificationEmail()` - Email verification emails
  - `sendVerificationCodeEmail()` - 2FA and verification codes
  - `sendWelcomeEmail()` - Welcome after verification
  - `sendInitialPaymentInvoice()` - Payment invoice emails
  - `sendPaymentConfirmationInvoice()` - Payment confirmation emails
  - `testEmailConfig()` - Email configuration testing

- **Key Changes**:
  - Removed transporter creation and verification
  - Replaced `nodemailer.createTransport()` with `Resend` client
  - Updated from `getTransporter().sendMail()` to `resend.emails.send()`
  - Changed error handling for Resend API responses

#### `app/api/auth/send-email/route.ts`
- **Replaced**: Nodemailer transporter with Resend client
- **Updated**: POST and GET endpoints to use Resend API
- **Enhanced**: Error handling for Resend-specific errors

### 3. **Environment Variables Changed**

#### **OLD** (Gmail SMTP)
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-app-password
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
```

#### **NEW** (Resend)
```env
RESEND_API_KEY=your-resend-api-key
EMAIL_FROM_NAME=HustleHub Africa
EMAIL_FROM_ADDRESS=noreply@hustlehubafrica.com
```

## Required Environment Variables

### Core Authentication
- `NEXTAUTH_SECRET` - JWT signing secret (auto-generated on Vercel)
- `NEXTAUTH_URL` - Your app URL (production: `https://hustlehubafrica.com`)

### Google OAuth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

### Email (Resend) **[NEW]**
- `RESEND_API_KEY` - Your Resend API key (get from https://resend.com)
- `EMAIL_FROM_NAME` - Display name for emails (e.g., "HustleHub Africa")
- `EMAIL_FROM_ADDRESS` - From email address (must be verified in Resend)

### Database
- `MONGODB_URI` - MongoDB connection string

### Encryption
- `ANTI_PHISHING_ENCRYPTION_KEY` - 32-character hex key for encryption

### M-Pesa Payment
- `MPESA_SHORTCODE` - M-Pesa business shortcode
- `MPESA_PASSKEY` - M-Pesa API passkey
- `MPESA_CONSUMER_KEY` - M-Pesa consumer key
- `MPESA_CONSUMER_SECRET` - M-Pesa consumer secret
- `MPESA_CALLBACK_URL` - M-Pesa callback URL
- `MPESA_ENVIRONMENT` - `production` or `sandbox`

### Public URLs
- `NEXT_PUBLIC_BASE_URL` - Your public app URL
- `API_BASE_URL` - API base URL

### Application
- `NODE_ENV` - Environment (`development`, `production`)
- `PORT` - Port number (default: 5000)
- `HOSTNAME` - Hostname (default: 0.0.0.0)

## Setup Instructions

### 1. Get a Resend Account
1. Go to https://resend.com
2. Sign up for a free account
3. Create an API key in the dashboard
4. Verify your sender email domain or use the default `noreply@resend.dev`

### 2. Update Vercel Environment Variables
1. Go to your Vercel project settings
2. Navigate to **Settings → Environment Variables**
3. **Remove old variables**:
   - `GMAIL_USER`
   - `GMAIL_APP_PASSWORD`
   - `EMAIL_USER`
   - `EMAIL_APP_PASSWORD`

4. **Add new variables**:
   ```
   RESEND_API_KEY = your-key-from-resend
   EMAIL_FROM_NAME = HustleHub Africa
   EMAIL_FROM_ADDRESS = noreply@hustlehubafrica.com (or your verified domain)
   ```

5. Update other required variables if they're missing:
   - `NEXTAUTH_SECRET` (auto-generated or add manually)
   - `NEXTAUTH_URL = https://hustlehubafrica.com`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - All M-Pesa credentials
   - `MONGODB_URI`
   - `ANTI_PHISHING_ENCRYPTION_KEY`

### 3. Redeploy
- After updating environment variables, redeploy your application
- Vercel will automatically rebuild with new env vars

### 4. Test Email Sending
- Test with the `/api/auth/send-email` endpoint
- Or use the email functions directly in your app

## Key Differences

| Feature | Nodemailer/SMTP | Resend |
|---------|-----------------|--------|
| Setup | Gmail app password required | Simple API key |
| Rate Limits | Gmail limits (~500/day) | Generous (up to 100,000/month free) |
| Deliverability | Good but subject to Gmail rate limits | Excellent (built for transactional) |
| Error Handling | Exception-based | Result-based (error in response) |
| Authentication | Credentials in code | API key only |
| Monitoring | None | Dashboard analytics |

## Email Response Handling

### Old Way (Nodemailer)
```typescript
const result = await transporter.sendMail(options);
console.log(result.messageId);
```

### New Way (Resend)
```typescript
const result = await resend.emails.send(options);
if (result.error) {
  console.error('Error:', result.error.message);
}
console.log(result.data?.id); // Message ID
```

## Files Modified

1. ✅ `app/actions/email.ts` - All email functions updated
2. ✅ `app/api/auth/send-email/route.ts` - API endpoint updated
3. ✅ `.env.example` - Created with all required variables
4. ✅ `.env.local` - Created for local development

## Testing

### Local Testing
1. Copy `.env.local` and add your Resend API key
2. Run `pnpm dev`
3. Test email functions in your app

### Production Testing
1. Ensure all environment variables are set in Vercel
2. Monitor email delivery in Resend dashboard
3. Check email logs for any issues

## Troubleshooting

### "RESEND_API_KEY is not set"
- Verify the env var is added to Vercel settings
- Check that it's marked for the correct environment (production, preview, development)
- Redeploy after adding the variable

### "Invalid email address"
- Verify the `EMAIL_FROM_ADDRESS` is registered in Resend
- If using a custom domain, ensure it's verified in Resend

### Emails not sending
- Check Resend dashboard for bounce/failed delivery logs
- Verify recipient email addresses are valid
- Check that `RESEND_API_KEY` is correct

## Additional Resources

- **Resend Docs**: https://resend.com/docs
- **Resend Dashboard**: https://app.resend.com
- **API Reference**: https://resend.com/docs/api-reference/emails/send

## Rollback Plan

If you need to rollback to Gmail SMTP:
1. Restore the old `app/actions/email.ts` from git history
2. Restore the old API route
3. Remove Resend env vars from Vercel
4. Add back `GMAIL_USER` and `GMAIL_APP_PASSWORD`
5. Redeploy

## Support

For issues with Resend:
- Visit https://resend.com/support
- Check API status at https://status.resend.com

For HustleHub Africa issues:
- Check the application logs in Vercel
- Review email delivery in Resend dashboard
