# HustleHub Monetization System Guide

## Overview

HustleHub provides users with **9 different ways to earn money**, each with its own earning potential and commission structure. All earnings are tracked in a unified **Wallet with Escrow System** powered by **Coop Bank integration**.

---

## The 9 Earning Streams

### 1. **Freelance Jobs** 💼
**Path:** `/dashboard/freelance`
- **Description:** Complete projects for clients
- **User Commission:** Keep 85-90%
- **Potential:** KES 5,000 - 50,000+
- **Escrow:** Yes - Funds held during project completion
- **Model:** Client posts → Freelancer applies → Project completion → Payment release

**Key Features:**
- Project-based payments
- Escrow protection for both parties
- Rating and review system
- Dispute resolution

---

### 2. **Online Tutoring** 📚
**Path:** `/dashboard/tutoring`
- **Description:** Teach students via scheduled sessions
- **User Commission:** Keep 85%
- **Potential:** KES 500 - 5,000+ per hour
- **Escrow:** Yes - Per session until completion
- **Model:** Tutor sets rates → Student books → Video session → Payment release

**Key Features:**
- Hourly rate setting
- Scheduled sessions
- Video call integration
- Student/tutor ratings

---

### 3. **Digital Products Store** 📄
**Path:** `/dashboard/digital-products`
- **Description:** Sell digital assets (notes, templates, ebooks, code)
- **User Commission:** Keep 75-95%
- **Potential:** KES 100 - 10,000+ per sale
- **Escrow:** No - Instant payment on purchase
- **Model:** Upload → Set price → Buyer purchases → Instant delivery

**Key Features:**
- File hosting and delivery
- Product categories
- Reviews and ratings
- Reseller marketplace

---

### 4. **AI Tasks Marketplace** ⚡
**Path:** `/dashboard/ai-tasks`
- **Description:** Complete data labeling, annotation, transcription tasks
- **User Commission:** Keep 80%
- **Potential:** KES 10 - 500 per task
- **Escrow:** No - Batch payment after review
- **Model:** Browse tasks → Complete → Submit → QA → Payment

**Key Features:**
- Micro-task completion
- Quality scoring
- Batch payments
- Leaderboards for top performers

---

### 5. **Local Gigs** 📍
**Path:** `/dashboard/local-gigs`
- **Description:** Offer services in your local area (tutoring, photography, repairs, etc.)
- **User Commission:** Keep 85%
- **Potential:** KES 1,000 - 10,000+ per gig
- **Escrow:** Yes - Until service completion
- **Model:** Post service → Client books → Service delivery → Payment release

**Key Features:**
- Location-based discovery
- Service categories
- Before/after photos
- Customer feedback

---

### 6. **Content Tasks** ✍️
**Path:** `/dashboard/content`
- **Description:** Submit content, create posts, participate in challenges
- **User Commission:** Keep 80-90%
- **Potential:** KES 100 - 5,000+
- **Escrow:** No - Direct payment per submission
- **Model:** Browse challenges → Submit content → Review → Payout

**Key Features:**
- Content challenges
- Quality standards
- Portfolio building
- Promotion opportunities

---

### 7. **Paid Surveys** 📋
**Path:** `/dashboard/surveys`
- **Description:** Complete market research surveys
- **User Commission:** Keep 90-100%
- **Potential:** KES 50 - 500 per survey
- **Escrow:** No - Instant payment
- **Model:** Browse surveys → Complete → Instant payout

**Key Features:**
- Survey variety
- Qualification screening
- Fast payouts
- No hidden catches

---

### 8. **Affiliate Marketing** 🔗
**Path:** `/dashboard/soko`
- **Description:** Earn commissions from product sales via referral links
- **User Commission:** Keep 60-80%
- **Potential:** KES 500 - 100,000+
- **Escrow:** No - Monthly commission payout
- **Model:** Share link → Customer purchases → Earn commission

**Key Features:**
- Partnership integrations
- Performance tracking
- Marketing materials
- Commission tiers

---

### 9. **Referral Program** 🎁
**Path:** `/dashboard/referrals`
- **Description:** Earn bonuses when you refer friends to HustleHub
- **User Commission:** 100% bonus
- **Potential:** KES 50 - 500+ per referral
- **Escrow:** No - Direct credit after activation
- **Model:** Share code → Friend joins → Friend activates → Bonus credited

**Key Features:**
- Multi-level referrals
- Loyalty bonuses
- Tracking dashboard
- Performance incentives

---

## Wallet & Escrow System

### Access
**Path:** `/dashboard/wallet`

### Balance Types

1. **Available Balance**
   - Money ready to withdraw
   - No restrictions
   - Accumulated from completed work

2. **Escrow Balance**
   - Locked during active projects/jobs
   - Released upon completion
   - Protects both parties
   - Can be disputed

3. **Pending Balance**
   - Earnings from incomplete tasks
   - Converts to available when complete
   - Shows projected earnings

### Wallet Features

```
┌─────────────────────────────────────┐
│  Available Balance: KES 45,000      │  ← Ready to withdraw
├─────────────────────────────────────┤
│  Escrow Balance: KES 12,000         │  ← Locked in projects
├─────────────────────────────────────┤
│  Pending Balance: KES 8,000         │  ← Incomplete work
├─────────────────────────────────────┤
│  Total Earned: KES 245,000          │  ← Lifetime earnings
└─────────────────────────────────────┘
```

