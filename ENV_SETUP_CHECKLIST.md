# Environment Variables Setup Checklist

## Complete List of Required Environment Variables

This checklist will help you set up all required environment variables for production deployment.

### ✅ Authentication & Sessions

- [ ] **NEXTAUTH_SECRET** 
  - Description: JWT signing secret for NextAuth
  - How to get: Generate with `openssl rand -base64 32`
  - Example: `eJ2kL3xM9nP0qR1sT2uV3wX4yZ5aB6cD7eF8gH9iJ0k`
  - Where: Vercel → Settings → Environment Variables

- [ ] **NEXTAUTH_URL**
  - Description: Your production URL
  - Value: `https://hustlehubafrica.com`
  - Where: Vercel → Settings → Environment Variables

### ✅ Google OAuth

- [ ] **GOOGLE_CLIENT_ID**
  - How to get:
    1. Go to https://console.cloud.google.com/
    2. Create a new project
    3. Enable Google+ API
    4. Create OAuth 2.0 credentials (Web application)
    5. Add authorized redirect URIs: `https://hustlehubafrica.com/api/auth/callback/google`
  - Where: Vercel → Settings → Environment Variables

- [ ] **GOOGLE_CLIENT_SECRET**
  - How to get: From the same Google Cloud Console
  - Where: Vercel → Settings → Environment Variables

### ✅ Email Service (RESEND)

- [ ] **RESEND_API_KEY**
  - How to get:
    1. Go to https://resend.com
    2. Sign up for free account
    3. Navigate to API Keys
    4. Create new API key
    5. Copy the full key
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Keep this secret, never commit to git

- [ ] **EMAIL_FROM_NAME**
  - Value: `HustleHub Africa`
  - Where: Vercel → Settings → Environment Variables

- [ ] **EMAIL_FROM_ADDRESS**
  - Value: `noreply@hustlehubafrica.com`
  - Note: Must be verified in Resend dashboard
  - How to verify:
    1. Log into https://app.resend.com
    2. Go to Domains/Senders
    3. Add and verify your sender domain
  - Where: Vercel → Settings → Environment Variables

### ✅ Database (MongoDB)

- [ ] **MONGODB_URI**
  - Description: MongoDB connection string
  - Format: `mongodb+srv://username:password@cluster.mongodb.net/hustlehubafrica`
  - How to get:
    1. Go to https://www.mongodb.com/cloud/atlas
    2. Create free cluster
    3. Create database user
    4. Get connection string
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Keep this secret, never commit to git

### ✅ Encryption

- [ ] **ANTI_PHISHING_ENCRYPTION_KEY**
  - Description: 32-character hex key for anti-phishing code encryption
  - How to generate: `openssl rand -hex 16` (produces 32 hex chars)
  - Example: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Must be exactly 32 hex characters

### ✅ M-Pesa Payment Gateway

- [ ] **MPESA_SHORTCODE**
  - Description: Your M-Pesa business shortcode
  - How to get: From Safaricom/M-Pesa dashboard
  - Example: `174379`
  - Where: Vercel → Settings → Environment Variables

- [ ] **MPESA_PASSKEY**
  - Description: M-Pesa API passkey
  - How to get: From Safaricom M-Pesa API documentation
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Keep this secret

- [ ] **MPESA_CONSUMER_KEY**
  - Description: M-Pesa API consumer key
  - How to get: From Safaricom M-Pesa API
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Keep this secret

- [ ] **MPESA_CONSUMER_SECRET**
  - Description: M-Pesa API consumer secret
  - How to get: From Safaricom M-Pesa API
  - Where: Vercel → Settings → Environment Variables
  - ⚠️ **CRITICAL**: Keep this secret

- [ ] **MPESA_CALLBACK_URL**
  - Description: URL for M-Pesa callbacks
  - Value: `https://hustlehubafrica.com/api/mpesa/callback`
  - Where: Vercel → Settings → Environment Variables

- [ ] **MPESA_ENVIRONMENT**
  - Description: M-Pesa environment
  - Value: `production` (or `sandbox` for testing)
  - Where: Vercel → Settings → Environment Variables

### ✅ Public URLs

- [ ] **NEXT_PUBLIC_BASE_URL**
  - Description: Public base URL (accessible from browser)
  - Value: `https://hustlehubafrica.com`
  - Where: Vercel → Settings → Environment Variables
  - Note: This is public, no secrets here

- [ ] **API_BASE_URL**
  - Description: API base URL for internal calls
  - Value: `https://hustlehubafrica.com`
  - Where: Vercel → Settings → Environment Variables
  - Note: Can be same as NEXT_PUBLIC_BASE_URL

