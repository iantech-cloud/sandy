# HashBack Payment Integration - Simplified Guide

**Version:** 1.0  
**Status:** Production Ready  
**Last Updated:** 2026-07-13

---

## Quick Start

### Setup (2 minutes)

1. **Get HashBack Credentials:**
   - Sign up at https://hashback.co.ke/
   - Go to Settings → Generate API Key & Account ID
   - Copy credentials to `.env.local`

2. **Environment Variables:**
   ```
   HASHBACK_API_KEY=your-api-key
   HASHBACK_ACCOUNT_ID=your-account-id
   HASHBACK_WEBHOOK_SECRET=your-webhook-secret
   ```

3. **Webhook URL (HashBack Settings):**
   ```
   https://your-domain.com/api/hashback/webhook
   ```

---

## System Overview

### Withdrawable Wallets (Only These)

1. **Chat Foreigners Earnings Wallet**
   - User earns: KES 0.10 per message (capped KES 100/day)
   - Withdrawable to M-Pesa via HashBack B2C
   - Min withdrawal: KES 10 | Max: KES 50,000
   - Withdrawal fee: 10%

2. **Spin Wallet**
   - Deposit: KES 30 only via HashBack STK
   - Spins cost: KES 30 each
   - Company keeps: 20% of deposits (KES 6)
   - Cashout to Chat Foreigners wallet (free transfer)

### Non-Withdrawable (Use Only for Gaming)

- **Aviator Wallet** - 50% house edge, play-only
- **Casino Wallet** - 50% house edge, play-only
- **Referral Earnings** - Lock in main wallet, use for activation/bot unlock

---

## Payment Flows

### Flow 1: Activation Payment (KES 95)

```
User clicks "Activate Account"
         ↓
Choose payment: HashBack or Co-op Bank
         ↓
HashBack STK → User enters PIN
         ↓
Payment confirmed → Webhook received
         ↓
Account activated + credited as referral earning
         ↓
Ready to earn from Chat Foreigners
```

### Flow 2: Bot Unlock (KES 100)

```
User unlocks Bot for lifetime chat
         ↓
Choose payment: HashBack or Co-op Bank
         ↓
Payment success → Revenue split:
  - L1 Referrer: KES 70 (referral earning)
  - L2 Grandparent: KES 10 (referral earning)
  - Company: KES 20
         ↓
Bot access granted immediately
```

### Flow 3: Chat Foreigners Message Earning

```
User chats with bot
         ↓
Each message: +KES 0.10 to Chat Foreigners wallet
         ↓
Daily limit: KES 100 (1,000 messages max)
         ↓
Balance updates real-time
         ↓
User can withdraw anytime (min KES 10)
```

### Flow 4: Spin Wallet Deposit (KES 30)

```
User clicks "Top-up Spin Wallet"
         ↓
HashBack STK → User enters PIN
         ↓
KES 30 received in Spin Wallet
         ↓
Company gets KES 6 (20% of deposit)
         ↓
Ready to spin (KES 30 per spin)
```

### Flow 5: Withdraw to M-Pesa

```
User clicks "Withdraw" in Chat Foreigners wallet
         ↓
Enter amount (KES 10-50,000)
         ↓
Confirm phone number
         ↓
HashBack B2C withdrawal initiated
         ↓
10% fee deducted
         ↓
M-Pesa arrives in 10-30 seconds
```

---

## Revenue Model

### Monthly Expected Revenue

| Source | Amount | Frequency |
|--------|--------|-----------|
| Activation (KES 95 × 500 users) | KES 47,500 | Per month |
| Bot Unlocks - Company share (KES 20 × 1,000) | KES 20,000 | Per month |
| Spin Wallet revenue (KES 6 × 5,000 deposits) | KES 30,000 | Per month |
| Aviator house edge (50% of KES 10M bets) | KES 5,000,000 | Per month |
| Casino house edge (50% of KES 10M bets) | KES 5,000,000 | Per month |
| **Total** | **KES 10,097,500** | **Per month** |

---

## Database Changes Required

### New Collections

#### HashBackTransaction
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  
  // Transaction details
  type: 'activation' | 'bot_unlock' | 'spin_deposit' | 'withdrawal',
  amount_cents: number,
  provider: 'hashback' | 'coop_bank',
  
  // HashBack response
  checkout_id: string,
  receipt: string,
  transaction_id: string,
  
  // Status tracking
  status: 'pending' | 'completed' | 'failed',
  created_at: Date,
  completed_at?: Date
}
```

#### ChatForeignersWallet
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  
  balance_cents: number,
  total_earned_cents: number,
  
  transaction_history: [{
    message_count: number,
    earned_cents: number,
    date: Date
  }],
  
  withdrawal_history: [{
    amount_cents: number,
    fee_cents: number,
    receipt: string,
    withdrawn_at: Date
  }]
}
```

#### SpinWallet (Update to include HashBack)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  
  balance_cents: number,
  
  deposits: [{
    amount_cents: number,
    provider: 'hashback' | 'coop_bank',
    receipt: string,
    company_revenue_cents: number,  // 20% of amount
    deposit_at: Date
  }],
  
  spins: [{
    result: 'win' | 'try_again',
    spent_cents: number,
    spun_at: Date
  }]
}
```

---

## API Endpoints Needed

### 1. HashBack Webhook
```
POST /api/hashback/webhook

