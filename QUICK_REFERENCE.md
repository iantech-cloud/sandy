# HashBack Integration - Quick Reference Card

## Environment Setup (Copy-Paste)

```bash
# Add to .env.local
HASHBACK_API_KEY=your-api-key
HASHBACK_ACCOUNT_ID=your-account-id
HASHBACK_WEBHOOK_SECRET=your-webhook-secret
```

---

## Wallets at a Glance

| Wallet | Balance Source | Withdrawable? | Fee | Min/Max |
|--------|---|---|---|---|
| **Chat Foreigners** | KES 0.10/msg | ✅ YES | 10% | 10-50K |
| **Spin** | KES 30 deposits | ✅ YES | 0% | Free |
| Aviator | 50% from bets | ❌ NO | 50% | Gaming |
| Casino | 50% from bets | ❌ NO | 50% | Gaming |
| Referral | Activation/Unlock | ❌ NO | 0% | Locked |

---

## API Endpoints

```
POST /api/hashback/webhook          ← Payment confirmed
POST /api/hashback/payment/initiate  ← Start payment
POST /api/hashback/withdrawal        ← Withdraw to M-Pesa
GET  /api/hashback/balance           ← Check balance
```

---

## Revenue Per Transaction

| Type | Amount | Company Share |
|------|--------|---|
| Activation | KES 95 | Split |
| Bot Unlock | KES 100 | KES 20 |
| Spin Deposit | KES 30 | KES 6 |
| Aviator Bet | KES 1,000 | KES 500 |
| Casino Bet | KES 1,000 | KES 500 |
| Withdrawal | KES 100 | KES 10 |

---

## Critical Code Snippets

### Webhook Verification
```typescript
import crypto from 'crypto';

function verifyWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.HASHBACK_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(expected, signature);
}
```

### Initiate Payment
```typescript
const response = await fetch('https://pay.hashback.co.ke/hashpay.js', {
  account_id: process.env.HASHBACK_ACCOUNT_ID,
  amount: 95,  // KES
  reference: 'order_123',
  onSuccess: handlePaymentSuccess,
  onError: handlePaymentError
});
```

### Withdraw to M-Pesa
```typescript
const withdrawal = await fetch('https://api.hashback.co.ke/V2/processwithdrawal', {
  method: 'POST',
  body: JSON.stringify({
    api_key: process.env.HASHBACK_API_KEY,
    msisdn: '254701234567',
    amount: 1000,  // KES
    SecurityCredential: process.env.HASHBACK_SECURITY_CRED
  })
});
```

---

## Testing Commands

```bash
# Test webhook signature
npm test -- webhooks

# Test payment flow
npm test -- payments

# Test withdrawal
npm test -- withdrawals

# Integration test
npm test -- integration

# Load test
npm run loadtest -- --duration=60s
```

---

## Deployment Checklist

- [ ] HashBack credentials added to `.env.local`
- [ ] Webhook URL configured in HashBack Settings
- [ ] Database migrations applied
- [ ] All 8 new files created
- [ ] All 5 existing files modified
- [ ] Webhook signature verification implemented
- [ ] Fallback to Co-op Bank working
- [ ] Rate limiting implemented
- [ ] Error handling tested
- [ ] Admin dashboard updated
- [ ] Revenue reports accurate
- [ ] User documentation updated

---

## Common Issues & Fixes

**Issue:** Webhook signature mismatch  
**Fix:** Verify raw body is not re-serialized; use `file_get_contents('php://input')`

**Issue:** Payment stuck in pending  
**Fix:** Check network; implement automatic retry with exponential backoff

**Issue:** Withdrawal fails  
**Fix:** Verify phone format (254XXXXXXXXX); check balance

**Issue:** High latency  
**Fix:** Implement caching; use connection pooling

---

## Contact

- **HashBack:** https://hashback.co.ke/
- **WhatsApp Support:** Developer group (link in HashBack dashboard)
- **Email:** hashbacksolutions@gmail.com
- **Docs:** https://api.hashback.co.ke/docs

