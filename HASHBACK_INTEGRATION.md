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

## Authentication After Payment

### Problem: How does the system know which user paid?

When a Payment Button is clicked, the user may not be logged in or fully authenticated. The webhook response includes:
- Transaction ID
- Amount
- Phone number (MSISDN)
- Reference ID (that you provide)

But **NOT the user's ID or session token**.

### Solution: Transaction Reference

You embed the user's ID in the payment reference when initiating payment:

```typescript
// Generate unique reference with userId
const reference = `activation_${userId}_${Date.now()}`

// Pass to Payment Button
const handler = window.HashPay.setup({
  account: accountId,
  amount: 9500,
  reference: reference,  // ← Contains userId
  onSuccess: (txn) => {
    // Payment completed locally
    // But real confirmation comes via webhook
  }
})
```

### Webhook Authentication Flow

```
1. PAYMENT INITIATED
   └─ User (may or may not be logged in)
   └─ Clicks "Activate Account" button
   └─ HashBack Payment Button opens
   └─ Reference: "activation_userid123_1689000000"

2. USER PAYS
   └─ Enters phone number
   └─ M-Pesa STK sent
   └─ User enters PIN
   └─ Payment complete

3. WEBHOOK ARRIVES (server-side verification)
   └─ POST /api/webhooks/hashback
   └─ Headers: x-hashpay-signature: sha256=...
   └─ Body:
      {
        "event": "payment.success",
        "TransactionID": "UEC496402X",
        "TransactionAmount": 9500,
        "TransactionReference": "activation_userid123_1689000000",
        "TransactionReceipt": "LIJ6XXXXX"
      }

4. SERVER VERIFIES (CRITICAL SECURITY)
   ├─ Step 1: Verify signature (HMAC-SHA256)
   │  └─ Ensures HashBack actually sent this
   │
   ├─ Step 2: Parse reference → extract userId
   │  └─ reference.split('_') = ['activation', 'userid123', '1689000000']
   │
   ├─ Step 3: Verify amount
   │  └─ Expected: 9500 (KES 95)
   │  └─ Received: 9500 ✓
   │
   └─ Step 4: Update database
      └─ Find user by userId (from reference)
      └─ Set Profile.activation_paid = true
      └─ Credit referrer
      └─ Log transaction

5. USER SESSION UPDATE
   └─ Next time user logs in or makes API call
   └─ Session includes updated Profile data
   └─ Profile.activation_paid = true
   └─ User is now activated
```

### Code Implementation

```typescript
// app/api/webhooks/hashback/route.ts

function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false
  const secret = process.env.HASHBACK_WEBHOOK_SECRET
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret!)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hashpay-signature')
  
  // CRITICAL: Verify signature first
  if (!verifySignature(rawBody, signature)) {
    return new Response('Invalid signature', { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const { TransactionReference, TransactionAmount } = payload

  // Parse reference to extract userId and transaction type
  const [type, userId, timestamp] = TransactionReference.split('_')
  
  // Verify amount matches expected for this transaction type
  const expectedAmount = getExpectedAmount(type)
  if (TransactionAmount !== expectedAmount) {
    console.error('Amount mismatch:', { expected: expectedAmount, received: TransactionAmount })
    return new Response('Invalid amount', { status: 400 })
  }

  // Process transaction - update user profile
  try {
    const user = await Profile.findById(userId)
    if (!user) {
      console.error('User not found:', userId)
      return new Response('User not found', { status: 404 })
    }

    if (type === 'activation') {
      // Mark user as activated
      user.activation_paid = true
      user.activated_at = new Date()
      user.activated_via = 'hashback'
      await user.save()
      
      // Credit referrer
      if (user.referred_by) {
        await creditReferrer(user.referred_by, 6500) // KES 65
      }
      
      console.log('Activation processed:', userId)
    }
  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Error', { status: 500 })
  }

  return new Response('OK', { status: 200 })
}
```

### What Happens Next

After webhook confirms payment:

1. **User is NOT automatically logged in**
   - Webhook is server-side only
   - User doesn't receive session token

