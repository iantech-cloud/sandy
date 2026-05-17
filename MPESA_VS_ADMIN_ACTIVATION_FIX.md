# MPESA vs Admin Activation - Root Cause Fix

## Critical Issues Identified & Fixed

### Issue #1: Admin Approval NOT Processing Referral Bonuses
**Root Cause:** The `approveUser()` function in `app/actions/admin.ts` was only updating the user profile status but never calling the referral bonus logic.

**What Was Happening:**
- Admin approves user ✓
- User gets activated ✓  
- **But referral bonus NEVER awarded** ✗

**What MPESA Callback Was Doing:**
- Payment successful ✓
- Calls `completeActivationAfterPayment()` ✓
- Referral bonus properly awarded ✓

**Fix Applied:**
- Updated `approveUser()` to include the complete referral bonus logic
- Creates Transaction record with type='REFERRAL'
- Creates Earning record with type='REFERRAL'
- Updates referrer's balance and total earnings
- Updates referral record status to 'bonus_paid'

---

### Issue #2: Direct Referrals Dashboard Card Shows KES 0.00
**Root Cause:** The dashboard query was only checking the `Earning` collection for type='REFERRAL', but the activation flow creates `Transaction` records with type='REFERRAL', not `Earning` records.

**What Was Happening:**
- User gets activated via MPESA ✓
- Referral bonus paid as Transaction record ✓
- **Dashboard looks in Earning collection** ✗
- Finds nothing, shows KES 0.00 ✗

**Fix Applied:**
- Updated `fetchDashboardData()` in `app/lib/data.ts`
- Now queries BOTH collections:
  - `Earning.aggregate()` - gets REFERRAL type earnings
  - `Transaction.aggregate()` - gets REFERRAL type transactions
- Combines both totals for display
- Added logging to debug the breakdown

---

## Files Modified

### 1. `/app/actions/admin.ts` (Lines 625-750)
**Changes:** Enhanced `approveUser()` function
- Added referral detection
- Added bonus award logic (KES 70)
- Creates Transaction and Earning records
- Updates referrer balance
- Detailed logging for debugging

### 2. `/app/lib/data.ts` (Lines 103-246)
**Changes:** Fixed direct referral earnings calculation
- Added new query for Transaction REFERRAL records
- Updated destructuring to handle new data
- Combined earnings from both sources
- Added console logging for transparency

---

## Detailed Bonus Flow - Admin Approval

```
1. Admin calls approveUser(userId)
2. User profile updated to active
3. Check if user.referred_by is set
4. If referrer exists:
   a. Find referral record
   b. If bonus not yet paid:
      - Create Transaction (7000 cents = KES 70)
      - Create Earning (7000 cents = KES 70)
      - Update referrer.balance_cents += 7000
      - Update referrer.total_earnings_cents += 7000
      - Mark referral record as bonus_paid
5. Return success
```

---

## Dashboard Direct Referrals Calculation - Fixed

### Before (Broken):
```javascript
const directReferralEarnings = 
  Earning.aggregate([
    { $match: { user_id: userId, type: 'REFERRAL' } },
    { $group: { total: { $sum: '$amount_cents' } } }
  ])
// Result: Only got Earning collection records
// Missing: All Transaction collection records
```

### After (Fixed):
```javascript
// Query 1: Get from Earning collection
const earningTotal = Earning.aggregate([...])

// Query 2: Get from Transaction collection
const transactionTotal = Transaction.aggregate([...])

// Combine both
const total = earningTotal + transactionTotal

// Display in dashboard
```

---

## Testing Verification Checklist

- [ ] Admin approves a user with a referrer
- [ ] Referrer should see +KES 70 in their balance immediately
- [ ] Referrer should see transaction in transaction history
- [ ] Dashboard "Direct Referrals" card should show updated earnings
- [ ] MPESA activation should still work as before
- [ ] Both admin and MPESA activation should create identical records

---

## Bonus Amounts - Summary

- **Referrer Bonus:** KES 70 (7,000 cents)
- **Company Fee:** KES 20 (2,000 cents)
- **Total Activation Fee:** KES 90 (9,000 cents)

---

## Debug Logs

When activated, you should see:
```
[v0] Admin approval starting for user: <userId>
[v0] User profile updated: <username>, now processing referral bonus...
[v0] User has referrer: <referrerId>
[v0] Referral record found: true, bonus_paid: false
✅ Referral bonus awarded: <referrerName> earned KES 70

[v0] Direct referral earnings breakdown:
from_earning_collection: <amount>
from_transaction_collection: <amount>
total: <amount>
```

---

## Build Status
✅ TypeScript compilation passes  
✅ All 109 pages generated successfully  
✅ Ready for deployment
