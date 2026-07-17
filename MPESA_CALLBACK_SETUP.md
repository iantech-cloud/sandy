# M-Pesa Callback URL Registration Setup Guide

## Overview

This guide explains how the callback URL registration system works and how to ensure M-Pesa transactions are properly reported when Safaricom sends callback responses.

## What's New

### 1. Automatic Callback Registration
- **File**: `app/hooks/useMpesaCallbackRegistration.ts`
- **Purpose**: Automatically registers and validates the callback URL when the app loads
- **Runs**: Once per app session in the browser
- **Logs**: Callback registration info to browser console and localStorage

### 2. Callback Registration Endpoint
- **File**: `app/api/mpesa/register-callback/route.ts`
- **Endpoints**:
  - `GET /api/mpesa/register-callback` - Get current callback configuration
  - `POST /api/mpesa/register-callback` - Register/validate a callback URL
- **Validation**: 
  - Checks URL format
  - Validates HTTPS in production
  - Ensures URL matches your domain
  - Verifies known callback endpoints

### 3. Callback Monitoring
- **File**: `app/components/MpesaCallbackMonitor.tsx`
- **Purpose**: Display callback registration status and URLs
- **Usage**: Can be toggled via a floating button (optional)

## How It Works

### Step 1: App Initialization
When the app loads, the `MpesaCallbackInitializer` component runs automatically:

```typescript
// app/layout.tsx
<MpesaCallbackInitializer />
```

This component:
1. Calls `useMpesaCallbackRegistration()` hook
2. Fetches current callback configuration
3. Registers the callback URL with your backend
4. Stores registration info in localStorage for debugging

### Step 2: Callback URL Registration

The `useMpesaCallbackRegistration` hook:
```typescript
// Primary URL: {BASE_URL}/api/mpesa/callback
// Secondary URL: {BASE_URL}/api/payments/mpesa/callback
```

The hook validates:
- ✅ URL format is valid
- ✅ URL uses HTTPS in production
- ✅ URL matches `NEXT_PUBLIC_BASE_URL`
- ✅ URL points to known callback endpoints

### Step 3: Callback Endpoint Receives Response

When Safaricom sends a transaction update, it hits:
```
POST {BASE_URL}/api/mpesa/callback
```

The endpoint processes:
- Transaction status (completed, cancelled, failed, timeout)
- Receipt number
- Amount
- Result codes and descriptions
- User activation or wallet credit

### Step 4: Waiting Page Gets Updated

The waiting pages (`MpesaWaitingContent.tsx`, `gaming/mpesa-waiting/page.tsx`) poll for status:
```typescript
// Every 3-5 seconds:
const response = await checkActivationPaymentStatus(messageReference);
// Returns: { status, resultCode, resultDesc, mpesaReceiptNumber, ... }
```

## Environment Configuration

### Required Variables
```bash
# Your public base URL (used by browser and Safaricom)
NEXT_PUBLIC_BASE_URL=https://example.com  # or ngrok URL for dev

# M-Pesa Daraja credentials (in .env.local or Vercel Secrets)
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_SHORT_CODE=your_business_shortcode
MPESA_PASSKEY=your_online_passkey
```

### Local Development with ngrok
```bash
# Terminal 1: Start ngrok
ngrok http 5000

# Terminal 2: Set environment variable
export NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io

# Terminal 3: Start Next.js dev server
npm run dev
```

## Setup in Safaricom Daraja Portal

1. **Go to**: https://developer.safaricom.co.ke
2. **Select**: Your application
3. **Navigate to**: Callback URL settings
4. **Update Callback URLs**:
   ```
   Primary: {NEXT_PUBLIC_BASE_URL}/api/mpesa/callback
   Secondary: {NEXT_PUBLIC_BASE_URL}/api/payments/mpesa/callback
   ```
5. **Save** and test with a small transaction

## Debugging

### Check Browser Console
```javascript
// Your registration info is logged with [v0] prefix
// Example:
// [v0] Registering M-Pesa callback URL: https://example.com/api/mpesa/callback
// [v0] M-Pesa callback URL registered successfully: {...}
```

### Check localStorage
```javascript
// In browser console:
JSON.parse(localStorage.getItem('mpesa_callback_registration'))
// Returns:
// {
//   "callbackUrl": "https://example.com/api/mpesa/callback",
//   "registeredAt": "2026-07-17T...",
//   "endpoints": { "primary": "...", "secondary": "..." }
// }
```

### View Callback Monitor (Optional)
Add to your dashboard to display registration status:
```tsx
import { MpesaCallbackMonitorToggle } from '@/app/components/MpesaCallbackMonitor';

export default function Dashboard() {
  return (
    <>
      {/* Your dashboard content */}
      <MpesaCallbackMonitorToggle /> {/* Shows floating button */}
    </>
  );
}
```

### Check Network Requests
1. Open **DevTools** → **Network** tab
2. Look for: `/api/mpesa/register-callback`
3. Verify response status is `200` with `success: true`

### Check API Responses
In waiting pages, the response should include:
```javascript
{
  success: true,
  data: {
    status: "completed",              // or "failed", "cancelled", "timeout"
    resultCode: "0",                 // 0 = success
    resultDesc: "The service was successful.",
    mpesaReceiptNumber: "LIJ123456", // Safaricom receipt
    amount: 9600,                    // Amount in cents (96 KES)
    source: "mpesa_callback",        // or "mpesa_api" or "database_fallback"
    isActivationPayment: true,
    completedAt: "2026-07-17T..."
  }
}
```