### ✅ Application Configuration

- [ ] **NODE_ENV**
  - Description: Environment type
  - Value: `production`
  - Where: Vercel → Settings → Environment Variables
  - Note: Automatically set to `production` on Vercel

- [ ] **PORT**
  - Description: Port number
  - Value: `5000`
  - Where: Vercel → Settings → Environment Variables
  - Note: Usually pre-configured on Vercel

- [ ] **HOSTNAME**
  - Description: Server hostname
  - Value: `0.0.0.0`
  - Where: Vercel → Settings → Environment Variables
  - Note: Usually pre-configured on Vercel

## Setup Steps

### 1. Generate Secrets
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ANTI_PHISHING_ENCRYPTION_KEY
openssl rand -hex 16
```

### 2. Gather All Credentials
- [ ] NEXTAUTH_SECRET - Generated above
- [ ] GOOGLE_CLIENT_ID - From Google Cloud
- [ ] GOOGLE_CLIENT_SECRET - From Google Cloud
- [ ] RESEND_API_KEY - From Resend dashboard
- [ ] MONGODB_URI - From MongoDB Atlas
- [ ] ANTI_PHISHING_ENCRYPTION_KEY - Generated above
- [ ] MPESA credentials - From Safaricom

### 3. Add to Vercel

1. Go to https://vercel.com
2. Select your project (Sandy)
3. Click **Settings**
4. Click **Environment Variables**
5. For each variable:
   - Enter the key name (e.g., `NEXTAUTH_SECRET`)
   - Enter the value
   - Select which environments (Production, Preview, Development)
   - Click **Save**

**Recommended environment selection:**
- `NEXTAUTH_SECRET` → Production + Preview
- `NEXTAUTH_URL` → Production + Preview
- `RESEND_API_KEY` → Production + Preview
- `MONGODB_URI` → Production + Preview
- All other credentials → Production + Preview

### 4. Redeploy

After adding environment variables:
1. Go to Deployments tab
2. Click the latest deployment
3. Click **Redeploy**
4. Wait for successful deployment

### 5. Test Email Sending

Once deployed:
1. Visit your app: https://hustlehubafrica.com
2. Test email functionality:
   - Sign up (should trigger verification email)
   - Check email delivery in Resend dashboard
   - Verify no errors in Vercel logs

## Verification Checklist

After setup, verify everything works:

- [ ] Application loads without errors
- [ ] Can sign up with email
- [ ] Verification email is sent and received
- [ ] Can log in successfully
- [ ] M-Pesa payments work
- [ ] No "missing environment variable" errors in logs

## Common Issues

### Issue: "NEXTAUTH_SECRET is not set"
**Solution:**
1. Check env var is added to Vercel
2. Verify it's marked for Production environment
3. Redeploy
4. Clear browser cache

### Issue: "RESEND_API_KEY is not set"
**Solution:**
1. Double-check API key from Resend (https://app.resend.com)
2. Verify no spaces or extra characters
3. Redeploy
4. Wait 2-3 minutes for env vars to propagate

### Issue: "Email address not verified"
**Solution:**
1. Log into Resend dashboard
2. Go to Senders/Domains
3. Verify your email domain
4. Update `EMAIL_FROM_ADDRESS` if different

### Issue: Emails not sending but no errors
**Solution:**
1. Check Resend dashboard for bounce rate
2. Verify recipient email is valid
3. Check spam folder
4. Review Resend logs for delivery details

## Support

- **Resend Issues**: https://resend.com/support
- **Vercel Issues**: https://vercel.com/support
- **MongoDB Issues**: https://docs.mongodb.com/manual/
- **Google OAuth Issues**: https://developers.google.com/identity/protocols/oauth2
- **M-Pesa Issues**: Safaricom support

## Security Best Practices

✅ **DO:**
- [ ] Store all secrets in Vercel env vars
- [ ] Never commit secrets to git
- [ ] Use strong, unique values for secrets
- [ ] Rotate secrets periodically
- [ ] Monitor logs for unauthorized access
- [ ] Use HTTPS only (https://hustlehubafrica.com)

❌ **DON'T:**
- [ ] Commit .env files with real secrets
- [ ] Share API keys or passwords
- [ ] Use simple or guessable values
- [ ] Expose secrets in logs
- [ ] Use HTTP in production
- [ ] Reuse secrets across projects

## Backup & Disaster Recovery

Keep this information secure:
1. **Save API keys** in a secure password manager (1Password, Bitwarden, etc.)
2. **Document setup** in your team wiki
3. **Create backup** of these env var values
4. **Update team members** if any changes are made

---

**Last Updated**: May 2026
**Status**: ✅ Ready for Production