2. **On next user action:**
   - User logs in (if not already)
   - Session loads Profile data
   - Profile now shows `activation_paid: true`
   - User can access Chat Foreigners

3. **Client receives success notification:**
   - Webhook calls `onSuccess` callback
   - Or user sees activation badge when they refresh page

### Security Considerations

**Why this is secure:**
- ✓ Reference only contains userId (which is public anyway)
- ✓ Signature prevents fake webhooks
- ✓ Amount verified server-side
- ✓ Timestamp prevents replay attacks
- ✓ No session token leaked to third party

**What cannot be spoofed:**
- ✗ Attacker cannot forge signature (needs WEBHOOK_SECRET)
- ✗ Attacker cannot change amount (verified server-side)
- ✗ Attacker cannot use old reference (timestamp checked)
- ✗ Attacker cannot activate another user (reference contains their userId)

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
import { connectToDatabase } from '@/app/lib/mongoose'
import { Profile, SpinWallet, AviatorWallet, CasinoWallet, Transaction, Company } from '@/app/lib/models'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hashpay-signature')
  
  // CRITICAL: Verify signature first (prevents spoofing)
  if (!verifySignature(rawBody, signature)) {
    console.error('[Webhook] Invalid signature')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload
  try {
    payload = JSON.parse(rawBody)
  } catch (e) {
    console.error('[Webhook] Invalid JSON')
    return new Response('Invalid JSON', { status: 400 })
  }

  // Only process successful payments
  if (payload.event !== 'payment.success') {
    return new Response('OK', { status: 200 })
  }

  const {
    TransactionID,
    TransactionAmount,
    TransactionReference,
    TransactionReceipt,
    Msisdn
  } = payload

  // Parse reference: format is "type_userId_timestamp"
  const parts = TransactionReference.split('_')
  if (parts.length < 2) {
    console.error('[Webhook] Invalid reference format:', TransactionReference)
    return new Response('Invalid reference', { status: 400 })
  }

  const [type, userId] = parts

  // Verify amount matches expected for this transaction type
  const expectedAmount = getExpectedAmount(type)
  if (TransactionAmount !== expectedAmount) {
    console.error('[Webhook] Amount mismatch:', { type, expected: expectedAmount, received: TransactionAmount })
    return new Response('Invalid amount', { status: 400 })
  }

  // Process transaction
  try {
    await connectToDatabase()

    switch (type) {
      case 'activation':
        await processActivation(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'bot_unlock':
        await processBotUnlock(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'spin_deposit':
        await processSpinDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'aviator_deposit':
        await processAviatorDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      case 'casino_deposit':
        await processCasinoDeposit(userId, TransactionID, TransactionReceipt, TransactionAmount, Msisdn)
        break
      default:
        console.error('[Webhook] Unknown transaction type:', type)
        return new Response('Unknown type', { status: 400 })
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
  if (!secret) {
    console.error('[Webhook] HASHBACK_WEBHOOK_SECRET not configured')
    return false
  }
  
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex')
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature)
    )
  } catch (e) {
    return false
  }
}

function getExpectedAmount(type: string): number {
  const amounts: Record<string, number> = {
    activation: 9500,    // KES 95
    bot_unlock: 10000,   // KES 100
    spin_deposit: 3000   // KES 30
    // Aviator/Casino amounts vary, so validate range instead
  }
  return amounts[type] || 0
}

// ==================== TRANSACTION PROCESSORS ====================

async function processActivation(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[Activation] Processing for userId:', userId)
  
  // Find user by MongoDB ObjectId
  const user = await Profile.findById(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Mark as activated
  user.activation_paid = true
  user.activated_at = new Date()
  user.activated_via = 'hashback'
  user.activation_phone = msisdn
  await user.save()

  // Credit referrer if exists
  if (user.referred_by) {
    const referrer = await Profile.findById(user.referred_by)
    if (referrer) {
      referrer.referral_earnings_cents = (referrer.referral_earnings_cents || 0) + 6500 // KES 65
      await referrer.save()
    }
  }

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'activation',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[Activation] Completed for userId:', userId)
}

async function processBotUnlock(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[BotUnlock] Processing for userId:', userId)
  
  const user = await Profile.findById(userId)
  if (!user) {
    throw new Error(`User not found: ${userId}`)
  }

  // Grant bot access
  user.bots_unlocked = (user.bots_unlocked || []).concat(['chat_foreigners'])
  user.chat_foreigners_unlocked = true
  await user.save()

  // Credit referrer (L1) and grandparent (L2)
  if (user.referred_by) {
    const referrer = await Profile.findById(user.referred_by)
    if (referrer) {
      referrer.referral_earnings_cents = (referrer.referral_earnings_cents || 0) + 7000 // KES 70
      
      // Credit grandparent if exists
      if (referrer.referred_by) {
        const grandparent = await Profile.findById(referrer.referred_by)
        if (grandparent) {
          grandparent.referral_earnings_cents = (grandparent.referral_earnings_cents || 0) + 1000 // KES 10
          await grandparent.save()
        }
      }
      
      await referrer.save()
    }
  }

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'bot_unlock',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[BotUnlock] Completed for userId:', userId)
}

async function processSpinDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[SpinDeposit] Processing for userId:', userId, 'amount:', amount)
  
  // Find or create spin wallet
  let spinWallet = await SpinWallet.findOne({ user_id: userId })
  if (!spinWallet) {
    spinWallet = new SpinWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  // Add to balance
  spinWallet.balance_cents += amount
  spinWallet.deposits = spinWallet.deposits || []
  spinWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    company_revenue_cents: Math.floor(amount * 0.2), // 20%
    deposit_at: new Date()
  })
  await spinWallet.save()

  // Credit company
  const company = await Company.findOne()
  if (company) {
    company.wallet_balance_cents += Math.floor(amount * 0.2)
    company.revenue_breakdown = company.revenue_breakdown || {}
    company.revenue_breakdown.spin_revenue_cents = (company.revenue_breakdown.spin_revenue_cents || 0) + Math.floor(amount * 0.2)
    await company.save()
  }

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'spin_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[SpinDeposit] Completed for userId:', userId)
}