## Transaction Flow Diagram

```
User Initiates Payment
        ↓
STK Push Sent to Phone (M-Pesa Daraja API)
        ↓
User Enters PIN & Completes Transaction
        ↓
Safaricom Sends Callback to {BASE_URL}/api/mpesa/callback
        ↓
Callback Endpoint Updates Database
  - MpesaTransaction status
  - ActivationPayment status
  - GamingWallet balance
  - Sends email confirmation
        ↓
Waiting Page Polls: checkActivationPaymentStatus(messageReference)
        ↓
Response Returned to Browser:
  - status (completed/failed/cancelled)
  - receiptNumber
  - amount
        ↓
Waiting Page Shows Success/Error & Redirects User
```

## Common Issues & Solutions

### Issue: "Callback URL not being called"
**Solution**:
1. Verify `NEXT_PUBLIC_BASE_URL` is publicly accessible (use ngrok for dev)
2. Check callback URL in Safaricom Daraja portal matches exactly
3. Verify endpoint is receiving requests (check server logs)
4. Ensure firewall allows incoming connections

### Issue: "Getting 404 in gaming wallet"
**Solution**:
1. The `Profile` document may not exist yet
2. The endpoint now creates one automatically
3. Check browser console for detailed error logs
4. Verify user is authenticated with `session?.user`

### Issue: "Status not updating in waiting page"
**Solution**:
1. Check if callback was actually sent (check Daraja portal logs)
2. Verify database has the transaction record
3. Check polling interval (default 3-5 seconds)
4. Look at server logs for callback processing errors

### Issue: "HTTPS error in production"
**Solution**:
1. Callback registration validates HTTPS in production
2. Update `NEXT_PUBLIC_BASE_URL` to use `https://` not `http://`
3. Ensure your domain has valid SSL certificate
4. Use a service like Let's Encrypt or your hosting provider's SSL

## API Reference

### Register Callback (GET)
```bash
GET /api/mpesa/register-callback

Response:
{
  "success": true,
  "message": "Callback URL configuration retrieved",
  "baseUrl": "https://example.com",
  "callbackUrls": {
    "primary": "https://example.com/api/mpesa/callback",
    "secondary": "https://example.com/api/payments/mpesa/callback"
  },
  "registeredAt": "2026-07-17T12:00:00Z",
  "instructions": {
    "step1": "Use the primary callback URL in your Safaricom Daraja portal",
    "step2": "Ensure your BASE_URL environment variable is set correctly",
    "step3": "The callback endpoint will automatically process M-Pesa responses"
  }
}
```

### Register Callback (POST)
```bash
POST /api/mpesa/register-callback
Content-Type: application/json

{
  "callbackUrl": "https://example.com/api/mpesa/callback"
}

Response:
{
  "success": true,
  "message": "Callback URL registered successfully",
  "callbackUrl": "https://example.com/api/mpesa/callback",
  "registeredAt": "2026-07-17T12:00:00Z",
  "endpoints": {
    "primary": "https://example.com/api/mpesa/callback",
    "secondary": "https://example.com/api/payments/mpesa/callback"
  }
}
```

### Check Payment Status
```bash
POST /api/actions/checkActivationPaymentStatus
Content-Type: application/json

{
  "messageReference": "ACT_1784279163240JNMXFU"
}

Response:
{
  "success": true,
  "data": {
    "status": "completed",
    "resultCode": "0",
    "resultDesc": "The service was successful.",
    "mpesaReceiptNumber": "LIJ123456",
    "amount": 9600,
    "source": "mpesa_callback",
    "isActivationPayment": true,
    "completedAt": "2026-07-17T12:05:00Z"
  },
  "message": "Payment status: completed"
}
```

## Files Modified/Created

### New Files
- `app/api/mpesa/register-callback/route.ts` - Callback registration endpoint
- `app/hooks/useMpesaCallbackRegistration.ts` - Hook for callback registration
- `app/components/MpesaCallbackInitializer.tsx` - Auto-initializer component
- `app/components/MpesaCallbackMonitor.tsx` - Debugging monitor component

### Modified Files
- `app/layout.tsx` - Added MpesaCallbackInitializer component
- `app/api/gaming/wallet/route.ts` - Enhanced with better error logging and profile creation
- `app/dashboard/gaming/components/GamingWallet.tsx` - Improved error handling
- `app/actions/activation.ts` - Enhanced status checking with complete response data
- `app/actions/gaming-games.ts` - Enhanced gaming deposit status checking

## Next Steps

1. **Test locally with ngrok**:
   - Start ngrok: `ngrok http 5000`
   - Set `NEXT_PUBLIC_BASE_URL=https://abc123.ngrok.io`
   - Make a test payment from M-Pesa
   - Check browser console and database for transaction

2. **Deploy to production**:
   - Set `NEXT_PUBLIC_BASE_URL=https://yourdomain.com` in Vercel
   - Update callback URL in Safaricom Daraja portal
   - Test with a real transaction

3. **Monitor callbacks**:
   - Check server logs for `[v0] Callback URL registered`
   - Monitor database for `MpesaTransaction` records
   - Track email confirmations being sent

## Support

For issues or questions:
1. Check the **Debugging** section above
2. Review server logs for `[v0]` prefixed messages
3. Check Safaricom Daraja portal callback logs
4. Verify database has transaction records

---

**Last Updated**: 2026-07-17
**Version**: 1.0
