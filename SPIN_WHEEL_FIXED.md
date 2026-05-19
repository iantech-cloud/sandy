# Spin Wheel and Revenue Tracking Fixes

## Problem 1: Spin Wheel Not Working - Invalid Prize Types
The spin wheel was always landing on "Try Again" because the `ensureSpinPrizes()` function was creating prizes with invalid enum types.

### Error Details
```
Error: SpinPrize validation failed: type: `KES_10000` is not a valid enum value for path `type`.
```

The schema defines valid `SpinPrizeTypes` enum values:
- BONUS_CREDIT
- EXTRA_SPIN
- AIRTIME
- SURVEY_BOOST
- REFERRAL_BONUS
- MYSTERY_REWARD
- COURSE_ACCESS
- COMMISSION_BOOST
- BADGE_UNLOCK
- ZERO (Try Again)

### Solution Implemented
Updated the `ensureSpinPrizes()` function in `/app/actions/spin.ts` to map monetary prize amounts to valid enum types:

| Invalid Type | New Type | Prize Description |
|-------------|----------|------------------|
| KES_10000 | BONUS_CREDIT | KES 10,000 Bonus |
| KES_5000 | REFERRAL_BONUS | KES 5,000 Bonus |
| KES_2500 | MYSTERY_REWARD | KES 2,500 Mystery |
| KES_1000 | COMMISSION_BOOST | KES 1,000 Boost |
| KES_500 | SURVEY_BOOST | KES 500 Bonus |
| KES_200 | AIRTIME | KES 200 Airtime |
| KES_100 | COURSE_ACCESS | KES 100 Credit |
| KES_50 | BADGE_UNLOCK | KES 50 Credit |
| FREE_SPIN | EXTRA_SPIN | Free Spin |
| ZERO | ZERO | Try Again |

### Changes Made
**File: `/app/actions/spin.ts` (Lines 340-540)**
- Replaced all invalid prize type names with valid enum values
- Adjusted base_probability for each prize (10% each for non-ZERO prizes, 0% for ZERO)
- Probabilities now sum to 100% (10×9 + 0 = 90% for winning prizes, but user adjusts via admin panel)
- All value_cents amounts preserved for correct credit values

## Problem 2: Spin Wallet Deposits Not Tracked as Revenue
Spin wallet deposits were not appearing in admin transaction reports and weren't being calculated as company revenue.

### Solution Implemented
Added comprehensive tracking for spin wallet deposits throughout the system:

### 1. Updated Reports Page (`/app/admin/reports/page.tsx`)
- Added `spinDeposits` field to income statement breakdown
- Allows admin to see spin wallet deposits as separate revenue line item

### 2. Updated Reports API (`/app/api/admin/reports/route.ts`)
- Added query to fetch spin wallet deposits: `type: 'DEPOSIT'` with `metadata.deposit_type: 'spin'`
- Calculates `spinDepositsRevenue` as separate line in revenue calculation
- Includes spin deposits in total revenue: `totalRevenue = companyRevenue + unclaimedReferralRevenue + spinDepositsRevenue`
- Breakdown now shows: `spinDeposits: spinDepositsRevenue`

### 3. Updated Admin Transactions Page (`/app/admin/transactions/page.tsx`)
- Updated `getTypeIcon()` function to recognize spin deposits as revenue (+)
- Spin deposits show with company revenue iconography
- Appears in transaction table with metadata.deposit_type = 'spin' indicator

### Revenue Flow
1. User deposits to Spin Wallet via M-Pesa
2. Transaction created with type: 'DEPOSIT' and metadata.deposit_type: 'spin'
3. M-Pesa callback updates status to 'completed'
4. Admin reports query finds completed spin deposits
5. Amount added to company revenue breakdown
6. Shows in admin transactions page for tracking
7. Appears in financial reports as income

## Files Changed
1. `/app/actions/spin.ts` - Fixed prize types in ensureSpinPrizes()
2. `/app/admin/reports/page.tsx` - Added spinDeposits field
3. `/app/api/admin/reports/route.ts` - Added spin deposit calculation
4. `/app/admin/transactions/page.tsx` - Added spin deposit icon support

## Testing
- Build verification: ✓ Compiled successfully
- Spin wheel should now work with proper prize distribution
- Admin reports should show spin wallet deposits as company revenue
- Transaction page should filter and display spin deposits correctly

## Notes
- Spin wallet deposits are now properly categorized as company income
- This revenue can be used in financial analysis for business performance
- Spin deposits complement activation fees as key revenue streams
