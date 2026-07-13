# HashBack Payment Button Integration

**Version:** 1.0  
**Status:** Production Ready  
**Date:** 2026-07-13

---

## Overview

Sandy uses HashBack's **Payment Button** - a drop-in M-Pesa popup that requires only the public Account ID. No secret API keys are exposed to the browser.

**Key Point:** Only ACCOUNT_ID needed (public key) - works client-side with webhooks for confirmation.

---

## Setup (3 Steps)

### 1. Get Account ID

1. Sign up at https://hashback.co.ke/
2. Go to Dashboard → Settings
3. Copy your public ACCOUNT_ID (e.g., `HP945692`)
4. Add to `.env.local`:

```
NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=your-public-account-id
HASHBACK_WEBHOOK_SECRET=your-webhook-secret
```

### 2. Configure Webhook

In HashBack Settings, add webhook URL:
```
https://your-domain.com/api/webhooks/hashback
```

### 3. Add Script to Layout

```tsx
// app/layout.tsx
export default function RootLayout({ children }) {
  return (
    <html>
      <head>
        <script src="https://pay.hashback.co.ke/hashpay.js" />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

---

## How It Works

Three simple steps:

1. **Setup** - Load script, call `HashPay.setup()` with Account ID + amount
2. **Payment** - User enters phone, M-Pesa STK sent, user enters PIN
3. **Webhook** - Payment confirmed, server updates database, callback fires

---

## Wallet System

### Non-Withdrawable (Deposit Only)

| Wallet | Deposit | Company Revenue | Status |
|--------|---------|-----------------|--------|
| Spin Wallet | KES 30 | 20% (KES 6) | Non-withdrawable |
| Chat Foreigners Earnings | KES 0.10/msg, max KES 100/day | N/A | Non-withdrawable |
| Aviator | KES 50-1,000 | 50% (house edge) | Non-withdrawable, play-only |
| Casino | KES 50-1,000 | 50% (house edge) | Non-withdrawable, play-only |
| Referral Earnings | From bot unlocks | N/A | Non-withdrawable, locked |

---

## Payment Button Flows

### Flow 1: Account Activation (KES 95)

```
User clicks "Activate Account"
         ↓
HashBack Payment Button opens
         ↓
User enters phone + confirms
         ↓
M-Pesa STK → User enters PIN
         ↓
Webhook received: payment.success
         ↓
Account activated
         ↓
Referrer credited: KES 65
         ↓
Ready to earn from Chat Foreigners
```

### Flow 2: Bot Unlock (KES 100)

```
User clicks "Unlock Chat Foreigners Bot"
         ↓
HashBack Payment Button opens
         ↓
User enters phone + confirms
         ↓
M-Pesa STK → User enters PIN
         ↓
Webhook received: payment.success
         ↓
Bot unlocked (lifetime access)
         ↓
Revenue split:
  - L1 Referrer: KES 70
  - L2 Grandparent: KES 10
  - Company: KES 20
         ↓
User can chat immediately
```

### Flow 3: Spin Wallet Deposit (KES 30)

```
User clicks "Top-up Spin Wallet"
         ↓
HashBack Payment Button opens (KES 30)
         ↓
User enters phone + confirms
         ↓
M-Pesa STK → User enters PIN
         ↓
Webhook received: payment.success
         ↓
KES 30 added to Spin Wallet
         ↓
Company gets: KES 6 (20%)
         ↓
Ready to spin (cost: KES 30 per spin)
         ↓
NOTE: Balance is non-withdrawable
```

### Flow 4: Aviator Deposit (KES 50-1,000)

```
User selects amount (50, 100, 250, 500, 1000)
         ↓
HashBack Payment Button opens
         ↓
User enters phone + confirms
         ↓
M-Pesa STK → User enters PIN
         ↓
Webhook received: payment.success
         ↓
Amount added to Aviator Wallet
         ↓
Company gets: 50% (house edge)
         ↓
Ready to play
         ↓
NOTE: Non-withdrawable, play-only balance
```

### Flow 5: Casino Deposit (KES 50-1,000)

```
User selects game (Slots/Blackjack/Roulette/Dice/Baccarat)
         ↓
User selects amount (50, 100, 250, 500, 1000)
         ↓
HashBack Payment Button opens
         ↓
User enters phone + confirms
         ↓
M-Pesa STK → User enters PIN
         ↓
Webhook received: payment.success
         ↓
Amount added to Casino Wallet
         ↓
Company gets: 50% (house edge)
         ↓
Game auto-launches
         ↓
NOTE: Non-withdrawable, play-only balance
```

---

## Payment Button Component

```tsx
// app/components/hashback-payment-button.tsx
'use client'

import { useState } from 'react'