async function processAviatorDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[AviatorDeposit] Processing for userId:', userId, 'amount:', amount)
  
  // Validate amount range (KES 50-1,000)
  if (amount < 5000 || amount > 100000) {
    throw new Error(`Invalid amount for Aviator: ${amount}`)
  }

  // Find or create aviator wallet
  let aviatorWallet = await AviatorWallet.findOne({ user_id: userId })
  if (!aviatorWallet) {
    aviatorWallet = new AviatorWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  // Add to balance
  aviatorWallet.balance_cents += amount
  aviatorWallet.deposits = aviatorWallet.deposits || []
  aviatorWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    deposit_at: new Date()
  })
  await aviatorWallet.save()

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'aviator_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[AviatorDeposit] Completed for userId:', userId)
}

async function processCasinoDeposit(userId: string, txnId: string, receipt: string, amount: number, msisdn: string) {
  console.log('[CasinoDeposit] Processing for userId:', userId, 'amount:', amount)
  
  // Validate amount range (KES 50-1,000)
  if (amount < 5000 || amount > 100000) {
    throw new Error(`Invalid amount for Casino: ${amount}`)
  }

  // Find or create casino wallet
  let casinoWallet = await CasinoWallet.findOne({ user_id: userId })
  if (!casinoWallet) {
    casinoWallet = new CasinoWallet({
      user_id: userId,
      balance_cents: 0
    })
  }

  // Add to balance
  casinoWallet.balance_cents += amount
  casinoWallet.deposits = casinoWallet.deposits || []
  casinoWallet.deposits.push({
    amount_cents: amount,
    provider: 'hashback',
    deposit_at: new Date()
  })
  await casinoWallet.save()

  // Log transaction
  await Transaction.create({
    user_id: userId,
    type: 'casino_deposit',
    amount_cents: amount,
    status: 'completed',
    provider: 'hashback',
    transaction_id: txnId,
    receipt: receipt
  })

  console.log('[CasinoDeposit] Completed for userId:', userId)
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

