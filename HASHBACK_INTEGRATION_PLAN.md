# HashBack Integration Plan - Complete
## Sandy Platform - Full Payment System Migration

**Version:** 2.0  
**Status:** Ready for Implementation  
**Last Updated:** 2026-07-13  
**Author:** v0 AI

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Current State](#current-state)
3. [HashBack API Overview](#hashback-api-overview)
4. [Implementation Strategy](#implementation-strategy)
5. [Payment Flows](#payment-flows)
6. [Wallet Management](#wallet-management)
7. [B2C Withdrawals](#b2c-withdrawals)
8. [HashPeer P2P Integration](#hashpeer-p2p-integration)
9. [Database Schema Changes](#database-schema-changes)
10. [File Structure](#file-structure)
11. [Implementation Phases](#implementation-phases)
12. [Security Considerations](#security-considerations)
13. [Testing Strategy](#testing-strategy)
14. [Deployment Plan](#deployment-plan)

---

## Executive Summary

Sandy requires a complete payment system overhaul to integrate HashBack as the primary payment provider while maintaining Co-op Bank as a fallback. HashBack provides:

- **STK Push Payments** (<50ms response time)
- **Real-time Confirmation** (immediate vs 5+ min delays)
- **Wallet Management** (balance, topup, withdrawals)
- **P2P Confirmation** (for referral payouts)
- **MSISDN Decoding** (phone number recovery)
- **Transaction Reconciliation** (PULL API)

### Why HashBack?
- ✅ **Speed:** <50ms vs 10-15s current
- ✅ **UX:** Drop-in button vs manual integration
- ✅ **Real-time:** Instant confirmation vs delayed activation
- ✅ **Wallet Built-in:** B2C withdrawals included
- ✅ **Reliability:** P2P backup confirmation layer
- ✅ **Compliance:** HMAC-SHA256 signature verification

---

## Current State

### Existing Payment Infrastructure
- **Primary:** Co-op Bank API (slow, 10-15 second activation delay)
- **Activation Fee:** KES 95 (9,500 cents)
- **Bot Unlock:** KES 100 (10,000 cents) - Lifetime access
- **Referral L1:** KES 65 (6,500 cents) - 70% of bot unlock
- **Referral L2:** KES 10 (1,000 cents) - 10% of bot unlock
- **Company Share:** KES 20 (2,000 cents) - 20% of bot unlock

### Current Issues
1. Activation delay: 5+ minutes after payment (chronic bug fixed, but still slow)
2. No real-time wallet visibility
3. Manual withdrawal process
4. Limited transaction reconciliation
5. Single point of failure (Co-op Bank only)

---

## HashBack API Overview

### Base URLs
```
HashBack Decode:     https://api.hashback.co.ke/
HashPay (STK/PULL):  https://api.hashback.co.ke/
Wallet B2C V2:       https://api.hashback.co.ke/V2/
HashPeer P2P:        https://p2p.hashback.co.ke/
```

### Authentication Methods

#### 1. Header Authentication (Decode API Only)
```javascript
fetch('https://api.hashback.co.ke/decode', {
  method: 'POST',
  headers: { 'API_KEY': 'YOUR_API_KEY' },
  body: new URLSearchParams({ hash: '...' })
})
```

#### 2. Body Authentication (HashPay & Wallet)
```javascript
{
  "api_key": "YOUR_API_KEY",
  "account_id": "YOUR_ACCOUNT_ID"
}
```

#### 3. X-Api-Key Header (HashPeer P2P)
```javascript
fetch('https://p2p.hashback.co.ke/api/v1/query?tx_code=QH7X8LKJ22', {
  headers: { 'X-Api-Key': 'YOUR_API_KEY' }
})
```

### Rate Limiting
| Endpoint Group | Limit | Window |
|---|---|---|
| All endpoints | 100 requests | Per minute |
| Decode API | 10 requests | Per 5 seconds |
| HashPeer P2P | 60 requests | Per 60 seconds |

**Response on Rate Limit:** HTTP 429 with exponential backoff required

---

## Implementation Strategy

### Dual Provider Architecture
```
┌─ User Payment Flow ─┐
│                     │
├─> HashBack (PRIMARY)
│   ├─ STK Push
│   ├─ Instant Confirmation
│   └─ Real-time Wallet
│
└─> Co-op Bank (FALLBACK)
    ├─ STK Push
    └─ Delayed Confirmation
```

### Why Dual Provider?
1. **Redundancy:** If HashBack is down, Co-op Bank processes payment
2. **Zero Downtime:** Both systems can coexist during migration
3. **User Choice:** Future option for users to select preferred provider
4. **Revenue Diversification:** Better rates negotiation

### Migration Path
**Phase 1 (Week 1):** Infrastructure & APIs  
**Phase 2 (Week 2):** Business Logic & UI  
**Phase 3 (Week 3):** Testing & Deployment  

---

## Payment Flows

### Flow 1: Activation Payment (KES 95)

#### User Triggers Activation
1. User clicks "Activate Account" button
2. App calls `initiateActivationPayment()`
3. System returns HashBack payment UI with:
   - Amount: KES 95
   - Reference: `activation_${userId}_${timestamp}`
   - Account ID: HashBack public account

#### Payment Processing
```
User Payment STK → HashBack STK Push → M-Pesa Prompt → PIN Entry → Payment Confirmed
         ↓
   Webhook Notification
         ↓
   Verify HMAC-SHA256 Signature
         ↓
   Update Database: user.approval_status = 'approved', user.rank = 'Starter'
         ↓
   Send Confirmation Email
```

#### Webhook Payload (HashPay)
```json
{
  "event": "payment.success",
  "ResponseCode": 0,
  "ResponseDescription": "Success. Request accepted for processing",
  "MerchantRequestID": "ws_CO_12052026084940",
  "CheckoutRequestID": "ws_CO_12052026084940776662",
  "TransactionID": "UEC496402X",
  "TransactionAmount": 95,
  "TransactionReceipt": "UEC496402X",
  "TransactionDate": 20260512084950,
  "TransactionReference": "activation_userId_timestamp",
  "Msisdn": 254701234567,
  "AccountID": "HP56"
}
```

### Flow 2: Bot Unlock Payment (KES 100)

#### User Unlocks Bot
1. User clicks "Unlock Chat" on personality card
2. App calls `initiateBoUnlockPayment(botId)`
3. System calculates revenue split:
   - L1 Direct Referrer: KES 70
   - L2 Grandparent: KES 10
   - Company Wallet: KES 20

#### Payment & Distribution
```
Payment Received → Webhook → Verify Signature
         ↓
User Balance: +100 (from company wallet)
         ↓
L1 Referrer Balance: +70
         ↓
L2 Referrer Balance: +10
         ↓
Company Wallet: +20
         ↓
Create ChatForeignersBotAccess Record
         ↓
Send Success Email
```

#### Database Updates
```typescript
// User record
user.unlocked_bots.push(botId);
user.total_unlocks_cents += 10000; // Track for rewards

// Referrer records
l1Referrer.balance_cents += 7000;
l1Referrer.earned_cents += 7000;
l2Referrer.balance_cents += 1000;
l2Referrer.earned_cents += 1000;

// Company wallet
company.wallet_balance_cents += 2000;
company.total_revenue_cents += 2000;

// Transaction log
Transaction.create({
  user_id: userId,
  amount_cents: 10000,
  type: 'bot_unlock',
  bot_id: botId,
  provider: 'hashback',
  status: 'completed',
  l1_referrer_id: l1Referrer._id,
  l1_amount_cents: 7000,
  l2_referrer_id: l2Referrer._id,
  l2_amount_cents: 1000,
  receipt: receipt_number
})
```

### Flow 3: Chat Message Payments (Earning KES 10 per message)

#### User Earns from Chat
1. User sends message in Chat Foreigners
2. System credits balance immediately: `+10 cents` (per message)
3. No payment required - pure earnings

#### Limitations
- Max 30 messages per minute (rate limited)
- Max 1,000 messages per day (cap)
- Daily earnings cap: KES 100 (10,000 cents)

---

## Wallet Management

### Wallet Types

#### 1. User Wallet
- **Balance:** Total KES available
- **Source:** Activation fees, referrals, message earnings
- **Usage:** Withdraw to phone

#### 2. Company Wallet
- **Balance:** Revenue from bot unlocks + platform fees
- **Source:** Bot unlock payments (KES 20 per unlock)
- **Usage:** Company operations, topups

#### 3. Referrer Wallets
- **Balance:** Referral commissions
- **Source:** L1 (KES 65 per activate, KES 70 per bot unlock) + L2 (KES 10 per bot unlock)
- **Usage:** Withdraw to phone

### Wallet Operations

#### Check Balance
```typescript
async function checkHashBackWalletBalance() {
  const response = await fetch('https://api.hashback.co.ke/walletbalance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.HASHBACK_API_KEY,
      account_id: process.env.HASHBACK_ACCOUNT_ID
    })
  });
  
  const data = await response.json();
  // {
  //   "success": true,
  //   "walletId": "HP56",
  //   "balance": 47,
  //   "status": "Active",
  //   "currency": "KES"
  // }
  
  return {
    balance_kes: data.balance,
    status: data.status,
    currency: data.currency
  };
}
```

#### Top Up Wallet via STK Push
```typescript
async function topUpHashBackWallet(amount_kes: number, msisdn: string) {
  const response = await fetch('https://api.hashback.co.ke/v2/topup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.HASHBACK_API_KEY,
      walletid: process.env.HASHBACK_WALLET_ID,
      amount: String(amount_kes),
      msisdn: msisdn
    })
  });
  
  const data = await response.json();
  return data;
}
```

---

## B2C Withdrawals

### Withdrawal Flow

#### User Initiates Withdrawal
1. User enters amount (KES 10 minimum)
2. User confirms phone number
3. System validates balance
4. System processes B2C withdrawal

#### B2C Processing
```
Withdrawal Request → Validation
         ↓
User Balance >= Amount ✓
Phone Number Valid ✓
Daily Limit Not Exceeded ✓
         ↓
Call HashBack B2C API (V2)
         ↓
Withdrawal Processed Successfully
         ↓
Update User Balance: balance -= amount
         ↓
Create Withdrawal Record
         ↓
Send SMS Notification to User
```

#### B2C API Call
```typescript
async function processWithdrawal(
  userPhoneNumber: string,
  amountKes: number
): Promise<WithdrawalResult> {
  const response = await fetch('https://api.hashback.co.ke/V2/processwithdrawal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.HASHBACK_API_KEY,
      msisdn: userPhoneNumber,
      amount: String(amountKes),
      SecurityCredential: process.env.HASHBACK_SECURITY_CREDENTIAL
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      success: true,
      withdrawal_amount: data.details.amount,
      fee: data.details.fee,
      total_deducted: data.details.total,
      new_balance: data.details.balance
    };
  } else {
    throw new Error(`Withdrawal failed: ${data.message}`);
  }
}
```

#### Withdrawal Response
```json
{
  "success": true,
  "message": "Withdrawal processed successfully",
  "details": {
    "amount": 50,
    "fee": 5,
    "total": 55,
    "balance": 92
  }
}
```

#### Withdrawal Limits
- Minimum: KES 10
- Maximum per transaction: KES 50,000
- Daily limit: KES 100,000
- Monthly limit: KES 500,000
- Fee: 10% of withdrawal amount

#### Database Withdrawal Record
```typescript
Withdrawal.create({
  user_id: userId,
  amount_cents: 5000, // User receives
  fee_cents: 500,     // Platform fee
  total_deducted_cents: 5500,
  phone_number: userPhoneNumber,
  provider: 'hashback',
  status: 'completed',
  transaction_id: hashback_txn_id,
  created_at: new Date(),
  completed_at: new Date()
})
```

---

## HashPeer P2P Integration

### Purpose
HashPeer provides real-time M-Pesa SMS transaction confirmation for referral payouts and verification.

### Base URL
```
https://p2p.hashback.co.ke/
```

### Endpoint 1: Query Transaction by M-Pesa Code

#### Request
```bash
curl -G https://p2p.hashback.co.ke/api/v1/query \
  -H "X-Api-Key: YOUR_API_KEY" \
  --data-urlencode "tx_code=QH7X8LKJ22"
```

#### Response (Pending)
```json
{
  "success": true,
  "message": "Transaction found.",
  "transaction": {
    "id": 1234,
    "tx_code": "QH7X8LKJ22",
    "type": "RECEIVED",
    "amount": 1500,
    "contact": "0704971999",
    "contact_name": "John Doe",
    "tx_timestamp": 1716800000000,
    "status": 0,
    "status_label": "pending",
    "confirmed_at": null,
    "added_at": "2026-05-27 10:30:00"
  }
}
```

#### Use Case in Sandy
```typescript
// When referrer claims they received payout SMS
async function verifyReferralPayout(mPesaCode: string) {
  const response = await fetch(
    `https://p2p.hashback.co.ke/api/v1/query?tx_code=${mPesaCode}`,
    {
      headers: { 'X-Api-Key': process.env.HASHPEER_API_KEY }
    }
  );
  
  const data = await response.json();
  
  if (data.success && data.transaction.status === 1) {
    // Confirmed! Update referrer record
    return {
      verified: true,
      amount: data.transaction.amount,
      contact: data.transaction.contact,
      confirmed_at: data.transaction.confirmed_at
    };
  }
  
  return { verified: false };
}
```

### Endpoint 2: Confirm Pending Payment

#### Request (by Transaction Code)
```bash
curl -X POST https://p2p.hashback.co.ke/api/v1/confirm \
  -H "X-Api-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tx_code": "QH7X8LKJ22"}'
```

#### Response (Confirmed)
```json
{
  "success": true,
  "message": "Payment confirmed.",
  "transaction": {
    "id": 1234,
    "tx_code": "QH7X8LKJ22",
    "type": "RECEIVED",
    "amount": 1500,
    "contact": "0704971999",
    "contact_name": "John Doe",
    "tx_timestamp": 1716800000000,
    "status": 1,
    "confirmed_at": "2026-05-27 10:40:00",
    "added_at": "2026-05-27 10:30:00"
  }
}
```

### P2P Webhooks

#### When Transaction Confirmed
```json
{
  "event": "payment.confirmed",
  "transaction": {
    "id": 1234,
    "tx_code": "QH7X8LKJ22",
    "type": "RECEIVED",
    "amount": 1500,
    "contact": "0704971999",
    "contact_name": "John Doe",
    "tx_timestamp": 1716800000000,
    "status": 1,
    "confirmed_at": "2026-05-27 10:40:00",
    "added_at": "2026-05-27 10:30:00"
  }
}
```

#### Webhook Signature Verification
```typescript
import crypto from 'crypto';

function verifyHashPeerSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

---

## MSISDN Decoding

### Purpose
Decode hashed phone numbers back to real MSISDN format. Useful for:
- Payment verification
- User phone recovery
- Contact reconciliation

### API Endpoint

#### Request
```javascript
const res = await fetch('https://api.hashback.co.ke/decode', {
  method: 'POST',
  headers: { 'API_KEY': 'YOUR_API_KEY_HERE' },
  body: new URLSearchParams({
    hash: '4f87c55d393937f18fbf3003512195aa8e62be340946ab547c2eada26cc43c1e'
  })
});

const { MSISDN } = await res.json();
console.log(MSISDN); // "254712345678"
```

#### Response
```json
{
  "ResultCode": "0",
  "MSISDN": "254712345678"
}
```

#### Rate Limit
- 10 requests per 5 seconds
- Typical response time: <50ms

---

## PULL API - Transaction Reconciliation

### Purpose
Look up any transaction by ID for reconciliation, auditing, and receipt generation.

### Request
```bash
curl -X POST https://api.hashback.co.ke/v1/pullapi \
  -H 'Content-Type: application/json' \
  -d '{
    "api_key": "API_KEY",
    "account_id": "ACCOUNT_ID",
    "transaction_id": "TRANS_ID"
  }'
```

### Response (Found)
```json
{
  "success": true,
  "data": {
    "transactionId": "TRANS_ID",
    "amount": 499,
    "billreference": "BILL_REF",
    "AccName": "ACC NAME"
  }
}
```

### Use Case in Sandy
```typescript
async function reconcileHashBackTransaction(transactionId: string) {
  const response = await fetch('https://api.hashback.co.ke/v1/pullapi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.HASHBACK_API_KEY,
      account_id: process.env.HASHBACK_ACCOUNT_ID,
      transaction_id: transactionId
    })
  });
  
  const data = await response.json();
  
  if (data.success) {
    return {
      transaction_id: data.data.transactionId,
      amount: data.data.amount / 100, // Convert to KES
      reference: data.data.billreference,
      account_name: data.data.AccName
    };
  }
  
  return null;
}
```

---

## Database Schema Changes

### New/Modified Collections

#### 1. Profile Schema (Modified)
```typescript
{
  // Existing fields...
  
  // Payment providers
  payment_provider: 'hashback' | 'coop-bank', // Default: 'hashback'
  
  // HashBack specific
  hashback_account_id?: string,
  hashback_phone_number?: string,
  
  // Wallet
  balance_cents: number, // Total balance in cents (KES)
  wallet_status: 'active' | 'suspended' | 'inactive',
  
  // Earnings tracking
  earned_cents: number, // Total lifetime earnings
  withdrawn_cents: number, // Total withdrawn
  pending_withdrawal_cents: number,
  
  // Referral tracking
  l1_referrer_id?: ObjectId,
  referral_code: string,
  total_referrals: number,
  referral_earnings_cents: number,
  
  // Chat Foreigners
  unlocked_bots: [ObjectId],
  total_message_earnings_cents: number,
  daily_message_count: number,
  daily_message_earned_cents: number,
  last_message_date: Date
}
```

#### 2. Transaction Model (New)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  amount_cents: number,
  type: 'activation' | 'bot_unlock' | 'message_earn' | 'referral' | 'withdrawal',
  provider: 'hashback' | 'coop-bank',
  status: 'pending' | 'completed' | 'failed' | 'refunded',
  
  // Payment details
  transaction_id: string, // HashBack TransactionID
  receipt_number: string, // M-Pesa receipt
  phone_number: string,
  reference: string,
  
  // Revenue split (for bot unlock)
  l1_referrer_id?: ObjectId,
  l1_amount_cents?: number,
  l2_referrer_id?: ObjectId,
  l2_amount_cents?: number,
  company_amount_cents?: number,
  
  // Webhook data
  merchant_request_id: string,
  checkout_request_id: string,
  response_code: number,
  
  created_at: Date,
  completed_at?: Date,
  webhook_received_at?: Date
}
```

#### 3. Withdrawal Model (New)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId,
  amount_cents: number,
  fee_cents: number,
  total_deducted_cents: number,
  phone_number: string,
  provider: 'hashback' | 'coop-bank',
  
  // Status tracking
  status: 'pending' | 'completed' | 'failed' | 'reversed',
  hashback_transaction_id?: string,
  
  // Reconciliation
  initiated_at: Date,
  completed_at?: Date,
  error_message?: string,
  
  // Audit
  ip_address: string,
  user_agent: string
}
```

#### 4. ChatForeignersBot Model (Modified)
```typescript
{
  // Existing fields...
  
  // Payment tracking
  unlock_price_cents: number, // 10,000 (KES 100)
  l1_commission_cents: number, // 7,000 (KES 70)
  l2_commission_cents: number, // 1,000 (KES 10)
  company_share_cents: number, // 2,000 (KES 20)
  
  total_unlocks: number,
  total_revenue_cents: number,
  created_date: Date
}
```

#### 5. Company Model (New)
```typescript
{
  _id: ObjectId,
  name: 'Sandy Inc',
  
  // Wallet
  wallet_balance_cents: number,
  wallet_status: 'active' | 'suspended',
  
  // Revenue tracking
  total_revenue_cents: number,
  total_expenses_cents: number,
  total_payouts_cents: number,
  
  // HashBack integration
  hashback_account_id: string,
  hashback_wallet_id: string,
  
  // Settings
  withdrawal_fee_percent: number, // 10%
  min_withdrawal_cents: number, // 1,000 (KES 10)
  max_withdrawal_cents: number, // 5,000,000 (KES 50,000)
  daily_withdrawal_limit_cents: number, // 10,000,000 (KES 100,000)
  
  created_at: Date,
  updated_at: Date
}
```

---

## File Structure

### New Files to Create (Phase 1)

#### 1. `/app/lib/services/hashback.ts`
**Purpose:** HashBack API client service  
**Methods:**
- `initiatePayment(amount, reference)` - Start STK push
- `checkWalletBalance()` - Get company wallet balance
- `topUpWallet(amount, msisdn)` - Top up wallet via STK
- `processWithdrawal(msisdn, amount)` - B2C withdrawal
- `getTransaction(transactionId)` - PULL API lookup
- `decodeMsisdn(hash)` - Decode phone number
- `verifyWebhookSignature(rawBody, signature)` - Webhook verification
- `retryFailedTransaction(transactionId)` - Retry failed payment

#### 2. `/app/api/hashback/webhook/route.ts`
**Purpose:** Receive and process HashPay webhooks  
**Endpoints:**
- `POST /api/hashback/webhook` - Receive payment success notification
- Verify HMAC-SHA256 signature
- Update database records
- Trigger activation/unlock logic
- Handle error responses

#### 3. `/app/api/hashpeer/webhook/route.ts`
**Purpose:** Receive and process HashPeer P2P webhooks  
**Endpoints:**
- `POST /api/hashpeer/webhook` - Receive payment confirmation
- Verify P2P signature
- Update referral records
- Create audit logs

#### 4. `/app/api/hashback/payment/route.ts`
**Purpose:** Initiate payment requests  
**Endpoints:**
- `POST /api/hashback/payment/activate` - Activation payment (KES 95)
- `POST /api/hashback/payment/unlock-bot` - Bot unlock (KES 100)
- `POST /api/hashback/payment/status` - Check payment status

#### 5. `/app/api/hashback/wallet/route.ts`
**Purpose:** Wallet operations  
**Endpoints:**
- `GET /api/hashback/wallet/balance` - Get user balance
- `POST /api/hashback/wallet/withdraw` - Initiate withdrawal
- `GET /api/hashback/wallet/transactions` - Transaction history
- `POST /api/hashback/wallet/topup` - Topup wallet (admin only)

#### 6. `/app/api/hashback/transactions/route.ts`
**Purpose:** Transaction reconciliation  
**Endpoints:**
- `POST /api/hashback/transactions/lookup` - Lookup by ID
- `GET /api/hashback/transactions/history` - Get user history
- `POST /api/hashback/transactions/reconcile` - Manual reconciliation (admin)

#### 7. `/app/actions/hashback.ts`
**Purpose:** Server actions for HashBack  
**Functions:**
- `initiateActivationPaymentHashBack()` - Server action for activation
- `initiateBoUnlockPaymentHashBack()` - Server action for bot unlock
- `processWithdrawalHashBack()` - Server action for withdrawal
- `completeHashBackPayment()` - Complete payment after webhook
- `handleHashBackWebhook()` - Process webhook data
- `syncHashBackWallet()` - Sync wallet from HashBack

#### 8. `/app/components/payments/hashback-payment-button.tsx`
**Purpose:** Reusable payment button component  
**Props:**
- `amount` - Amount in KES
- `reference` - Payment reference
- `onSuccess` - Success callback
- `onCancel` - Cancel callback
- `onError` - Error callback
- `variant` - Button style

#### 9. `/app/components/wallet/hashback-wallet.tsx`
**Purpose:** User wallet dashboard  
**Features:**
- Display balance
- Withdrawal form
- Transaction history
- P2P verification

### Modified Files

#### 1. `.env.local`
```bash
# HashBack
HASHBACK_API_KEY=your_api_key
HASHBACK_ACCOUNT_ID=HP945692
HASHBACK_WALLET_ID=WALLET_ID
HASHBACK_WEBHOOK_SECRET=your_webhook_secret
HASHBACK_SECURITY_CREDENTIAL=your_security_credential

# HashPeer P2P
HASHPEER_API_KEY=your_p2p_api_key
HASHPEER_WEBHOOK_SECRET=your_p2p_webhook_secret

# Fallback (Co-op Bank)
COOP_BANK_API_KEY=your_coop_key
COOP_BANK_SECRET=your_coop_secret
```

#### 2. `/app/lib/models.ts`
**Changes:**
- Add Transaction schema
- Add Withdrawal schema
- Add Company schema
- Update Profile schema with hashback fields
- Update ChatForeignersBot schema

#### 3. `/app/actions/activation.ts`
**Changes:**
- Add `payment_provider` selection logic
- Add HashBack initialization
- Update `initiateActivationPayment()` to support dual provider
- Add fallback to Co-op Bank if HashBack fails
- Update `completeActivationAfterPayment()` to handle both providers

#### 4. `/app/actions/chat-foreigners/payments.ts`
**Changes:**
- Add HashBack bot unlock flow
- Add revenue distribution logic
- Update referral payout handling
- Add webhook processing for both providers

#### 5. Payment UI Components (Multiple)
**Changes:**
- Add HashBack payment button
- Add provider selection UI (if needed)
- Add wallet display component
- Add withdrawal form component

---

## Implementation Phases

### Phase 1: Infrastructure (Week 1)
**Days 1-2:**
- Set up HashBack service layer (`hashback.ts`)
- Create database models
- Implement authentication

**Days 3-5:**
- Build webhook handlers
- Implement signature verification
- Create API routes for payments
- Test webhook reception

**Days 6-7:**
- Set up wallet operations
- Implement B2C withdrawal flow
- Test with HashBack sandbox

### Phase 2: Business Logic (Week 2)
**Days 1-2:**
- Update activation flow
- Implement dual provider logic
- Add fallback handling

**Days 3-4:**
- Update bot unlock flow
- Implement revenue distribution
- Add referral tracking

**Days 5-7:**
- Update UI components
- Add payment button
- Add wallet display
- Implement withdrawal UI

### Phase 3: Testing & Deployment (Week 3)
**Days 1-2:**
- End-to-end testing
- Sandbox testing with real M-Pesa
- Performance testing

**Days 3-4:**
- QA and bug fixes
- Security audit
- Documentation

**Days 5-7:**
- Soft launch (limited users)
- Monitor for issues
- Full production rollout

---

## Security Considerations

### 1. Webhook Signature Verification
**CRITICAL:** Verify every webhook before processing

```typescript
import crypto from 'crypto';

function verifyHashPaySignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  // Header format: "sha256=hex_digest"
  const [algorithm, signature] = signatureHeader.split('=');
  
  if (algorithm !== 'sha256') return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  // Use timing-safe comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 2. Amount Validation
**CRITICAL:** Always validate amount server-side

```typescript
// Client sends: { amount: 100, reference: 'order_123' }
// Server verifies against database before processing

const expectedAmount = (await Order.findById(reference)).price;
if (received_amount !== expectedAmount) {
  throw new Error('Amount mismatch - possible tampering');
}
```

### 3. API Key Protection
**CRITICAL:** Never expose secret API key to frontend

```
CLIENT:                    SERVER:
  ↓ (reference only)        ↑
User clicks Pay --------→ Generate Payment Link ← Uses Secret Key
  ↑                         ↓ (secure)
Result ←------------- Webhook Handler
```

### 4. Rate Limiting
Implement rate limiting to protect against abuse:

```typescript
// 100 requests per minute per API key
// 10 decode requests per 5 seconds
// Exponential backoff on 429 response

if (response.status === 429) {
  await delay(Math.pow(2, retryCount) * 1000); // 1s, 2s, 4s, 8s...
  retry(retryCount + 1);
}
```

### 5. Idempotency
Webhook may be received multiple times. Ensure idempotent operations:

```typescript
// Check if transaction already processed
const existing = await Transaction.findOne({
  transaction_id: hashbackTransactionId
});

if (existing) {
  // Already processed - return 200 OK without re-processing
  return { success: true, message: 'Already processed' };
}

// First time - process normally
```

### 6. PII Protection
- Never log phone numbers in plain text
- Mask phone numbers in logs/UI: `0704***999`
- Use TLS 1.2+ for all API calls
- Hash sensitive data when storing

### 7. Audit Logging
Log all financial transactions for compliance:

```typescript
AuditLog.create({
  user_id: userId,
  action: 'payment_received',
  amount_cents: 9500,
  provider: 'hashback',
  transaction_id: hashbackTxnId,
  webhook_id: webhookId,
  signature_verified: true,
  ip_address: req.ip,
  timestamp: new Date()
});
```

---

## Testing Strategy

### 1. Unit Tests
- Signature verification functions
- Amount validation logic
- Revenue distribution calculations
- Rate limiting logic

### 2. Integration Tests
- Payment flow end-to-end
- Webhook processing
- Database updates
- Notification sending

### 3. Sandbox Testing (HashBack)
HashBack provides sandbox endpoints for testing:

```
Sandbox URL: https://sandbox.hashback.co.ke/
Test Phone: 0701234567
Test MSISDN: 254701234567
```

### 4. Performance Testing
- Response time <50ms for decode
- Webhook processing <2s
- Wallet balance check <1s
- Database queries optimized with indexes

### 5. Load Testing
- 100 concurrent payments
- 1,000 messages/second earnings
- Webhook queue processing

### 6. Security Testing
- Signature manipulation attempts (should fail)
- Amount tampering (should reject)
- Rate limit enforcement
- API key rotation

---

## Deployment Plan

### Pre-Deployment
1. **Database Migration:**
   ```bash
   # Back up production database
   # Run schema migration scripts
   # Verify all models
   ```

2. **Environment Setup:**
   ```bash
   # Set HASHBACK_* environment variables
   # Configure webhook URLs
   # Enable HashBack in settings
   ```

3. **Traffic Routing:**
   ```
   New Users:       100% → HashBack
   Existing Users:  50% → HashBack, 50% → Co-op (gradual)
   ```

### Deployment Steps
1. Deploy Phase 1 code (services, models, webhooks)
2. Enable HashBack for new users only
3. Monitor error rates for 48 hours
4. Gradually roll out to existing users (10% → 25% → 50% → 100%)
5. Full deployment after 7 days with <0.1% error rate

### Rollback Procedure
If issues arise:
```
1. Set ENABLE_HASHBACK=false
2. Route all new payments to Co-op Bank
3. Investigate issues
4. Fix and redeploy
5. Re-enable gradually
```

### Monitoring
```typescript
// Track metrics
- Payment success rate: >99%
- Webhook delivery: >99.5%
- Activation time: <30s
- Error rate: <0.1%
- Signature verification failures: 0
```

---

## Success Metrics

### Financial Metrics
- Transaction success rate: >99%
- Average activation time: <30 seconds (vs 5+ minutes)
- Daily transaction volume: Track growth
- Revenue per activation: KES 95

### User Experience
- Payment completion rate: >95%
- Withdrawal success rate: >98%
- User satisfaction: >4.5/5 stars
- Support tickets: -50% (easier process)

### Technical Metrics
- API response time: <50ms
- Webhook delivery: >99.5%
- System uptime: 99.9%
- Error rate: <0.1%

### Risk Metrics
- Fraud detection rate: <0.01%
- Amount tampering attempts: 0 (blocked)
- Signature verification failures: 0
- Unauthorized withdrawals: 0

---

## FAQ

### Q: What if HashBack is down?
**A:** Automatic fallback to Co-op Bank. Users won't notice any difference.

### Q: Can users switch providers?
**A:** Yes. In settings, users can select preferred provider. Default is HashBack.

### Q: How long does activation take?
**A:** With HashBack: <30 seconds. With Co-op: 5-15 minutes.

### Q: What about existing payments?
**A:** Co-op Bank payments continue working. No impact on existing users.

### Q: Is HashBack secure?
**A:** Yes. HMAC-SHA256 signature verification, TLS 1.2+, SOC 2 compliant.

### Q: What about rate limiting?
**A:** HashBack allows 100 requests/minute per API key. We implement exponential backoff.

### Q: How do withdrawals work?
**A:** B2C API sends money directly to user's M-Pesa account. Instant transfer.

### Q: What's the withdrawal fee?
**A:** 10% platform fee. User gets 90%, company gets 10%.

### Q: Can admins top up wallet?
**A:** Yes. Admin can topup company wallet via STK push (Wallet B2C API).

---

## Contact & Support

- **HashBack Support:** hashbacksolutions@gmail.com
- **HashBack WhatsApp:** [WhatsApp Group](https://chat.whatsapp.com/)
- **HashBack Docs:** https://docs.hashback.co.ke/
- **API Status:** https://status.hashback.co.ke/

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2026-07-13 | Complete plan with all HashBack features, B2C withdrawals, P2P integration |
| 1.0 | 2026-07-12 | Initial plan |

---

**Status:** ✅ Ready for Implementation

**Next Steps:**
1. Approval from product team
2. Environment setup (HashBack credentials)
3. Start Phase 1 implementation
4. Daily standups for progress tracking