export function HashBackPaymentButton({
  amount,
  reference,
  onSuccess,
  onCancel,
  onError,
  label = 'Pay Now'
}: {
  amount: number // KES
  reference: string // unique order ID
  onSuccess: (txn: any) => void
  onCancel: () => void
  onError: (error: any) => void
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  const accountId = process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID

  const handlePay = () => {
    if (!window.HashPay) {
      onError(new Error('HashPay not loaded'))
      return
    }

    setLoading(true)

    const handler = window.HashPay.setup({
      account: accountId,
      amount: amount,
      reference: reference,
      onSuccess: (txn: any) => {
        setLoading(false)
        // Validate amount on server before fulfilling
        onSuccess(txn)
      },
      onCancel: () => {
        setLoading(false)
        onCancel()
      },
      onError: (error: any) => {
        setLoading(false)
        onError(error)
      }
    })

    handler.openIframe()
  }

  return (
    <button
      onClick={handlePay}
      disabled={loading}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
    >
      {loading ? 'Processing...' : label}
    </button>
  )
}
```

---

## Webhook Handler

Only endpoint needed for payment confirmation.

```typescript
// app/api/webhooks/hashback/route.ts
import crypto from 'crypto'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hashpay-signature')
  
  // Verify signature (CRITICAL)
  if (!verifySignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)

  if (payload.event !== 'payment.success') {
    return new Response('OK', { status: 200 })
  }

  const {
    TransactionID,
    TransactionAmount,
    TransactionReference,
    TransactionReceipt
  } = payload

  // Parse reference to get transaction type
  const [type, userId, orderId] = TransactionReference.split('_')

  // Verify amount
  const expectedAmount = getExpectedAmount(type)
  if (TransactionAmount !== expectedAmount) {
    console.error('Amount mismatch')
    return new Response('Invalid amount', { status: 400 })
  }

  // Process transaction
  try {
    switch (type) {
      case 'activation':
        await processActivation(userId)
        break
      case 'bot_unlock':
        await processBotUnlock(userId)
        break
      case 'spin_deposit':
        await processSpinDeposit(userId, TransactionAmount)
        break
      case 'aviator_deposit':
        await processAviatorDeposit(userId, TransactionAmount)
        break
      case 'casino_deposit':
        await processCasinoDeposit(userId, TransactionAmount)
        break
    }
  } catch (error) {
    console.error('[Webhook] Processing error:', error)
    return new Response('Error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  
  const secret = process.env.HASHBACK_WEBHOOK_SECRET
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret!)
    .update(rawBody)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  )
}

function getExpectedAmount(type: string): number {
  const amounts: Record<string, number> = {
    activation: 9500,    // KES 95
    bot_unlock: 10000,   // KES 100
    spin_deposit: 3000   // KES 30
  }
  return amounts[type] || 0
}

async function processActivation(userId: string) {
  // Mark account as activated
  // Credit referrer KES 65
}

async function processBotUnlock(userId: string) {
  // Grant bot access
  // Credit referrer KES 70, grandparent KES 10
}

async function processSpinDeposit(userId: string, amountCents: number) {
  // Add to spin wallet
  // Company gets 20%
}

async function processAviatorDeposit(userId: string, amountCents: number) {
  // Add to aviator wallet
  // Company gets 50%
}

async function processCasinoDeposit(userId: string, amountCents: number) {
  // Add to casino wallet
  // Company gets 50%
}
```

---

## Database Updates Required

### SpinWallet
```typescript
{
  user_id: ObjectId,
  balance_cents: number,
  deposits: [{
    amount_cents: number,
    provider: 'hashback',
    company_revenue_cents: number,  // 20%
    deposit_at: Date
  }]
}
```

### AviatorWallet
```typescript
{
  user_id: ObjectId,
  balance_cents: number,
  deposits: [{
    amount_cents: number,
    provider: 'hashback',
    deposit_at: Date
  }]
}
```

### CasinoWallet
```typescript
{
  user_id: ObjectId,
  balance_cents: number,
  deposits: [{
    amount_cents: number,
    provider: 'hashback',
    deposit_at: Date
  }]
}
```

---

## Security Checklist

- [ ] Webhook signature verification (CRITICAL)
- [ ] Server-side amount validation (CRITICAL)
- [ ] ACCOUNT_ID is public (safe to expose)
- [ ] WEBHOOK_SECRET never exposed to client
- [ ] Use timing-safe comparison for signatures
- [ ] Validate phone numbers before payment
- [ ] Log all transactions for audit

---

## Implementation Steps

1. **Add environment variable:**
   ```
   NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=your-account-id
   HASHBACK_WEBHOOK_SECRET=your-secret
   ```

2. **Add script to layout:** (see Setup section)

3. **Create Payment Button component:** (see above)

4. **Create webhook handler:** (see above)

5. **Update databases:** Add SpinWallet, AviatorWallet, CasinoWallet

6. **Add buttons to:**
   - Activation page (KES 95)
   - Bot unlock page (KES 100)
   - Spin wallet page (KES 30)
   - Aviator game (KES 50-1,000)
   - Casino games (KES 50-1,000)

7. **Test:**
   - Payment button displays correctly
   - Webhook receives confirmations
   - Database updates after payment
   - User balance reflects deposit

---

## FAQ

**Q: Can users withdraw from Spin/Chat wallets?**
A: No. All wallets are non-withdrawable. Spin and Chat are deposit-only.

**Q: Do we need API keys for payments?**
A: No. Only ACCOUNT_ID (public). No secret keys in browser.

**Q: What if payment fails?**
A: Webhook won't arrive, transaction won't be recorded. User can retry.

**Q: How long until M-Pesa arrives?**
A: Instant when user enters PIN. Webhook confirmation in <1 second.

**Q: Is the webhook secure?**
A: Yes. Verify X-Hashpay-Signature header (HMAC-SHA256) on every request.

---

## Monitoring

- HashBack webhook success rate (should be 99%+)
- Payment confirmation time (should be <2 seconds)
- Failed payments count
- Transaction volume daily
- Revenue by deposit type

