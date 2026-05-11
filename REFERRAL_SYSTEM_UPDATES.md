# Referral System Updates

## Overview
The referral system has been fully updated to follow the enhanced 2-level referral structure with mandatory registration via referral links and reduced activation fees.

## Key Changes

### 1. Commission Structure (Updated)
- **Level 1 (Direct Referrals)**: KES 70 per referral
  - Earned when someone you refer activates their account
- **Level 2 (Indirect Referrals)**: KES 10 per referral
  - Earned when someone your referral refers activates their account
- **No earnings beyond Level 2**: Only 2-level commission system

**Previous Structure**:
- First 2 Direct: KES 600 each
- Subsequent Direct: KES 700 each
- Level 1 Downline: KES 100 each

### 2. Activation Fee (Reduced)
- **Previous**: KES 1,000
- **Updated**: KES 100
- Users must pay this fee to activate their account and earn commission eligibility

### 3. Platform Access Requirement
- **All new users MUST register using a valid referral link**
- Registration without a referral code is now rejected
- Prevents unsponsored users from joining the platform
- Every registered user automatically becomes eligible to refer others after successful registration

### 4. Self-Referral Protection
- Self-referrals are now blocked
- Users cannot register accounts using their own referral codes

### 5. Wallet System
- All referral earnings (Level 1 and Level 2) are credited directly to the wallet
- Wallet reflects real-time commission updates when users activate accounts
- Users can view their earnings in the wallet dashboard

## File Changes

### Backend Files Modified

#### `/app/lib/services/commissionService.ts`
```typescript
// Updated commission configuration
export const COMMISSION_CONFIG = {
  level1: 7000,      // KES 70 for direct referrals (Level 1)
  level2: 1000,      // KES 10 for indirect referrals (Level 2)
  activationFee: 10000 // KES 100 activation fee
};
```

**Changes**:
- Simplified from 4 commission types to 2 (level1 and level2)
- Updated `processDirectReferralCommission()` to use simple KES 70 commission
- Updated `processLevel1Commission()` to use KES 10 for Level 2 commissions
- Removed first2/subsequent differentiation
- Updated metadata to reflect 2-level system

#### `/app/api/auth/register/route.ts`
```typescript
// Referral code is now MANDATORY
if (!referralId) {
  return NextResponse.json(
    { message: 'Referral code is required. You must register using a valid referral link.' }, 
    { status: 400 }
  );
}

// Added self-referral prevention
if (referrerProfile.email === email) {
  return NextResponse.json({ 
    message: 'Self-referral is not allowed. Please use a different referral code.' 
  }, { status: 400 });
}
```

**Changes**:
- Made `referralId` mandatory (no longer optional)
- Added validation to prevent self-referrals
- Improved error messages for referral validation
- Added check for referrer account status

#### `/app/auth/sign-up/SignUpContent.tsx`
```typescript
// Referral code validation updated
if (!formData.referralId) {
  setError('Referral code is required. You must sign up using a valid referral link.');
  return false;
}
```

**Changes**:
- Updated validation to require referral code
- Updated error message to inform users about mandatory referral requirement
- Updated validation regex comment

### New Files Created

#### `/app/actions/referral-dashboard.ts`
- New server action to fetch comprehensive referral dashboard data
- Returns referral link, code, earnings breakdown by level
- Calculates active referrals and commission statistics
- Used by referral pages for real-time data display

#### `/app/dashboard/referrals/page.tsx` (Updated)
- Updated to show 2-level commission structure
- Updated commission breakdown cards to show Level 1 and Level 2
- Updated commission structure info section
- Simplified from 4-tier to 2-tier display
- Updated activation fee messaging (KES 100 instead of KES 1,000)

### Database Schema
No schema changes required. The existing `Referral`, `Transaction`, and `Profile` models support the new 2-level structure through the `metadata.level` field.

## Commission Flow

### When User Activates
1. User completes payment of KES 100 activation fee
2. User's account is approved by admin
3. Commission service triggers `processReferralCommissions()`
4. **Level 1 Commission**: Direct referrer earns KES 70
   - Transaction created with `metadata.level: 1`
   - Amount: 7000 cents (KES 70)
   - Added to referrer's wallet immediately
5. **Level 2 Commission**: Indirect referrer (if exists) earns KES 10
   - Transaction created with `metadata.level: 2`
   - Amount: 1000 cents (KES 10)
   - Added to Level 2 referrer's wallet immediately

## User Experience Changes

### Registration
- Users see error if trying to register without referral code
- Referral code field is now required
- Users cannot self-refer

### Dashboard
- Referral earnings page shows:
  - Level 1 earnings (Direct): KES 70 per person
  - Level 2 earnings (Indirect): KES 10 per person
  - Total referral earnings
  - Referral list with activation status
  - Commission structure explanation

### Wallet
- Displays real-time balance updates
- Shows all REFERRAL transactions separately
- Can withdraw referral earnings anytime (subject to Friday-only withdrawal rule)

## Validation Rules

1. ✅ Registration requires valid referral code
2. ✅ Only 2 levels of referral earnings supported
3. ✅ Wallet updates in real-time when commissions are credited
4. ✅ Self-referrals are prevented
5. ✅ Referrer must be active/approved to accept new referrals
6. ✅ Commission only paid after referred user's activation

## Migration Notes

If migrating from old system:
1. Existing referral records continue to work
2. New transactions will use Level 1 and Level 2 metadata
3. Old commission transactions remain unchanged in history
4. Users see updated commission structure going forward

## Testing Checklist

- [ ] Registration requires referral code
- [ ] Self-referral prevented
- [ ] Invalid referral code rejected
- [ ] Level 1 commission (KES 70) created when direct referral activates
- [ ] Level 2 commission (KES 10) created when indirect referral activates
- [ ] Wallet updates immediately with commission
- [ ] Dashboard shows correct earnings by level
- [ ] Only 2 levels visible in commission breakdown
- [ ] Referral link shareable and copyable
- [ ] Conversion rate calculates correctly
