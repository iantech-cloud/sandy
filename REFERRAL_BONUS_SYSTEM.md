# Referral Bonus System - KES 500 Reward

## Overview

The Referral Bonus System rewards users who successfully refer 5+ people and activate their account. Users earn a **KES 500 bonus** automatically when they meet all eligibility criteria.

## Features

### 1. Promotional Modal Dialog
- **Location**: Appears on both homepage and dashboard
- **Design**: Beautiful gradient-styled modal with celebration theme
- **User Experience**:
  - Shows on homepage only if user is logged in
  - Shows on dashboard on first load
  - Can be dismissed and appears again on refresh

### 2. Bonus Eligibility Criteria

Users qualify for the KES 500 bonus when ALL conditions are met:

1. **Account Activation**: User must have `is_active = true`
   - Can be activated by completing a task or depositing funds
   
2. **Referrals**: User must have referred **at least 5 people**
   - Tracked via the `Referral` collection
   - People must have signed up using their referral link
   
3. **Not Already Applied**: Bonus must not have been previously claimed
   - Tracked via `metadata.referral_bonus_applied` flag

### 3. Automatic Bonus Application

When a user meets all criteria:
- ✅ KES 500 (50,000 cents) is automatically added to their wallet
- ✅ A `BONUS` transaction record is created
- ✅ User's profile is flagged as having received the bonus
- ✅ Modal shows success status with celebration message

## Files Modified/Created

### New Files

1. **`app/components/ReferralBonusModal.tsx`**
   - Main modal component that displays bonus information
   - Shows qualification status (pending, qualified, or unqualified)
   - Displays progress toward 5 referrals
   - Fetches real-time eligibility data

2. **`app/actions/referrals.ts` (Updated)**
   - Added `checkAndApplyReferralBonus()` server action
   - Validates user eligibility
   - Applies bonus if criteria met
   - Handles edge cases and error scenarios

### Modified Files

1. **`app/dashboard/page.tsx`**
   - Added import for `ReferralBonusModal`
   - Added state management for modal visibility
   - Shows modal on dashboard load
   - Refreshes data after bonus application

2. **`app/home-client.tsx`**
   - Added import for `ReferralBonusModal`
   - Shows modal only to authenticated users
   - Manages modal visibility state

## How It Works

### User Journey

```
1. User logs in
   ↓
2. Modal appears (homepage or dashboard)
   ↓
3. System checks eligibility:
   - Is user activated? ✓
   - Has user referred 5+ people? ✓
   - Has bonus not been applied before? ✓
   ↓
4a. If QUALIFIED:
   - KES 500 bonus applied
   - Transaction created
   - Modal shows success
   ↓
4b. If UNQUALIFIED:
   - Shows requirements
   - Displays progress (e.g., "3/5 referrals")
   - Shows what's needed
```

### Server Action Flow

```typescript
checkAndApplyReferralBonus()
  ├─ Authenticate user
  ├─ Get user profile
  ├─ Count active referrals
  ├─ Validate all criteria
  ├─ If eligible:
  │  ├─ Update profile with bonus flag
  │  ├─ Create transaction record
  │  └─ Return success
  └─ Return eligibility status
```

## Data Structure

### Profile Metadata

```javascript
profile.metadata = {
  referral_bonus_applied: true,          // Flag indicating bonus was applied
  referral_bonus_applied_at: Date,       // When bonus was applied
  ...other metadata
}
```

### Transaction Record

```javascript
{
  user_id: ObjectId,
  type: 'BONUS',
  amount_cents: 50000,                   // KES 500
  description: 'Referral bonus: 5+ referrals + account activation',
  status: 'completed',
  metadata: {
    bonus_type: 'referral_activation',
    referral_count: 5,                   // Number of referrals
  },
  created_at: Date
}
```

## Modal States

### Loading State
- Shows spinner
- Message: "Checking your eligibility..."

### Qualified State
- ✅ Success checkmark
- Shows bonus amount: KES 500
- Displays referral count
- Shows activation status
- Green success styling

### Unqualified State
- Shows 4-step requirements list
- Displays current progress (e.g., "3/5 referrals")
- Explains what's still needed
- Blue informational styling

## Configuration

### Bonus Amount
- **Location**: `app/actions/referrals.ts` line ~508
- **Current**: 50,000 cents (KES 500)
- **To Change**: Update `const bonusAmount = 50000;`

### Minimum Referrals
- **Location**: `app/actions/referrals.ts` line ~490
- **Current**: 5 referrals
- **To Change**: Update `const hasEnoughReferrals = referralCount >= 5;`

## Testing

### Manual Testing

1. **Create Test User**
   ```bash
   # Sign up as a new user
   # Activate account (complete a task or deposit)
   # Share referral link
   ```

2. **Test Eligibility Check**
   - Navigate to dashboard
   - Modal should appear
   - Check browser console for `[v0]` debug logs
   - Verify correct eligibility status

3. **Test Bonus Application**
   - Create 5 referrals
   - Ensure all have signed up via your link
   - Visit dashboard
   - Modal should show success
   - Check wallet for KES 500 bonus
   - Verify transaction record in database

### Debug Logging

All bonus operations log with `[v0]` prefix:

```
[v0] Checking bonus eligibility for: user@example.com
[v0] User has 5 referrals
[v0] Bonus eligibility: { isActivated: true, hasEnoughReferrals: true, bonusAlreadyApplied: false }
[v0] Applying KES 500 bonus to user: user@example.com
[v0] Bonus applied successfully!
```

## Edge Cases Handled

1. **User not activated**: Shows requirements list
2. **Not enough referrals**: Shows progress (e.g., "3/5")
3. **Bonus already applied**: Shows "Bonus already applied" message
4. **Session expired**: Returns unauthorized error
5. **Database errors**: Returns graceful error message
6. **Referral count is 0**: Shows full requirements

## Security & Validation

- ✅ Server-side verification of all criteria
- ✅ Authentication check before processing
- ✅ Atomic database operations to prevent duplicates
- ✅ Transaction records for audit trail
- ✅ Proper error handling with descriptive messages
- ✅ No client-side bonus calculation

## Performance Considerations

- Modal state managed locally to prevent unnecessary API calls
- Eligibility checked once per modal opening
- Efficient referral count query using aggregation
- Bonus application is atomic transaction

## Future Enhancements

1. **Tiered Bonuses**: Different bonus amounts for different referral counts
2. **Referral Rewards**: Bonuses for referring specific user types
3. **Milestone Tracking**: Show referral progress in dashboard
4. **Time-Limited Bonuses**: Bonuses that expire if not claimed
5. **Leaderboards**: Top referrers with bonus milestones
6. **Referral Analytics**: Dashboard showing referral performance

## Troubleshooting

### Modal doesn't appear
- Check if user is authenticated (`session?.user` exists)
- Check browser console for errors
- Verify component is imported correctly

### Bonus not being applied
- Check user `is_active` status in database
- Count referrals: `db.referrals.countDocuments({ referrer_id: userId })`
- Check for duplicate bonus flag: `profile.metadata.referral_bonus_applied`
- Review console logs with `[v0]` prefix

### Wrong referral count showing
- Verify referrals were created with correct `referrer_id`
- Check referral collection for data integrity
- Ensure referred users have active accounts

## Support

For issues or questions about the referral bonus system:
1. Check the debug logs in browser console
2. Review this documentation
3. Check database collections directly
4. Contact admin team
