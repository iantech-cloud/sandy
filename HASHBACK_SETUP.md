# HashBack Payment Integration - Setup & Troubleshooting

## Overview
HashBack payment button is fully integrated alongside Co-op Bank for M-Pesa payments across all wallets.
- **Localhost**: HashBack button fully functional for development and testing
- **Production**: HashBack button shows "Coming Soon" badge (disabled)
- **Co-op Bank**: Always available in both environments

## Environment Variables Required

Set these in your `.env.local` (development) or Vercel project settings (production):

```env
# REQUIRED - HashBack Public Account ID (safe to expose, public-only)
NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=your-account-id-here

# REQUIRED - HashBack Webhook Secret (server-side only, never expose)
HASHBACK_WEBHOOK_SECRET=your-webhook-secret-here

# OPTIONAL - HashBack API Key for future API calls
HASHBACK_API_KEY=your-api-key-here
```

### How to Get These Values:
1. Register at https://www.hashback.co.ke
2. Go to Dashboard → Settings
3. Copy your **Account ID** (public, for the button)
4. Copy your **Webhook Secret** (keep private, for server verification)
5. Generate an **API Key** if needed for wallet operations

## How It Works

### Payment Flow
```
User selects payment method
    ↓
Frontend shows PaymentMethodSelector with Co-op Bank & HashBack buttons
    ↓
On button click → HashBack script loads from CDN
    ↓
HashPay.setup() initializes the payment handler
    ↓
handler.openIframe() opens M-Pesa payment modal
    ↓
User enters phone & PIN
    ↓
M-Pesa processes payment
    ↓
HashBack webhook sent to /api/webhooks/hashback
    ↓
Server verifies signature & amount
    ↓
User is activated/wallet credited
```

### Key Files
- **Components:**
  - `app/components/HashBackPaymentButton.tsx` - Payment button with script loading
  - `app/components/PaymentMethodSelector.tsx` - Both methods side-by-side
  - `app/components/CoopBankPaymentButton.tsx` - Co-op Bank button

- **Actions:**
  - `app/actions/activation-hashback.ts` - HashBack activation handling
  - `app/actions/activation.ts` - Co-op Bank activation handling

- **Webhooks:**
  - `app/api/webhooks/hashback/route.ts` - Main webhook receiver
  - `app/api/webhooks/hashback/verify/route.ts` - Verification polling endpoint

- **Configuration:**
  - `app/lib/utils/payment-config.ts` - Environment-based feature control

## Troubleshooting

### Issue: "HashBack button keeps loading"

**Cause**: The HashBack script is not loading from the CDN.

**Solutions**:
1. Check console for errors (F12 → Console tab)
2. Verify `NEXT_PUBLIC_HASHBACK_ACCOUNT_ID` is set:
   ```bash
   echo $NEXT_PUBLIC_HASHBACK_ACCOUNT_ID  # Should show your account ID
   ```
3. Check if script is blocked by ad-blocker (reload with ad-blocker disabled)
4. Verify CDN is accessible:
   ```bash
   curl -I https://pay.hashback.co.ke/hashpay.js
   ```

### Issue: "Button shows but payment doesn't work"

**Causes & Fixes**:
1. **Missing webhook secret**: Webhook verification will fail
   - Set `HASHBACK_WEBHOOK_SECRET` in environment
   - Restart dev server or redeploy

2. **Incorrect account ID**: Payment initializes but fails
   - Verify account ID in HashBack dashboard
   - Update `NEXT_PUBLIC_HASHBACK_ACCOUNT_ID`

3. **Network error**: Check browser console for CORS or fetch errors
   - Verify `/api/webhooks/hashback/verify` endpoint exists
   - Check API route implementation

### Issue: "Production shows wrong status"

HashBack status depends on environment:
- `localhost` or `127.0.0.1` → Full button (development)
- Any other hostname → "Coming Soon" badge (production)

To test production behavior locally:
```bash
# Change your hosts file or use a different hostname
# Then access at that hostname instead of localhost
```

### Issue: "Webhook not receiving payments"

1. **Configure webhook in HashBack dashboard:**
   - Go to Settings → Webhooks
   - Set URL to: `https://your-domain.com/api/webhooks/hashback`
   - Save webhook secret (copy to `HASHBACK_WEBHOOK_SECRET`)

2. **Verify webhook is accessible:**
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/hashback \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
   Should return `200 OK`

3. **Check server logs for signature verification errors**

## Testing on Localhost

1. **Start dev server:**
   ```bash
   pnpm dev
   ```

2. **Set test environment variables in `.env.local`:**
   ```env
   NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=HP945692  # HashBack demo account
   HASHBACK_WEBHOOK_SECRET=test-secret
   ```

3. **Navigate to activation or wallet page**

4. **Open browser DevTools (F12)**

5. **Look for these console messages:**
   ```
   [v0] HashPay script loaded successfully
   [v0] Setting up HashPay with: { account: "HP945692", amount: 100, reference: "..." }
   [v0] HashBack payment success: { receipt: "...", amount: 100, ... }
   ```

6. **Click "Pay with HashBack" button**
   - Script should load (watch console)
   - M-Pesa modal should appear
   - Use test credentials to complete payment

## Production Deployment

1. **Set environment variables in Vercel:**
   ```bash
   vercel env add NEXT_PUBLIC_HASHBACK_ACCOUNT_ID
   vercel env add HASHBACK_WEBHOOK_SECRET
   ```

2. **Redeploy:**
   ```bash
   git push  # or vercel deploy
   ```

3. **Verify HashBack shows as "Coming Soon":**
   - Button should be disabled with "Coming Soon" badge
   - Co-op Bank should be fully functional

4. **When ready to enable HashBack:**
   - Remove "Coming Soon" status in code
   - Update `isLocalhostDevelopment()` logic if needed
   - Redeploy

## Amount Validation

Both payment methods support dynamic amounts in the range **95-100 KES** (activation/unlock) and **30 KES+** (deposits). The component automatically validates:
- Amount passed from frontend vs received from HashBack
- Prevents tampering by comparing server-stored amount with webhook

## Security Checklist

- ✅ Webhook signature verified with HMAC-SHA256
- ✅ Amount validation prevents tampering
- ✅ Receipt deduplication prevents double-activation
- ✅ Payment provider tracked per transaction
- ✅ All payments verified server-side (webhook, not browser)
- ✅ API key kept server-side only
- ✅ Account ID public-only (safe to expose)

## Support

- **HashBack Docs**: https://hashback.co.ke/docs
- **HashBack Support**: hashbacksolutions@gmail.com or WhatsApp group
- **Developer Issues**: Check console logs and /api/webhooks/hashback logs