Headers:
  X-Hashpay-Signature: sha256=<hex>
  Content-Type: application/json

Body:
  {
    event: 'payment.success',
    TransactionID: 'UEC496402X',
    TransactionAmount: 95,
    TransactionReference: 'order_123',
    Msisdn: 254701234567
  }

Response: 200 OK
```

### 2. Initiate Payment
```
POST /api/hashback/payment/initiate

Body:
  {
    amount_cents: 9500,  // KES 95
    type: 'activation',
    description: 'Account Activation'
  }

Response:
  {
    checkout_id: 'ws_CO_...',
    account_id: 'HP945692'
  }
```

### 3. Initiate Withdrawal
```
POST /api/hashback/withdrawal

Body:
  {
    amount_cents: 50000,  // KES 500
    msisdn: '254701234567',
    wallet_type: 'chat_foreigners'
  }

Response:
  {
    success: true,
    transaction_id: 'UEC496402X',
    fee_cents: 5000,
    net_amount_cents: 45000
  }
```

### 4. Check Balance
```
GET /api/hashback/balance

Response:
  {
    chat_foreigners_balance_cents: 150000,
    spin_wallet_balance_cents: 0,
    withdrawable_cents: 150000
  }
```

---

## Security

### Webhook Verification (CRITICAL)

```typescript
// Every webhook MUST be verified before processing
import crypto from 'crypto';

function verifyHashBackWebhook(rawBody: string, signature: string): boolean {
  const secret = process.env.HASHBACK_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(expected, signature);
}
```

### Amount Validation

Always validate amounts on server-side before processing:
```typescript
if (amount < 1000) {  // Min KES 10
  throw new Error('Amount too small');
}
if (amount > 5000000) {  // Max KES 50,000
  throw new Error('Amount too large');
}
```

---

## Rate Limiting

HashBack enforces:
- 100 requests per minute per API key
- 10 decode requests per 5 seconds

Implement exponential backoff:
```typescript
async function callHashBack(fn: () => Promise<any>) {
  let retries = 0;
  while (retries < 3) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        await delay(Math.pow(2, retries) * 1000);
        retries++;
      } else {
        throw error;
      }
    }
  }
}
```

---

## Error Handling

### Fallback to Co-op Bank

If HashBack fails with any error:
1. Log the error
2. Retry once after 1 second
3. If still fails, use Co-op Bank as fallback
4. Notify admin for investigation

```typescript
async function initiatePayment(amount: number) {
  try {
    return await hashback.initiateSTK(amount);
  } catch (error) {
    console.error('[HashBack Error]', error);
    // Fallback to Co-op Bank
    return await coopBank.initiateSTK(amount);
  }
}
```

---

## Testing Checklist

- [ ] Webhook signature verification
- [ ] Payment flow with HashBack STK
- [ ] Payment flow with Co-op Bank fallback
- [ ] Chat Foreigners earning (KES 0.10 per message)
- [ ] Daily earning cap (KES 100)
- [ ] Spin wallet deposit and spins
- [ ] Withdrawal with 10% fee
- [ ] Withdrawal minimum (KES 10)
- [ ] Withdrawal maximum (KES 50,000)
- [ ] Admin dashboard shows correct revenue
- [ ] Transaction history accuracy
- [ ] Rate limiting & exponential backoff
- [ ] Error handling & fallback logic

---

## Files to Create

1. `/app/lib/services/hashback.ts` - API client
2. `/app/api/hashback/webhook/route.ts` - Webhook handler
3. `/app/api/hashback/payment/initiate/route.ts` - Payment init
4. `/app/api/hashback/withdrawal/route.ts` - Withdrawal handler
5. `/app/api/hashback/balance/route.ts` - Balance check
6. `/app/actions/chat-foreigners-wallet.ts` - Wallet actions
7. `/app/components/chat-foreigners-earnings.tsx` - Earnings display
8. `/app/components/withdraw-button.tsx` - Withdrawal UI

---

## Files to Modify

1. `.env.local` - Add HashBack credentials
2. `app/lib/models.ts` - Add new collections
3. `app/actions/chat-foreigners/payments.ts` - Use HashBack
4. `app/actions/activation.ts` - Use HashBack
5. Dashboard components - Show Chat Foreigners balance

---

## FAQ

**Q: Can users withdraw Aviator/Casino winnings?**
A: No. Only Chat Foreigners earnings and Spin wallet can be withdrawn. Gaming is for entertainment only.

**Q: What's the 50% house edge?**
A: On every Aviator/Casino bet, 50% goes to company, 50% stays as player payout. Mathematically, users lose over time.

**Q: How fast are withdrawals?**
A: 10-30 seconds to M-Pesa via HashBack B2C.

**Q: What if HashBack is down?**
A: Automatic fallback to Co-op Bank. Users won't notice any difference.

**Q: Can earnings be paused or reset?**
A: No. Chat Foreigners earnings accumulate daily up to KES 100 and carry over.

---

## Monitoring

Check these daily:
1. HashBack webhook success rate (should be 99.9%+)
2. Withdrawal completion time (should be <30s avg)
3. Failed payment retries (should be <1%)
4. Chat Foreigners earnings are updating correctly
5. Admin revenue dashboard accuracy

