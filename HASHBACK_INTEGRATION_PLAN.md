# HashBack Integration Plan - Complete (ARCHIVED)
## Sandy Platform - Full Payment System Migration

⚠️ **DEPRECATED:** This document has been replaced by `HASHBACK_INTEGRATION.md`

**Use HASHBACK_INTEGRATION.md instead** - It contains the simplified, production-ready guide.

**Version:** 2.0  
**Status:** Archived (Reference only)  
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

## At a Glance - Complete Plan Summary

### What's Being Implemented

**4 Gaming Wallets** with HashBack as primary payment provider:
1. **Main Wallet** - User earnings (chat, referrals, game winnings)
2. **Spin Wallet** - KES 30 deposits, 20% company revenue
3. **Aviator Wallet** - KES 50-1,000 deposits, 50% house edge
4. **Casino Wallet** - KES 50-1,000 deposits, 50% house edge (5 games)

### 50% House Edge Policy (CRITICAL)

Both Aviator and Casino operate with **uniform 50% house edge** to cover:
- Infrastructure & hosting (40% of revenue)
- Operations & support (28% of revenue)
- Development (20% of revenue)
- Legal & compliance (8% of revenue)
- Profit margin (4% of revenue)

**Example:** User bets KES 1,000 and wins 5x → receives KES 2,500 (50% of KES 5,000 payout), company keeps KES 2,500

### Revenue Model - Monthly Example

| Source | Monthly Revenue |
|--------|-----------------|
| Bot Unlocks (1,000/mo) | KES 20,000 |
| Spin Deposits (5,000/mo) | KES 30,000 |
| Aviator Bets (10K × KES 1,000 avg) | KES 500,000 |
| Casino Bets (5K × KES 2,000 avg) | KES 500,000 |
| **Total Monthly Revenue** | **KES 1,050,000+** |

### Files Being Created - 20 New Files

**Services & APIs (6):** HashBack client, webhooks, payment routes, wallet ops, transactions  
**Server Actions (4):** HashBack actions, Aviator logic, Casino logic, Spin wallet  
**Components (10):** Payment buttons, wallet dashboard, game UIs, stats pages

### Files Being Modified - 5 Existing

`.env.local`, `lib/models.ts`, `actions/activation.ts`, `actions/chat-foreigners/payments.ts`, payment UI components

### Implementation Timeline

- **Week 1:** Core infrastructure (services, APIs, webhooks, schemas)
- **Week 2:** Business logic & UI (actions, components, pages)
- **Week 3:** Testing, QA, production deployment

### Payment Flows - At a Glance

| Flow | Amount | Provider | Speed | Activation |
|------|--------|----------|-------|------------|
| Activation | KES 95 | HashBack/Co-op | <1s | Immediate |
| Bot Unlock | KES 100 | HashBack/Co-op | <1s | Instant |
| Spin Deposit | KES 30 | HashBack | <1s | Instant |
| Aviator Deposit | KES 50-1,000 | HashBack | <1s | Instant |
| Casino Deposit | KES 50-1,000 | HashBack | <1s | Instant |
| Withdrawal | Any | HashBack B2C | <30s | Instant |

### User Outcomes (50% House Edge)

**Monthly Scenario:**
- User deposits: KES 3,000
- Expected result: Break-even to -20% (realistic)
- User retention: Via VIP rakeback (2-5% loss recovery), leaderboards, social features

**User Protection:**
- Daily deposit limit: KES 50,000
- Daily loss limit: KES 100,000
- Session timeout: 2 hours
- Self-exclusion available
- Mandatory responsible gaming warnings

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

## Wallet Management - Complete Platform Architecture

### Primary Wallets

#### 1. Main User Wallet
- **Model:** `Profile.balance_cents`
- **Balance:** Total KES available
- **Sources:**
  - Activation income (referral earnings)
  - Chat Foreigners message earnings (KES 0.10/msg, capped at KES 100/day)
  - Referral bonuses (L1: KES 65 activation, KES 70 bot unlock | L2: KES 10 bot unlock)
  - Casino/Aviator game winnings
  - Platform rewards
- **Usage:**
  - Pay for activation (KES 95)
  - Unlock Chat Foreigners bots (KES 100)
  - Deposit to Spin/Aviator/Casino wallets
  - Withdraw to M-Pesa (10% fee)
  - Min withdrawal: KES 10 | Max per txn: KES 50,000 | Daily limit: KES 100,000
- **Withdrawal Fee:** 10%

#### 2. Company Wallet
- **Model:** `Company.wallet_balance_cents`
- **Balance:** Total company revenue
- **Sources:**
  - Bot unlock payments (KES 20 per unlock from KES 100 payment)
  - Casino/Aviator house edge (5% casino, 2% aviator)
  - Spin wallet deposits (company retains 20% as revenue)
  - Platform fees
- **Usage:**
  - Top up HashBack merchant wallet
  - Operational expenses
  - Payouts to vendors
  - System maintenance
- **Tracking:** `total_revenue_cents`, `total_expenses_cents`

#### 3. Referrer Wallets
- **Model:** `Profile.referral_earnings_cents`
- **Balance:** Lifetime referral commissions
- **L1 Earnings:**
  - Per activation: KES 65 (referrer receives when user activates)
  - Per bot unlock: KES 70 (referrer receives when user unlocks bot)
- **L2 Earnings:**
  - Per bot unlock: KES 10 (grandparent receives when grandchild unlocks bot)
- **Usage:** Withdraw to M-Pesa (10% fee)

