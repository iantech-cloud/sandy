# 50% House Edge Implementation Update

**Date:** 2026-07-13  
**Status:** Complete  
**Impact:** All gaming products updated

---

## Summary of Changes

The HashBack Integration Plan has been systematically updated to reflect a **uniform 50% house edge across all gaming products** (Aviator & Casino). This change ensures platform sustainability and covers operational costs.

---

## What Changed

### 1. Aviator Wallet
- **Before:** 2% house edge, 98% RTP
- **After:** 50% house edge, 50% RTP
- **Impact:** Each KES 1,000 bet generates KES 500 company revenue

### 2. Casino Wallet
- **Before:** 5% house edge, 95% RTP per game
- **After:** 50% uniform house edge, 50% RTP per game
- **Games Affected:**
  - Slots: 50% RTP (was 96%)
  - Blackjack: 50% RTP (was 99.5%)
  - Roulette: 50% RTP (was 97.3%)
  - Dice: 50% RTP (was 99%)
  - Baccarat: 50% RTP (was 85-98%)

### 3. Withdrawal Fees
- **Aviator:** Changed from 2% withdrawal fee → No additional fee (edge already applied)
- **Casino:** Changed from 5% withdrawal fee → No additional fee (edge already applied)
- **Reason:** 50% house edge deducted during betting, not at withdrawal

### 4. User Payout Calculations
- **Aviator Win Example:**
  - User bets: KES 1,000
  - Crash at: 5x multiplier
  - Gross payout: KES 5,000
  - Company takes: KES 2,500 (50%)
  - User receives: KES 2,500

- **Casino Win Example:**
  - User bets: KES 1,000
  - Wins 2x payout: KES 2,000 (gross)
  - Company takes: KES 1,000 (50%)
  - User receives: KES 1,000

### 5. Revenue Model
**Monthly Example (KES 5M in bets):**
```
Total Bets:           KES 5,000,000
Company House Edge:   KES 2,500,000 (50%)

Allocation:
  Infrastructure:     KES 1,000,000 (40%)
  Operations/Support: KES 700,000 (28%)
  Development:        KES 500,000 (20%)
  Legal/Compliance:   KES 200,000 (8%)
  Profit Margin:      KES 100,000 (4%)
```

### 6. VIP Rakeback Program (Realistic)
- **Bronze:** 2% rakeback on losses (max KES 1K/month)
- **Silver:** 3% rakeback on losses (max KES 5K/month)
- **Gold:** 4% rakeback on losses (max KES 10K/month)
- **Platinum:** 5% rakeback on losses (max KES 25K/month)

Note: Rakeback provides 2-5% loss recovery but doesn't reduce 50% house edge

---

## Files Updated

### HASHBACK_INTEGRATION_PLAN.md

**Sections Updated:**
1. ✅ Wallet Management - Aviator specs (Line 348)
2. ✅ Wallet Management - Casino specs (Line 405-412)
3. ✅ Company Wallet revenue sources (Line 477-478)
4. ✅ Aviator House Edge Collection (Line 731-747)
5. ✅ Casino House Edge & RTP Table (Line 824-830)
6. ✅ Aviator Withdrawal (Line 389)
7. ✅ Casino Withdrawal (Line 447)
8. ✅ Gaming Wallet Cashout flow (Line 880-908)
9. ✅ Gaming Wallet Database schemas (Line 1559-1560)
10. ✅ VIP Tiers (Line 457-461)
11. ✅ Aviator Multiplier Distribution (Line 379-389)

**New Sections Added:**
- Gaming House Edge Policy (Line 1899-2009, ~111 lines)
  - 50% house edge rationale
  - Revenue model breakdown
  - Transparent communication strategy
  - Comparison to industry standards
  - User protection mechanisms
  - No manipulation policies
  - Revenue distribution example

- User Outcome Expectations & Transparency (Line 1845-1952, ~108 lines)
  - Realistic gaming outcomes
  - Monthly deposit scenario analysis
  - Expected results by game type
  - Key communication points
  - Compliance considerations
  - Long-term retention strategies

---

## User Communication Plan

### Pre-Deposit Warning
```
⚠️ IMPORTANT: Sandy gaming carries a 50% house edge
This means:
  • You will lose approximately KES 500 per KES 1,000 wagered (on average)
  • This is entertainment with a cost, NOT a money-making opportunity
  • Set daily loss limits before playing
  • Use responsible gaming features available in settings
```

