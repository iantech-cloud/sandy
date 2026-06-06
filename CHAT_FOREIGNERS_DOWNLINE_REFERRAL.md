# Chat Foreigners Downline & Referral System

## Overview

Chat Foreigners uses the **unified referral system** from the main HustleHub Africa site. This means:

- **No separate Chat Foreigners referral link** — Users inherit their downline structure from the main site
- **Automatic commission attribution** — When a user unlocks a person in Chat Foreigners, their main-site referrer automatically earns the commission
- **Universal downline mapping** — All users referred by user A will credit their Chat Foreigners earnings to A

## How It Works

### Sign-Up Flow

1. **User A invites User B** via a referral link on the main site (e.g., `?ref=SANDY001`)
2. **Sign-up creates referral structure:**
   - A `Referral` record is created: `{ referrer_id: A._id, referred_id: B._id }`
   - Profile `referred_by` field is set: `B.referred_by = A._id`
3. **B joins Chat Foreigners** later and unlocks a person
4. **System looks up referral:** `Referral.findOne({ referred_id: B._id })`
5. **A earns the commission automatically** — KES 60 credited to A's Chat Foreigners wallet

### Commission Structure

| Event | Amount | Recipient |
|-------|--------|-----------|
| Person Unlock | KES 60 | Referrer (from main site) |
| Milestone (20 messages) | KES 10 | Referrer (from main site) |

### Multi-Level Downline (Future)

The `DownlineUser` collection supports tracking downlines up to level 7 for potential future multi-level commissions:

```javascript
{
  main_user_id: "A",           // Top-level referrer
  downline_user_id: "C",       // Indirect referral (B referred C)
  level: 2,                    // Level 2 downline
  total_earnings_from_downline_cents: 0
}
```

Currently, Chat Foreigners only pays Level 1 direct referrers, but the structure is in place for expansion.

## Database Structure

### Referral Collection

```javascript
{
  _id: ObjectId,
  referrer_id: "A",            // User A's ID (from Profile)
  referred_id: "B",            // User B's ID (from Profile)
  earning_cents: 0,            // Total earned from this referral
  status: "active",            // active | inactive | bonus_paid
  referred_user_activated: false,
  created_at: ISODate
}
```

### Profile Collection (Relevant Fields)

```javascript
{
  _id: "unique_user_id",
  username: "john_doe",
  referral_id: "ABC12345",     // This user's personal referral code
  referred_by: "A",            // Who referred THIS user (links to A._id)
}
```

### Chat Foreigners Wallet & Earnings

**ChatForeignersWallet:**
```javascript
{
  user_id: "A",
  balance_cents: 6000,                 // KES 60
  total_earned_cents: 12000,           // KES 120
  total_deposited_cents: 50000         // User's own deposits
}
```

**ChatForeignersReferralEarning:**
```javascript
{
  referrer_id: "A",
  referee_id: "B",
  bot_id: "507f1f77bcf86cd799439011",
  earningType: "initial_unlock",       // or "milestone_bonus"
  amount_cents: 6000,
  status: "completed",
  created_at: ISODate
}
```

## API Flow: Person Unlock

### 1. User B Initiates Unlock

```
POST /api/chat-foreigners/payments/unlock
{
  personId: "507f1f77bcf86cd799439011",
  amount_cents: 6000
}
```

### 2. M-Pesa Payment Processed

Payment goes through Daraja M-Pesa integration → webhook callback

### 3. Referral Commission Payout

```typescript
// In /api/chat-foreigners/chat/route.ts (completeBotUnlockPayment)

// Look up who referred user B
const referralRecord = await Referral.findOne({ referred_id: userId });

if (referralRecord) {
  const referrerId = referralRecord.referrer_id;

  // Create earning record
  const earning = await ChatForeignersReferralEarning.create({
    referrer_id: referrerId,
    referee_id: userId,
    bot_id: personId,
    earningType: "initial_unlock",
    amount_cents: 6000,
    status: "completed"
  });

  // Credit referrer's wallet
  let referrerWallet = await ChatForeignersWallet.findOne({ user_id: referrerId });
  if (!referrerWallet) {
    referrerWallet = new ChatForeignersWallet({ user_id: referrerId });
  }
  
  referrerWallet.balance_cents += 6000;
  referrerWallet.total_earned_cents += 6000;
  await referrerWallet.save();
}
```

### 4. Referrer Sees Earnings in Wallet

Referrer logs into `/dashboard/chat-foreigners/wallet` and sees:
- Balance increased by KES 60
- Transaction history shows: "Commission from [User B]'s person unlock"

## Downline Visualization

Admin can view the complete downline structure at `/admin/chat-foreigners/users`:

```
Main User (SANDY001)
├── Referred User A
│   ├── Referred User B (earned KES 60 from person unlock)
│   ├── Referred User C (earned KES 10 from milestone)
│   └── Referred User D
├── Referred User E
└── Referred User F
```

The admin page shows:
- Who referred each user
- Total downline earnings
- Total persons unlocked
- Commission earned so far
- Milestone status

## Backfilling Existing Users

For users who signed up **before** this referral system was implemented, run the backfill script:

```bash
npx ts-node scripts/backfill-chat-foreigners-referrals.ts
```

This script:
1. Finds all Profile users with a `referred_by` field
2. Checks if they have a corresponding Referral record
3. Creates missing Referral records
4. Sets status to "active" so they can start earning immediately
5. Logs all actions for audit

**Example Output:**
```
[Backfill] Found 1,250 users with referred_by field
[Backfill] Found 800 existing Referral records
[Backfill] 450 users need Referral records created
[Backfill] ✓ Created Referral for john_doe → referrer ID: SANDY001
...
[Backfill] === Summary ===
Total users processed: 450
Referral records created: 447
Records skipped: 3
Errors: 0
```

## Key Features Implemented

✓ **Automatic referrer detection** — Uses main site Referral collection  
✓ **Zero manual setup** — No separate referral code needed  
✓ **Wallet crediting** — Earnings go directly to referrer's CF wallet  
✓ **Multi-level ready** — Infrastructure for future expansion  
✓ **Audit trail** — All earnings tracked in ChatForeignersReferralEarning  
✓ **Admin visibility** — Downline map shows complete structure  
✓ **Backfill capability** — Update existing users retroactively  

## Future Enhancements

- [ ] Multi-level commissions (earn from downlines' downlines)
- [ ] Withdrawal to main wallet or M-Pesa
- [ ] Leaderboards based on downline earnings
- [ ] Referral bonus tiers (higher rates at 10+ active referrals)
- [ ] Automated payouts on milestones