### Gaming Wallets (NEW)

#### 3. Spin Wallet (Existing - Enhanced with HashBack)
- **Model:** `SpinWallet` collection
- **Balance Field:** `balance_cents`
- **Deposit Amount:** KES 30 only
- **Cost per Spin:** KES 30
- **Min/Max Spin Cost:** KES 30 - KES 70,000 (future scalability)
- **Spin Results (Current):**
  - Try Again: 100% (no actual prize payout)
- **Spin Results (Future):**
  - KES 50, KES 100, KES 200, KES 500, KES 1,000, KES 2,500, KES 5,000, KES 10,000
  - Free Spin
- **Schema Fields:**
  - `user_id`: Reference to Profile
  - `balance_cents`: Current spendable balance
  - `total_deposited_cents`: Lifetime deposits tracking
  - `total_used_cents`: Total spent on spins
  - `total_spins`: Spin count
  - `total_wins_cents`: Total winnings (future)
  - `deposits`: Array of deposit history with timestamps
  - `spin_history`: Array of spin results with timestamps
  - `win_streak`: Current consecutive wins (future)
  - `last_spin_at`: Timestamp of last spin
- **Deposit Sources:**
  - Co-op Bank STK Push (legacy, KES 30)
  - HashBack STK Push (new, KES 30)
  - Transfer from Main Wallet (future)
- **Company Revenue:** 20% of deposit amount (recorded on deposit, not on spin)
- **Features:**
  - Real-time spin wheel animation
  - Prize history tracking
  - Daily spin limits (configurable)
  - Cool-down period between spins (5 seconds)
  - Sound effects & haptic feedback

#### 4. Aviator Wallet (NEW - Gaming)
- **Model:** `AviatorWallet` collection
- **Balance Field:** `balance_cents`
- **Deposit Amounts:** KES 50, 100, 250, 500, 1,000
- **Bet Range:** KES 10 minimum, KES 50,000 maximum per bet
- **House Edge:** 50% (company revenue - covers platform operational costs)
- **RTP (Return to Player):** 50%
- **Bet Types:** Single bet, Multiple simultaneous bets
- **Schema Fields:**
  - `user_id`: Reference to Profile
  - `balance_cents`: Current playable balance
  - `total_deposited_cents`: Lifetime deposits
  - `total_bet_cents`: Total amount wagered
  - `total_winnings_cents`: Total amount won
  - `total_losses_cents`: Total amount lost
  - `current_session`: Active game object
    - `bet_amount_cents`: Current bet
    - `started_at`: Bet timestamp
    - `cashout_at`: Cashout time (if cashed out)
    - `crash_multiplier`: Actual crash value (1.1x - 100x)
    - `status`: 'active' | 'won' | 'lost'
  - `game_history`: Array of completed games with results
  - `deposit_history`: Array of deposits
  - `session_stats`: Daily/weekly stats
  - `last_game_at`: Timestamp of last game
  - `win_streak`: Current consecutive wins
  - `loss_streak`: Current consecutive losses
  - `daily_profit_loss`: Current day P&L
- **Game Mechanics:**
  - Random crash multiplier: 1.1x to 100x
  - Server-side calculation (tamper-proof)
  - Auto-cashout option (if multiplier reached)
  - Manual cashout before crash = Win bet × multiplier
  - No cashout before crash = Lose full bet
  - Bet timeout: 30 seconds (automatic cancel if not confirmed)
  - Minimum gap between games: 3 seconds
- **Multiplier Distribution** (50% of wins go to company via house edge):
  - 1.1x - 2x: 40% probability → User receives 50% of (1.1x-2x winnings)
  - 2x - 5x: 30% probability → User receives 50% of (2x-5x winnings)
  - 5x - 10x: 15% probability → User receives 50% of (5x-10x winnings)
  - 10x - 50x: 10% probability → User receives 50% of (10x-50x winnings)
  - 50x - 100x: 5% probability → User receives 50% of (50x-100x winnings)
  
  Example: User bets KES 1,000 and crashes at 5x
  - Gross payout would be: KES 5,000
  - Company takes 50%: KES 2,500
  - User receives: KES 2,500
- **Deposit Sources:**
  - HashBack STK Push (primary)
  - Co-op Bank STK Push (fallback)
  - Transfer from Main Wallet (future)
- **Withdrawal:** Direct cashout to user main wallet (no additional fee - 50% already deducted via house edge)
- **Features:**
  - Live multiplier display
  - One-click cashout
  - Auto-cashout at multiplier
  - Bet history with graphs
  - Leaderboard (daily/weekly/monthly)
  - Notification alerts on crash
  - Sound effects & animations
  - Responsible gaming controls

