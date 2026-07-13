# HashBack Integration Plan - Complete Summary

**Document Status:** Final - Ready for Implementation  
**Updated:** July 13, 2026  
**Total File Size:** 1,927 lines  
**Implementation Timeline:** 3 weeks

---

## What's Included in HASHBACK_INTEGRATION_PLAN.md

### 1. Four Gaming Wallets (Complete Specifications)

#### Spin Wallet (Existing - Enhanced)
- Deposit: KES 30 only (HashBack + Co-op Bank)
- Spin cost: KES 30
- Company revenue: 20% of deposits
- Prize structure: Currently 100% "Try Again", future prizes KES 50-KES 10,000
- Features: Real-time wheel, history, streaks tracking

#### Aviator Wallet (NEW)
- Deposits: KES 50, 100, 250, 500, 1,000
- Bet range: KES 10 - KES 50,000
- House edge: 2% (company revenue)
- Game mechanic: Random crash 1.1x - 100x multiplier
- Cashout: Lose bet if crash before cashout, win bet × multiplier if cashout before crash
- Features: Auto-cashout, leaderboard, multiplier animations, session tracking

#### Casino Wallet (NEW)
- Deposits: KES 50, 100, 250, 500, 1,000
- Bet range: KES 10 - KES 100,000
- House edge: 5% average across all games
- Games: Slots (96% RTP), Blackjack (99.5% RTP), Roulette (97.3% RTP), Dice (99% RTP), Baccarat (85-98% RTP)
- Responsible gaming: Daily limits, session timeouts, cool-off periods, self-exclusion
- VIP tiers: Bronze (1%), Silver (2%), Gold (3%), Platinum (5%) rakeback
- Features: Multi-game support, leaderboards, tournaments, achievement badges

#### Main User Wallet (Enhanced)
- Sources: Chat earnings, referral bonuses, game winnings, platform rewards
- Uses: Activation, bot unlock, game deposits, withdrawals
- Withdrawal: 10% fee, min KES 10, max KES 50,000/txn, daily limit KES 100,000

---

## Complete Payment Flows Documented

### User Activation
- Amount: KES 95
- Provider: HashBack (primary) → Co-op Bank (fallback)
- Processing: <50ms with instant webhook confirmation
- Activation: Immediate upon webhook verification

### Bot Unlock
- Amount: KES 100 per bot
- Distribution: L1 referrer KES 70, L2 referrer KES 10, Company KES 20
- Provider: HashBack + HashPeer verification
- Processing: Real-time balance updates + referral notifications

### Chat Message Earnings
- Rate: KES 0.10 per message
- Cap: Max 30 msg/minute, 1,000 msg/day, KES 100/day earnings
- Processing: Instant balance credit (no payment required)

### Gaming Deposits & Gameplay

#### Spin Wallet Flow
```
Deposit KES 30 → HashBack STK → Spin Wheel → Try Again (100%) → Repeat
```

#### Aviator Game Flow
```
Deposit → Place Bet (KES 10-50K) → Crash Multiplier (1.1x-100x) 
→ Cashout or Lose → Win or Lose → Balance Update
```

#### Casino Game Flow
```
Deposit → Select Game → Place Bet (KES 10-100K) 
→ Game Result (with RTP) → Win/Loss → Balance Update
```

### Withdrawal Flow
```
Initiate Withdrawal → Verify Balance & Limits → HashBack B2C Call 
→ 10% Fee Deduction → M-Pesa Send → SMS Confirmation → Complete
```

---

## Database Schemas - 8 Models

1. **Profile** (Enhanced) - User identification, earnings, activation
2. **Transaction** (New) - All payment tracking and history
3. **Withdrawal** (New) - Withdrawal requests and reconciliation
4. **SpinWallet** (Enhanced) - Spin wallet balance and history
5. **AviatorWallet** (New) - Aviator game wallet with multipliers
6. **CasinoWallet** (New) - Casino wallet with multi-game support
7. **ChatForeignersBot** (Enhanced) - Bot pricing and revenue split
8. **Company** (New) - Company wallet and revenue aggregation

---

## Files to Create - 20 New Files

### Services & APIs (6 files)
- `lib/services/hashback.ts` - HashBack API client
- `api/hashback/webhook/route.ts` - HashPay webhook handler
- `api/hashpeer/webhook/route.ts` - P2P webhook handler
- `api/hashback/payment/route.ts` - Payment initiation
- `api/hashback/wallet/route.ts` - Wallet operations
- `api/hashback/transactions/route.ts` - Transaction lookup

### Actions (4 files)
- `actions/hashback.ts` - Server actions for HashBack
- `actions/aviator.ts` - Aviator game logic
- `actions/casino.ts` - Casino games logic
- `actions/spin-wallet-hashback.ts` - Spin wallet with HashBack