### In-Game Display
```
Current House Edge: 50%
If you bet KES 1,000 and win 5x:
  You receive: KES 2,500 (50% of KES 5,000 payout)
  Company revenue: KES 2,500
```

### Monthly Statement
```
Games Played:      45
Total Wagered:     KES 15,000
Total Won:         KES 6,750 (before house edge)
House Edge (50%):  KES 3,375
Net Result:        -KES 3,375
Monthly Loss:      -22.5%
```

---

## Compliance Checklist

- [ ] Legal review of 50% house edge (check with gaming authority)
- [ ] Terms & Conditions updated with 50% disclosure
- [ ] Age verification (18+ enforcement)
- [ ] Pre-game warnings implemented
- [ ] Daily loss limit enforcement code
- [ ] Session timeout (2 hours) enforcement
- [ ] Self-exclusion flow created
- [ ] Problem gambling helpline link added
- [ ] Monthly responsible gaming emails
- [ ] Audit trail for all gaming transactions
- [ ] Third-party RNG verification arranged

---

## Database Schema Changes

All gaming wallet models now reflect 50% house edge:

1. **AviatorWallet**
   - `balance_cents` now represents 50% of gross winnings
   - `total_winnings_cents` calculated after 50% deduction

2. **CasinoWallet**
   - All game payouts calculated with 50% house edge
   - VIP rakeback tracked separately as bonus

3. **Company**
   - `aviator_house_edge_percent: 50`
   - `casino_house_edge_percent: 50`

---

## Implementation Notes

### No Variable House Edge
- **Do Not Create:** Different edge for different users/games
- **Keep Uniform:** 50% across ALL scenarios
- **Reason:** Ensures perceived fairness and simpler auditing

### Real-time Tracking
- Every bet instantly deducts 50% for company revenue
- No delayed edge calculations
- Transparent immediate feedback to user

### Calculation Order
1. User places bet (debited from balance)
2. Game outcome determined
3. Gross payout calculated
4. 50% house edge deducted automatically
5. Net payout credited to user balance
6. Company revenue recorded

---

## Expected Platform Economics

**Healthy Monthly Gaming Revenue:**
- Aviator bets: KES 2,000,000
- Casino bets: KES 3,000,000
- Total bets: KES 5,000,000

**Revenue Distribution:**
- Company keeps: KES 2,500,000 (50% of bets)
- Users receive: KES 2,500,000 (50% of bets)
- Net platform profit after costs: KES 100,000

**User Retention via:**
- VIP rakeback bonuses (2-5% loss recovery)
- Psychological rewards (multiplier chasing, win animations)
- Social features (leaderboards, achievements)
- Variety (5 casino games + Aviator)
- Skill perception (Blackjack & Aviator timing)

---

## Next Steps

1. **Legal Review:** Gambling authority approval of 50% edge
2. **Developer Implementation:** Update backend bet calculation logic
3. **UI Updates:** Display 50% edge prominently
4. **Testing:** QA all game outcomes with 50% deduction
5. **Staging:** Deploy to staging environment
6. **User Communication:** Announce house edge policy
7. **Soft Launch:** 10% of users → 25% → 50% → 100%
8. **Monitoring:** Track user retention & complaints

---

## FAQ

**Q: Is 50% house edge legal?**
A: Depends on gaming authority. Sandy should submit for approval. It's lower than informal betting (60-80%) and transparent.

**Q: Will users accept 50% house edge?**
A: Yes, if communicated clearly. Traditional betting has 5-10% edge but is opaque. Sandy's transparency + responsible gaming + VIP rewards make it attractive.

**Q: How to retain users with 50% edge?**
A: Psychological factors (excitement, social, competition) often override rational math. Leaderboards, achievements, and rakeback keep engagement high.

**Q: What about responsible gaming?**
A: Daily loss limits (KES 100K), session timeouts (2 hrs), self-exclusion, and monthly statements ensure user protection.

---

## Conclusion

The 50% house edge is now fully documented in the HashBack Integration Plan. This ensures:
- ✅ Platform sustainability
- ✅ Transparent operations
- ✅ Responsible gaming
- ✅ Legal compliance (pending authority review)
- ✅ User protection mechanisms
- ✅ Long-term revenue model

The plan is ready for development team implementation.