#### 5. Casino Wallet (NEW - Gaming)
- **Model:** `CasinoWallet` collection
- **Balance Field:** `balance_cents`
- **Deposit Amounts:** KES 50, 100, 250, 500, 1,000
- **Bet Range:** KES 10 minimum, KES 100,000 maximum per bet
- **House Edge:** 50% uniform across all games (covers platform operational costs)
- **RTP (Return to Player):** 50% uniform across all games
- **Supported Games:**
  - **Slots:** 5 reels, 20 paylines, 50% RTP
  - **Blackjack:** Live dealer, 50% house edge (strategic play doesn't reduce edge)
  - **Roulette:** Random wheel, 50% edge, section betting
  - **Dice:** 50/50 outcomes, 1.5x multiplier (50% of bet goes to company)
  - **Baccarat:** Banker/Player/Tie betting, 50% edge uniform
- **Schema Fields:**
  - `user_id`: Reference to Profile
  - `balance_cents`: Current playable balance
  - `total_deposited_cents`: Lifetime deposits
  - `total_bet_cents`: Total amount wagered
  - `total_winnings_cents`: Total amount won
  - `total_losses_cents`: Total amount lost
  - `net_profit_loss_cents`: Total P&L
  - `current_session`: Active game object
    - `game_type`: 'slots' | 'blackjack' | 'roulette' | 'dice' | 'baccarat'
    - `bet_amount_cents`: Wager amount
    - `started_at`: Game start timestamp
    - `ended_at`: Game end timestamp
    - `result`: Win/loss/push details
    - `payout_cents`: Amount won
  - `game_history`: Array of all games played
  - `deposit_history`: Array of deposits with provider
  - `withdrawal_history`: Array of cashouts
  - `game_preferences`: Favorite games, auto-play settings
  - `responsible_gaming`: Settings and limits
    - `daily_deposit_limit_cents`: Default 5,000,000 (KES 50,000)
    - `daily_loss_limit_cents`: Default 10,000,000 (KES 100,000)
    - `session_timeout_minutes`: Default 120 minutes
    - `self_exclusion`: Suspension status
    - `cooloff_until`: Date if on cool-off period
  - `daily_stats`: { date, bets_placed, amount_wagered, amount_won, net_result }
  - `monthly_stats`: Aggregated monthly performance
  - `vip_tier`: 'bronze' | 'silver' | 'gold' | 'platinum' (based on deposits)
  - `last_game_at`: Timestamp
  - `session_start_at`: Current session start
- **Deposit Sources:**
  - HashBack STK Push (primary)
  - Co-op Bank STK Push (fallback)
  - Transfer from Main Wallet (future)
- **Withdrawal:** Direct cashout to user main wallet (no additional fee - 50% already deducted via house edge)
- **Responsible Gaming Features:**
  - Daily deposit limit (default KES 50,000)
  - Daily loss limit (default KES 100,000)
  - Session duration limit (default 2 hours)
  - Cool-off period: 24 hours (on request)
  - Self-exclusion: Permanent freeze (30/90/180 days or permanent)
  - Reality check: Popup every 30 minutes showing session stats
  - Bet history with timestamps
  - Monthly statement generation
- **VIP Tiers** (Note: Rakeback is bonus feature, doesn't reduce 50% house edge):
  - Bronze: KES 100K deposited → 2% rakeback on losses (max KES 1,000/month)
  - Silver: KES 500K deposited → 3% rakeback on losses + faster withdrawals (max KES 5,000/month)
  - Gold: KES 1M deposited → 4% rakeback on losses + VIP support (max KES 10,000/month)
  - Platinum: KES 5M+ deposited → 5% rakeback on losses + exclusive high-limit tables (max KES 25,000/month)
- **Features:**
  - Live game streaming (future)
  - Tournament modes with prize pools
  - Achievement/badge system
  - Social betting (see other players)
  - Referral boost: KES 10 per friend signup
  - Instant notifications on big wins
  - Replay/history of games
  - Responsible gaming dashboard

### Company Wallet
- **Model:** `Company` collection (singleton)
- **Balance Field:** `wallet_balance_cents`
- **Sources:**
  - Bot unlock revenue (KES 20 per unlock from KES 100)
  - Casino house edge (50% of all bets)
  - Aviator house edge (50% of all bets)
  - Spin wallet revenue (20% of deposits)
  - Platform fees
- **Daily Tracking:**
  - Total revenue by source
  - Total payouts (referrals, withdrawals)
  - Net daily profit
- **Reconciliation:** HashBack PULL API for daily settlement

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

## Gaming Wallet Payment Flows

### Flow 4: Spin Wallet Deposit (KES 30)

#### User Deposits via HashBack
1. User clicks "Top-up" on Spin Wallet
2. App shows deposit options (KES 30 only)
3. User confirms amount
4. HashBack STK push initiated
5. User enters M-Pesa PIN
6. Payment confirmed → Webhook received

#### Processing
```
Payment Success → Webhook → Verify HMAC-SHA256 Signature
         ↓
Create MpesaTransaction with deposit_type='spin_wallet'
         ↓
Credit SpinWallet.balance_cents += 3000
         ↓
Record company revenue_cents += 600 (20% of KES 30)
         ↓
Create DepositHistory entry
         ↓
Send SMS confirmation
```

#### Database Updates
```typescript
SpinWallet.findByIdAndUpdate(spinWalletId, {
  $inc: { 
    balance_cents: 3000,
    total_deposited_cents: 3000 
  },
  $push: {
    deposits: {
      amount_cents: 3000,
      provider: 'hashback',
      payment_reference: receipt,
      deposit_at: new Date(),
      company_revenue_cents: 600
    }
  }
});

Company.findByIdAndUpdate(companyId, {
  $inc: { 
    'revenue_breakdown.spin_revenue_cents': 600,
    total_revenue_cents: 600,
    wallet_balance_cents: 600
  }
});
```

### Flow 5: Aviator Game Deposit (KES 50-1,000)

#### User Deposits via HashBack
1. User selects deposit amount (KES 50, 100, 250, 500, 1,000)
2. System shows Aviator game overview
3. User confirms HashBack payment
4. STK push sent to phone
5. User enters M-Pesa PIN
6. Payment confirmed → Webhook received

#### Processing
```
Payment Success → Webhook Verification
         ↓
Create MpesaTransaction with deposit_type='aviator_wallet'
         ↓
Credit AviatorWallet.balance_cents += amount
         ↓
Update total_deposited_cents
         ↓
Create DepositHistory entry
         ↓
Emit Event: "aviator_deposit_ready"
         ↓
Send SMS + In-app Notification
```

#### Bet Placement
1. User places bet (KES 10 - KES 50,000)
2. Server generates crash multiplier (1.1x - 100x) - Server-side, never exposed
3. Multiplier animates upward (1.0x → crash)
4. User must cashout BEFORE crash
5. Result: Win (bet × multiplier) or Loss (bet forfeited)

#### House Edge Collection
```
Every bet placed:
  House Edge = bet_amount × 50%
  
If user wins:
  Payout = (bet_amount × multiplier) × 50%  (after house edge deduction)
  
If user loses:
  Company keeps full bet (100% of bet amount)
  
Example:
  User bets: KES 1,000
  Crash at: 5x multiplier
  
  If cashout before 5x:
    Gross Payout = 1,000 × 4.5 = KES 4,500
    House Edge Deduction = 4,500 × 50% = KES 2,250
    User receives = 4,500 - 2,250 = KES 2,250
    Company revenue = KES 2,250
    
  If cashout after 5x (lose):
    Payout = 0
    Company keeps full KES 1,000
    Total company revenue = KES 1,000
```

#### Database Updates
```typescript
AviatorWallet.findByIdAndUpdate(aviatorWalletId, {
  $inc: {
    total_bet_cents: betAmount,
    balance_cents: betResult === 'won' ? payoutCents : -betAmount,
    total_winnings_cents: payoutCents // If won
  },
  $push: {
    game_history: {
      bet_amount_cents: betAmount,
      crash_multiplier: multiplier,
      cashout_multiplier: userCashout,
      result: betResult,
      payout_cents: payoutCents,
      played_at: new Date()
    }
  }
});

Company.findByIdAndUpdate(companyId, {
  $inc: {
    'revenue_breakdown.aviator_revenue_cents': houseEdge,
    total_revenue_cents: houseEdge,
    wallet_balance_cents: houseEdge
  }
});
```

### Flow 6: Casino Game Deposit (KES 50-1,000)

#### User Deposits via HashBack
1. User selects game (Slots, Blackjack, Roulette, Dice, Baccarat)
2. Selects deposit amount (KES 50-1,000)
3. Confirms HashBack payment
4. STK push sent
5. User enters M-Pesa PIN
6. Payment confirmed → Webhook

#### Processing
```
Payment Success → Webhook Verification
         ↓
Create MpesaTransaction with deposit_type='casino_wallet'
         ↓
Credit CasinoWallet.balance_cents += amount
         ↓
Check responsible gaming limits
         ↓
Update daily_deposit_limit tracking
         ↓
Create DepositHistory entry
         ↓
Emit Event: "casino_ready_to_play"
         ↓
Auto-launch selected game
```

#### Bet & Game Flow (All Games)
1. User places bet (KES 10 - KES 100,000)
2. Responsible gaming check:
   - Verify daily deposit not exceeded
   - Verify daily loss not exceeded
   - Verify session time not exceeded
3. Game executes (server-side)
4. Result calculated with house edge
5. Payout sent or loss recorded

#### House Edge & RTP by Game
| Game | House Edge | RTP | User Payout |
|---|---|---|---|
| Slots | 50% | 50% | 0.5x to 2.5x (50% of win) |
| Blackjack | 50% | 50% | 0.75x to 1x (50% of 1.5-2x win) |
| Roulette | 50% | 50% | 0.5x to 17.5x (50% of 1-35x win) |
| Dice | 50% | 50% | 0.75x (50% of 1.5x win) |
| Baccarat | 50% | 50% | 0.5x to 4x (50% of 1-8x win) |

#### Database Updates
```typescript
CasinoWallet.findByIdAndUpdate(casinoWalletId, {
  $inc: {
    total_bet_cents: betAmount,
    balance_cents: payoutCents - betAmount,
    total_winnings_cents: payoutCents // If won
  },
  $push: {
    game_history: {
      game_type: gameType,
      bet_amount_cents: betAmount,
      payout_cents: payoutCents,
      result: result,
      rtp_used: rtpPercentage,
      played_at: new Date()
    }
  },
  'last_game_at': new Date()
});

// Update daily stats
CasinoWallet.updateOne(
  { user_id: userId },
  {
    $inc: {
      'daily_stats.$.bets_placed': 1,
      'daily_stats.$.amount_wagered_cents': betAmount,
      'daily_stats.$.amount_won_cents': payoutCents,
      'daily_stats.$.net_result_cents': payoutCents - betAmount
    }
  }
);

// Company revenue (5% house edge average)
Company.findByIdAndUpdate(companyId, {
  $inc: {
    'revenue_breakdown.casino_revenue_cents': houseEdgeAmount,
    total_revenue_cents: houseEdgeAmount,
    wallet_balance_cents: houseEdgeAmount
  }
});
```

### Flow 7: Gaming Wallet Cashout to Main Wallet

#### User Initiates Cashout
1. User clicks "Cashout" in Aviator/Casino wallet
2. System verifies balance (already includes 50% house edge deduction)
3. Transfers remaining balance to Main Wallet
4. Records transaction
5. Clears gaming wallet balance

#### Processing
```
Cashout Request → Validate Balance
         ↓
Check daily withdrawal limits on main wallet
         ↓
Transfer full remaining balance to Profile.balance_cents
(Note: 50% house edge already applied during betting)
         ↓
Create Transaction Record
         ↓
Update both wallet records
         ↓
Set gaming wallet balance to 0
         ↓
Send in-app notification
```

#### Database Updates
```typescript
// Debit gaming wallet
if (gameType === 'aviator') {
  AviatorWallet.findByIdAndUpdate(aviatorWalletId, {
    $set: { balance_cents: 0 }  // Clear remaining balance after cashout
  });
} else if (gameType === 'casino') {
  CasinoWallet.findByIdAndUpdate(casinoWalletId, {
    $set: { balance_cents: 0 }  // Clear remaining balance after cashout
  });
}

// Credit main wallet with full remaining balance
// (50% house edge already deducted during each bet)
Profile.findByIdAndUpdate(userId, {
  $inc: { balance_cents: cashoutAmount }
});

// Record transaction
Transaction.create({
  user_id: userId,
  amount_cents: cashoutAmount,
  type: 'gaming_cashout',
  provider: 'internal',
  status: 'completed',
  game_type: gameType,
  fee_cents: 0,  // No additional fee (house edge already applied)
  created_at: new Date()
});
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

#### 5. AviatorWallet Model (New)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId, // Reference to Profile
  
  // Balance
  balance_cents: number,
  
  // Lifetime stats
  total_deposited_cents: number,
  total_bet_cents: number,
  total_winnings_cents: number,
  total_losses_cents: number,
  net_profit_loss_cents: number,
  
  // Current session
  current_session: {
    bet_amount_cents: number,
    started_at: Date,
    cashout_at?: Date,
    crash_multiplier: number, // Final multiplier (1.1 - 100)
    status: 'active' | 'won' | 'lost',
    payout_cents: number
  } | null,
  
  // History
  game_history: [{
    _id: ObjectId,
    bet_amount_cents: number,
    crash_multiplier: number,
    cashout_multiplier?: number, // If user cashed out before crash
    result: 'won' | 'lost',
    payout_cents: number,
    played_at: Date
  }],
  
  deposit_history: [{
    _id: ObjectId,
    amount_cents: number,
    provider: 'hashback' | 'coop-bank',
    payment_reference: string,
    deposit_at: Date
  }],
  
  // Streaks
  win_streak: number,
  loss_streak: number,
  best_win_streak: number,
  
  // Daily tracking
  daily_profit_loss: number,
  daily_bets_placed: number,
  daily_total_wagered_cents: number,
  
  last_game_at: Date,
  created_at: Date,
  updated_at: Date
}
```

#### 6. CasinoWallet Model (New)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId, // Reference to Profile
  
  // Balance
  balance_cents: number,
  
  // Lifetime stats
  total_deposited_cents: number,
  total_bet_cents: number,
  total_winnings_cents: number,
  total_losses_cents: number,
  net_profit_loss_cents: number,
  
  // Current session
  current_session: {
    game_type: 'slots' | 'blackjack' | 'roulette' | 'dice' | 'baccarat',
    bet_amount_cents: number,
    started_at: Date,
    result?: {
      outcome: 'win' | 'loss' | 'push',
      payout_cents: number
    }
  } | null,
  
  // Game history
  game_history: [{
    _id: ObjectId,
    game_type: 'slots' | 'blackjack' | 'roulette' | 'dice' | 'baccarat',
    bet_amount_cents: number,
    payout_cents: number,
    result: 'win' | 'loss' | 'push',
    rtp_used: number, // Actual RTP for this game
    played_at: Date
  }],
  
  // Deposits & Withdrawals
  deposit_history: [{
    _id: ObjectId,
    amount_cents: number,
    provider: 'hashback' | 'coop-bank',
    payment_reference: string,
    deposit_at: Date
  }],
  
  withdrawal_history: [{
    _id: ObjectId,
    amount_cents: number,
    fee_cents: number,
    net_amount_cents: number,
    status: 'completed' | 'pending' | 'failed',
    withdrawn_at: Date
  }],
  
  // Game preferences
  game_preferences: {
    favorite_games: string[],
    auto_play_enabled: boolean,
    auto_play_rounds?: number,
    sound_enabled: boolean,
    notifications_enabled: boolean
  },
  
  // Responsible gaming
  responsible_gaming: {
    daily_deposit_limit_cents: number, // 5,000,000 (KES 50,000)
    daily_loss_limit_cents: number, // 10,000,000 (KES 100,000)
    session_timeout_minutes: number, // 120 (2 hours)
    self_exclusion: boolean,
    cooloff_until?: Date,
    last_reality_check: Date
  },
  
  // Streaks & Achievements
  win_streak: number,
  loss_streak: number,
  best_win_streak: number,
  achievements: string[], // 'first_win', 'big_win_10x', 'millionaire', etc.
  
  // VIP Tier
  vip_tier: 'bronze' | 'silver' | 'gold' | 'platinum',
  vip_rakeback_percent: number, // 1%, 2%, 3%, 5%
  
  // Daily stats
  daily_stats: {
    date: Date,
    bets_placed: number,
    amount_wagered_cents: number,
    amount_won_cents: number,
    net_result_cents: number
  }[],
  
  // Monthly aggregates
  monthly_stats: {
    month: string, // 'YYYY-MM'
    total_wagered_cents: number,
    total_won_cents: number,
    net_result_cents: number,
    games_played: number,
    win_rate: number // percentage
  }[],
  
  // Tracking
  last_game_at: Date,
  session_start_at?: Date,
  created_at: Date,
  updated_at: Date
}
```

#### 7. SpinWallet Model (Enhanced)
```typescript
{
  _id: ObjectId,
  user_id: ObjectId, // Reference to Profile
  
  // Balance
  balance_cents: number,
  
  // Lifetime tracking
  total_deposited_cents: number,
  total_used_cents: number,
  total_spins: number,
  total_wins_cents: number,
  
  // Deposits history
  deposits: [{
    _id: ObjectId,
    amount_cents: number,
    provider: 'hashback' | 'coop-bank',
    mpesa_checkout_request_id: string,
    mpesa_transaction_id?: ObjectId,
    status: 'completed' | 'failed',
    deposit_at: Date,
    company_revenue_cents: number // 20% of deposit
  }],
  
  // Spin history
  spin_history: [{
    _id: ObjectId,
    amount_cents: number,
    prize_type: 'KES_50' | 'KES_100' | 'KES_200' | 'KES_500' | 'KES_1000' | 'KES_2500' | 'KES_5000' | 'KES_10000' | 'FREE_SPIN' | 'ZERO',
    prize_value_cents: number,
    result: 'win' | 'try_again',
    spun_at: Date,
    outcome?: {
      claimed: boolean,
      claimed_at?: Date,
      credited_to_wallet?: boolean
    }
  }],
  
  // Streaks
  win_streak: number,
  best_win_streak: number,
  
  // Session tracking
  daily_spins_count: number,
  daily_total_spent_cents: number,
  last_spin_at: Date,
  
  created_at: Date,
  updated_at: Date
}
```

#### 8. Company Model (Enhanced)
```typescript
{
  _id: ObjectId,
  name: 'Sandy Inc',
  
  // Main wallet
  wallet_balance_cents: number,
  wallet_status: 'active' | 'suspended',
  
  // Revenue tracking by source
  revenue_breakdown: {
    bot_unlock_revenue_cents: number,
    spin_revenue_cents: number,
    aviator_revenue_cents: number,
    casino_revenue_cents: number,
    referral_fees_cents: number
  },
  
  // Overall tracking
  total_revenue_cents: number,
  total_expenses_cents: number,
  total_payouts_cents: number, // Withdrawals to users
  net_profit_cents: number,
  
  // HashBack integration
  hashback_account_id: string,
  hashback_wallet_id: string,
  hashback_last_sync: Date,
  
  // Settings & Limits
  withdrawal_fee_percent: number, // 10%
  min_withdrawal_cents: number, // 1,000 (KES 10)
  max_withdrawal_cents: number, // 5,000,000 (KES 50,000)
  daily_withdrawal_limit_cents: number, // 10,000,000 (KES 100,000)
  
  // Game settings
  spin_company_share_percent: number, // 20%
  aviator_house_edge_percent: number, // 50%
  casino_house_edge_percent: number, // 50%
  
  // Daily reconciliation
  daily_settlement: {
    date: Date,
    revenue_cents: number,
    payouts_cents: number,
    net_profit_cents: number,
    reconciled: boolean,
    reconciled_at?: Date
  }[],
  
  // Audit
  created_at: Date,
  updated_at: Date,
  last_updated_by: string // Admin ID
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

#### 8. `/app/actions/aviator.ts`
**Purpose:** Aviator game logic and betting  
**Functions:**
- `initiatAviatorDeposit(amount)` - Start aviator deposit via HashBack
- `placeBet(betAmount)` - Place a new bet
- `cashoutBet(currentMultiplier)` - Cashout before crash
- `getGameResult()` - Simulate crash and determine winner
- `getAviatorGameHistory()` - Retrieve user's game history
- `getAviatorStats()` - Get user stats (streak, wins, etc)
- `verifyServerSideHash()` - Verify game randomness

#### 9. `/app/actions/casino.ts`
**Purpose:** Casino game logic across all game types  
**Functions:**
- `initiatCasinoDeposit(amount)` - Start casino deposit via HashBack
- `playSlots(betAmount, lines)` - Play slot machine
- `playBlackjack(betAmount, action)` - Play blackjack (hit/stand/double)
- `playRoulette(betAmount, betType, number)` - Place roulette bet
- `playDice(betAmount, prediction)` - Play dice game
- `playBaccarat(betAmount, betType)` - Place baccarat bet
- `getRespGamingStatus()` - Get responsible gaming limits
- `setRespGamingLimits()` - Update daily/session limits
- `requestSelfExclusion(days)` - Initiate self-exclusion
- `getCasinoGameHistory()` - Retrieve user's game history
- `getCasinoStats()` - Get aggregated stats
- `verifyGameRandomness()` - Server-side random verification

#### 10. `/app/actions/spin-wallet-hashback.ts`
**Purpose:** Spin wallet integration with HashBack  
**Functions:**
- `initiatSpinDepositHashBack(amount)` - Deposit via HashBack (replaces Co-op)
- `syncSpinWalletBalance()` - Sync balance from database
- `getSpinWalletStats()` - Get spin statistics
- `transferMainToSpinWallet(amount)` - Transfer from main wallet (future)

#### 11. `/app/components/payments/hashback-payment-button.tsx`
**Purpose:** Reusable payment button component  
**Props:**
- `amount` - Amount in KES
- `reference` - Payment reference
- `onSuccess` - Success callback
- `onCancel` - Cancel callback
- `onError` - Error callback
- `variant` - Button style

#### 12. `/app/components/payments/aviator-payment-button.tsx`
**Purpose:** Aviator game deposit button  
**Props:**
- `amount` - Amount in KES
- `onSuccess` - Success callback
- `onDeposited` - Deposit confirmed callback
**Features:**
- HashBack deposit trigger
- Amount validation (KES 50-1000)
- Instant wallet credit

#### 13. `/app/components/payments/casino-payment-button.tsx`
**Purpose:** Casino game deposit button  
**Props:**
- `amount` - Amount in KES
- `gameType` - Game to start after deposit
- `onSuccess` - Success callback
**Features:**
- HashBack deposit trigger
- Amount validation (KES 50-1000)
- Auto-launch selected game

#### 14. `/app/components/wallet/hashback-wallet.tsx`
**Purpose:** Main user wallet dashboard  
**Features:**
- Display balance (main wallet, earned, pending)
- Withdrawal form with limits validation
- Transaction history with filters
- P2P verification for referrals
- Daily earnings breakdown

#### 15. `/app/components/games/aviator-game.tsx`
**Purpose:** Aviator game UI and interactions  
**Features:**
- Live multiplier display (1.1x - 100x)
- Bet placement form
- Cashout button (dynamic)
- Auto-cashout settings
- Bet history sidebar
- Leaderboard display
- Sound effects & animations
- Win/loss notifications

#### 16. `/app/components/games/casino-game.tsx`
**Purpose:** Casino game manager component  
**Props:**
- `gameType` - 'slots' | 'blackjack' | 'roulette' | 'dice' | 'baccarat'
- `initialBal` - Starting balance
**Sub-components:**
- `SlotsGame` - 5-reel slot machine
- `BlackjackGame` - Live blackjack with dealer
- `RouletteGame` - European roulette wheel
- `DiceGame` - 50/50 dice rolling
- `BaccaratGame` - Banker/Player/Tie betting
**Shared Features:**
- Bet placement
- Auto-play options
- Sound effects
- Responsible gaming alerts
- Win animations
- Payout display

#### 17. `/app/dashboard/games/aviator/page.tsx`
**Purpose:** Aviator game page  
**Features:**
- Game interface
- Wallet display (side panel)
- Deposit button
- Game statistics
- Leaderboard
- Withdrawal button

#### 18. `/app/dashboard/games/casino/page.tsx`
**Purpose:** Casino games hub  
**Features:**
- Game selection tabs (Slots/Blackjack/Roulette/Dice/Baccarat)
- Active game display
- Wallet panel (real-time balance)
- Deposit buttons (separate for each game)
- Responsible gaming dashboard
- History & statistics
- VIP tier display

#### 19. `/app/dashboard/wallet/games/aviator-stats.tsx`
**Purpose:** Aviator game statistics component  
**Displays:**
- Lifetime stats (wins, losses, ROI)
- Best multiplier
- Streak info
- Daily/weekly/monthly charts
- Bet distribution

#### 20. `/app/dashboard/wallet/games/casino-stats.tsx`
**Purpose:** Casino game statistics component  
**Displays:**
- Game-by-game breakdown
- Lifetime P&L
- Monthly trends
- VIP tier progress
- Responsible gaming summary
- Achievement badges

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

## User Outcome Expectations & Transparency

### Realistic Gaming Outcomes (50% House Edge)

Given the 50% house edge, Sandy users can realistically expect:

#### Aviator Game
**Monthly Deposit:** KES 3,000 (KES 100 × 30 days)

Scenario Analysis:
```
Optimal Win Scenario (user skill + luck):
  Total Bets:              KES 3,000
  Average Multiplier Hit:  3.5x
  Gross Winnings:          KES 10,500
  House Edge (50%):        KES 5,250
  Net User Payout:         KES 5,250
  Monthly ROI:             +75% (rare)

Expected Scenario (mathematical average):
  Total Bets:              KES 3,000
  Average Multiplier Hit:  2.0x (50% win rate assumption)
  50% of bets lose:        KES 1,500 loss
  50% of bets win 2x:      KES 1,500 × 2 = KES 3,000 (before edge)
  House Edge (50%):        KES 3,000 × 50% = KES 1,500 deduction
  Net User Result:         KES 1,500 - KES 1,500 = KES 0
  Monthly ROI:             0% (break-even, mathematically expected)

Pessimistic Scenario (below-average luck):
  Total Bets:              KES 3,000
  Majority crashes early:  1.1x - 1.5x
  Gross Winnings:          KES 3,500
  House Edge (50%):        KES 1,750
  Net User Payout:         KES 1,750
  Monthly Loss:            KES 1,250
  Monthly ROI:             -42% (realistic)
```

#### Casino Games
**Monthly Deposit:** KES 5,000 (KES 500 × 10 days)

Expected Results:
```
Slots (96% RTP pre-edge):
  Bet Amount:              KES 5,000
  Theoretical Payout:      KES 4,800
  With 50% House Edge:     KES 2,400
  Monthly Loss:            KES 2,600

Blackjack (99.5% RTP pre-edge):
  Bet Amount:              KES 5,000
  Theoretical Payout:      KES 4,975
  With 50% House Edge:     KES 2,487.50
  Monthly Loss:            KES 2,512.50

Roulette (97.3% RTP pre-edge):
  Bet Amount:              KES 5,000
  Theoretical Payout:      KES 4,865
  With 50% House Edge:     KES 2,432.50
  Monthly Loss:            KES 2,567.50

Dice (99% RTP pre-edge):
  Bet Amount:              KES 5,000
  Theoretical Payout:      KES 4,950
  With 50% House Edge:     KES 2,475
  Monthly Loss:            KES 2,525
```

### Key Communication Points

**For New Users:**
1. "Understand: 50% of all bets go to Sandy for operations"
2. "Expectation: You will lose money over time - this is not wealth-building"
3. "Use Limits: Set daily loss limits before playing"
4. "For Fun: Treat gaming as entertainment with a cost, not as income"

**For Responsible Gaming:**
- Average user loses KES 50-100 per KES 1,000 wagered (after 50% edge)
- Daily limits prevent catastrophic losses
- Session timeouts prevent addiction spirals
- Rakeback bonuses help recover <5% of losses (for VIP users)

**Terms & Conditions Must State:**
- "Sandy gaming is entertainment, not a money-making opportunity"
- "Due to 50% house edge, users mathematically lose money over time"
- "Age 18+ only; prohibited in certain jurisdictions"
- "Problem gambling support: [Link to national hotline]"

### Long-Term User Retention

Despite the 50% house edge, users may return because:
1. **VIP Rakeback:** Gets 2-5% back on losses (still leaves them at 45-48% edge vs 50%)
2. **Excitement:** Multiplier chasing and win animations are psychologically rewarding
3. **Social:** Leaderboards and community features drive engagement
4. **Variety:** 5 different casino games provide novelty
5. **Skill Perception:** Blackjack & Aviator cashout timing creates skill illusion

### Compliance Considerations

- **Gambling Authority:** Approve 50% house edge as fair and transparent
- **Disclosure:** Mandatory pre-game warnings
- **Age Verification:** Strict 18+ enforcement
- **Self-Exclusion:** User can request permanent ban
- **Cooled-Off Period:** Automatic 24-hour break after KES 100K loss
- **Monthly Statement:** Users receive detailed P&L summary

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

## Gaming House Edge Policy

### 50% House Edge Rationale

Sandy platform implements a **uniform 50% house edge across all gaming products (Aviator & Casino)** to ensure platform sustainability and operational excellence. This policy reflects industry requirements for:

#### 1. Infrastructure & Operational Costs
- **Server & Hosting:** Reliable global CDN infrastructure
- **Payment Processing:** HashBack, M-Pesa, and fallback systems
- **Compliance & Licensing:** Gaming authority requirements
- **Security:** 24/7 monitoring, fraud detection, DDoS protection
- **Support:** 24/7 customer support operations
- **Development:** Continuous game development and platform improvements

#### 2. Revenue Model Breakdown
For every KES 1,000 wagered:

**Aviator:**
```
Bet Amount:              KES 1,000
If Win (4.5x multiplier):
  Gross Payout:         KES 4,500
  House Edge (50%):     KES 2,250
  User Receives:        KES 2,250
  Company Revenue:      KES 2,250

If Loss:
  Company Revenue:      KES 1,000
  User Receives:        KES 0
```

**Casino (All Games):**
```
Bet Amount:              KES 1,000
If Win (2x payout):
  Gross Payout:         KES 2,000
  House Edge (50%):     KES 1,000
  User Receives:        KES 1,000
  Company Revenue:      KES 1,000

If Loss:
  Company Revenue:      KES 1,000
  User Receives:        KES 0
```

#### 3. Transparent Communication
- **Homepage Disclosure:** "Gaming games carry 50% house edge - for entertainment only"
- **Before First Deposit:** User acknowledgment of house edge
- **In-game Display:** Active house edge indicator
- **Responsible Gaming:** Daily loss limit dashboard with projected losses

#### 4. Comparison to Industry Standards
| Operator | Aviator Edge | Casino Edge |
|---|---|---|
| Sandy (New) | 50% | 50% |
| Traditional Betting | 3-5% | 2-5% |
| Informal Gaming | 60-80% | 70-90% |

**Why Sandy's 50% is Reasonable:**
- Lower than informal betting networks (60-80%)
- Transparent (no hidden fees)
- Covers all operational costs
- Sustainable long-term operations
- No predatory mechanics

#### 5. User Protection Mechanisms
- **Deposit Limits:** Daily KES 50,000 cap
- **Loss Limits:** Daily KES 100,000 loss limit
- **Session Timeout:** Mandatory 2-hour breaks
- **Self-Exclusion:** Immediate account suspension option
- **Cool-off Period:** 24-hour voluntary break
- **Reality Checks:** Popup every 30 minutes showing losses
- **Warnings:** Pre-game educational content on probabilities

#### 6. No Manipulation Policies
- **Server-Side Randomness:** Crash multipliers & game outcomes are tamper-proof
- **No Predictability:** No patterns or delayed payouts
- **Instant Settlement:** Results determined immediately
- **Audit Trail:** Every game logged and auditable
- **Third-party Verification:** Regular RNG audits available

#### 7. Revenue Distribution
Monthly Revenue From Gaming:
```
Total Gaming Bets:       KES 5,000,000
Company House Edge (50%): KES 2,500,000

Allocation:
  Infrastructure:       KES 1,000,000 (40%)
  Operations/Support:   KES 700,000 (28%)
  Development:          KES 500,000 (20%)
  Legal/Compliance:     KES 200,000 (8%)
  Profit Margin:        KES 100,000 (4%)
```

### Implementation Notes

**Do Not Vary House Edge:** 50% is uniform across all games and bet amounts - this ensures:
- No "rigged" perception (same for everyone)
- Easier for users to calculate expectations
- Simpler to audit and verify
- Compliant with fair gaming standards

**Communicate Early & Often:**
- Include house edge in all promotional materials
- Display prominently before first bet
- Send monthly responsible gaming emails
- Highlight in terms & conditions

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