### Components (10 files)
- `components/payments/hashback-payment-button.tsx` - Main payment button
- `components/payments/aviator-payment-button.tsx` - Aviator deposit
- `components/payments/casino-payment-button.tsx` - Casino deposit
- `components/wallet/hashback-wallet.tsx` - Wallet dashboard
- `components/games/aviator-game.tsx` - Aviator game interface
- `components/games/casino-game.tsx` - Casino game manager
- `dashboard/games/aviator/page.tsx` - Aviator game page
- `dashboard/games/casino/page.tsx` - Casino hub page
- `dashboard/wallet/games/aviator-stats.tsx` - Aviator stats
- `dashboard/wallet/games/casino-stats.tsx` - Casino stats

---

## Files to Modify - 5 Existing Files

1. `.env.local` - Add HashBack credentials
2. `lib/models.ts` - Add all new schemas
3. `actions/activation.ts` - Dual provider selection
4. `actions/chat-foreigners/payments.ts` - Gaming payment support
5. Payment UI components - Add gaming wallet options

---

## Revenue Model - Company Profits

### Bot Unlock (KES 100)
```
User pays: KES 100
├─ L1 Referrer: KES 70 (70%)
├─ L2 Referrer: KES 10 (10%)
└─ Company: KES 20 (20%) ← REVENUE
```

### Spin Wallet (20% Revenue Share)
```
User deposits: KES 30
└─ Company: KES 6 (20%) ← REVENUE
```

### Aviator (2% House Edge)
```
User bets: KES 1,000
├─ If wins: Payout = (bet × multiplier) - 2%
└─ If loses: Company keeps full KES 1,000 + 2% ← REVENUE
```

### Casino (5% House Edge Average)
```
User bets: KES 1,000
└─ House edge = ~KES 50 (5%) ← REVENUE
```

### Monthly Revenue Example
- 1,000 bot unlocks/month = KES 20,000
- 5,000 spin deposits = KES 30,000
- 10,000 Aviator bets avg KES 1,000 = KES 100,000+
- 5,000 Casino bets avg KES 2,000 = KES 500,000+
- **Estimated Monthly Revenue: KES 650,000+**

---

## Security Features

### Webhook Verification
- HMAC-SHA256 signature on all webhooks
- Constant-time comparison (prevent timing attacks)
- Separate secrets for HashPay and HashPeer

### Server-Side Validation
- Game randomness server-side only (never in browser)
- Amount validation on every transaction
- User balance verification before any deduction
- Rate limiting: 100 req/min, Decode 10 req/5sec

### Responsible Gaming (Casino)
- Daily deposit limit: KES 50,000
- Daily loss limit: KES 100,000
- Session timeout: 2 hours
- Cool-off period: 24 hours (optional)
- Self-exclusion: Permanent or temporary
- Reality check popups every 30 minutes

---

## Implementation Phases

### Phase 1: Week 1 - Core Infrastructure
- [ ] Hashback service layer
- [ ] Database schema additions
- [ ] Webhook handlers (HashPay + HashPeer)
- [ ] Payment API routes

### Phase 2: Week 2 - Business Logic & UI
- [ ] Payment actions (activation, bot unlock)
- [ ] Spin wallet enhancement with HashBack
- [ ] Aviator game logic & UI
- [ ] Casino game logic & UI
- [ ] Wallet dashboard

### Phase 3: Week 3 - Testing & Deployment
- [ ] Sandbox testing with HashBack
- [ ] Responsible gaming compliance review
- [ ] Security audit (signatures, validation)
- [ ] Beta rollout to 100 users
- [ ] Production deployment

---

## Testing Checklist

- [ ] Payment success flows (activation, bot unlock, deposits)
- [ ] Webhook signature verification
- [ ] Amount tampering prevention (browser dev tools)
- [ ] Fallback to Co-op Bank when HashBack fails
- [ ] Game crash randomness (server-side)
- [ ] Responsible gaming limits enforcement
- [ ] B2C withdrawal processing
- [ ] P2P referral verification
- [ ] Rate limiting (429 handling)
- [ ] User balance consistency across wallets

---

## Deployment Checklist

- [ ] HashBack API credentials configured
- [ ] Webhook URLs registered in HashBack portal
- [ ] Database migrations deployed
- [ ] Co-op Bank still operational as fallback
- [ ] Monitoring alerts set up for:
  - Webhook failures
  - Failed transactions
  - Revenue reconciliation
- [ ] User communication (in-app notices)
- [ ] Support documentation updated

---

## Success Metrics

1. **User Engagement**
   - Activation time: <1 second (vs 5+ min current)
   - Bot unlock adoption: +40%
   - Game usage: 30% of users play Aviator/Casino

2. **Revenue**
   - Monthly revenue: KES 500,000+ (gaming)
   - Daily active players: 1,000+
   - Average bet size: KES 1,500

3. **Quality**
   - Payment success rate: >99%
   - Webhook delivery: 99.9%
   - Zero critical bugs in first month

4. **Compliance**
   - Responsible gaming limit enforcement: 100%
   - Self-exclusion requests: <5%
   - User support tickets (payment related): <2%

---

**Note:** The complete HashBack Integration Plan document includes all API examples, code snippets, error handling, security considerations, and detailed deployment instructions. Ready to start implementation? Let's begin with Phase 1!