### Withdrawal Process

1. **Initiate Withdrawal**
   - Enter amount (minimum KES 200)
   - Select Coop Bank phone number
   - Confirm withdrawal

2. **Processing Fee** (band-based)
   - KES 200-1,000: KES 10 fee
   - KES 1,001-2,000: KES 20 fee
   - KES 2,001-5,000: KES 30 fee
   - KES 5,001-10,000: KES 50 fee
   - Above KES 10,000: KES 100 fee

3. **Coop Bank Transfer**
   - Funds sent to registered phone
   - Processing time: 1-12 hours
   - Real-time transaction tracking

### Escrow & Dispute Resolution

**When Escrow is Triggered:**
- Job posted and freelancer accepted
- Funds moved to escrow
- Held until project marked complete
- 7-day protection period

**Dispute Process:**
1. Buyer/seller reports issue
2. Evidence and communication reviewed
3. Admin decision issued
4. Funds released or refunded accordingly

**Typical Hold Duration:**
- Freelance jobs: 3-14 days
- Tutoring: Until session complete
- Local gigs: Until service confirmed

---

## Navigation & Dashboard

### Main Dashboard
**Path:** `/dashboard`
- Overview of all earnings
- Recent transactions
- Quick links to earning streams

### Earnings Overview
**Path:** `/dashboard/earnings-overview`
- All 9 earning ways at a glance
- Commission breakdown
- Earning potential summary
- Quick navigation

### Mobile Navigation (Bottom Nav)
All revenue streams accessible from:
- Bottom navigation bar on mobile
- Full sidebar on desktop
- Quick dashboard menu

### Menu Structure

```
├── Dashboard
├── Wallet & Escrow
├── 💰 All Earning Ways
│   ├── Freelance Jobs
│   ├── Online Tutoring
│   ├── Digital Products
│   ├── AI Tasks
│   └── Local Gigs
├── Surveys
├── Content Tasks
├── Chat Foreigners
├── Soko (Affiliate)
├── Referral Program
├── Profile
├── Help & Support
└── Settings
```

---

## Revenue Model

### How HustleHub Makes Money

| Stream | User Gets | HustleHub Gets |
|--------|-----------|----------------|
| Freelance | 85-90% | 10-15% |
| Tutoring | 85% | 15% |
| Digital Products | 75-95% | 5-25% |
| AI Tasks | 80% | 20% |
| Local Gigs | 85% | 15% |
| Content | 80-90% | 10-20% |
| Surveys | 90-100% | 0-10% |
| Affiliate | 60-80% | 20-40% |
| Referrals | 100% | 0% (platform growth) |

---

## Getting Started

### Step 1: Verify Account
- Complete profile
- Verify Coop Bank account
- Enable notifications

### Step 2: Choose Your Stream
Visit `/dashboard/earnings-overview` to explore all options

### Step 3: Start Earning
1. Browse opportunities
2. Complete your first task/job
3. Funds go to wallet
4. Withdraw anytime

### Step 4: Grow Your Income
- Complete more tasks
- Build ratings/reviews
- Refer friends
- Combine multiple streams

---

## Security & Protection

### Escrow Protection
- Funds held by HustleHub
- Not accessible to either party until conditions met
- Dispute resolution team available
- Transaction history maintained

### Payment Security
- Coop Bank integration (licensed financial institution)
- Encrypted transactions
- Phone number verification
- 2FA for withdrawal

### Dispute Resolution
- 7-day project protection
- Evidence-based decisions
- Fair arbitration
- Transparent process

---

## Commission Breakdown Example

**Freelance Job: KES 10,000**
```
Total Project Value:     KES 10,000
HustleHub Fee (15%):    -KES  1,500
───────────────────────────────────
Your Earnings (85%):     KES  8,500
```

**Monthly Earnings Potential** (multiple streams)
```
Freelance (3 jobs):      KES 25,500
Tutoring (20 hours):     KES 20,000
Digital Products (5 sales): KES 2,500
AI Tasks (100 tasks):    KES 8,000
Surveys (10 surveys):    KES 3,000
Referral Bonuses (3):      KES 750
───────────────────────────────────
TOTAL MONTHLY:           KES 59,750
```

---

## Support & Help

### Common Issues

**Q: How long does withdrawal take?**
A: 1-12 hours after admin approval, typically immediate for small amounts

**Q: What if there's a dispute?**
A: Escrow holds funds while we investigate, decision within 48-72 hours

**Q: Can I use multiple streams?**
A: Yes! Unlimited earning opportunities, any combination

**Q: How is my wallet funded?**
A: Automatically updated when work is completed and verified

### Help Center
- Email: support@hustlehub.co.ke
- Chat: In-app support widget
- Phone: +254 71X XXXXXX

---

## Tips for Maximum Earnings

1. **Combine Streams** - Don't rely on one income source
2. **Build Reviews** - High ratings get more opportunities
3. **Be Reliable** - Complete work on time = more referrals
4. **Invest Wisely** - Use referral bonuses for premium features
5. **Stay Active** - Log in regularly for new opportunities
6. **Quality First** - Better work = higher pay opportunities

---

**Last Updated:** June 2026
**Version:** 1.0
