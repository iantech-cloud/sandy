# Referral System Fix - Deployment Guide

## What Was Fixed

This deployment addresses critical bugs in the referral bonus system:

| Issue | Before | After |
|-------|--------|-------|
| Referrer Bonus | KES 700 (70,000 cents) ❌ | KES 70 (7,000 cents) ✅ |
| Company Revenue | Incorrect calculation | KES 20 (2,000 cents) ✅ |
| Dashboard Display | Old/incorrect values | Accurate amounts ✅ |
| Transaction Records | Missing for some | All properly created ✅ |
| Unclaimed Referrals | Not tracked | Now tracked separately ✅ |

## Deployment Steps

### 1. Code Deployment
The fixes are included in the following modified files:
- ✅ `/app/actions/activation.ts` - Fixed bonus amount calculation
- ✅ `/app/actions/referral-dashboard.ts` - Fixed dashboard display
- ✅ `/app/actions/referrals.ts` - Enhanced commission stats
- ✅ `/app/lib/services/commissionService.ts` - Updated config
- ✅ `/app/actions/admin.ts` - Added correction function

**Deploy normally:**
```bash
git push origin main  # or your deployment command
```

### 2. Historical Data Correction (CRITICAL)

After deployment, fix existing referrals with incorrect amounts:

#### Option A: Using Admin Dashboard (Recommended)
1. Log in as admin
2. Go to `/admin/referrals`
3. Look for a "Fix Referral Bonuses" button/action
4. Click to run the correction
5. Monitor the operation for completion

#### Option B: Database Script
Run directly in your backend:
```bash
node --env-file-if-exists=/vercel/share/.env.project scripts/fix-referral-bonuses.ts
```

**What this does:**
- Finds all referrals with incorrect bonus amounts
- Updates each to KES 70 (7,000 cents)
- Creates missing transaction records
- Adjusts user balances accordingly
- Logs all corrections for audit trail

### 3. Verification

After deployment and fix script completion:

✅ **Check Referral Records:**
```javascript
// All referral bonuses should be 7,000 cents (KES 70)
db.referrals.find({ referral_bonus_paid: true }).forEach(ref => {
  console.log(`${ref.referrer_id}: ${ref.referral_bonus_amount_cents} cents`);
  // Should all show 7000
});
```

✅ **Check Transactions:**
```javascript
// All REFERRAL transactions should be 7,000 cents
db.transactions.find({ type: 'REFERRAL' }).forEach(tx => {
  console.log(`${tx.user_id}: ${tx.amount_cents} cents`);
  // Should be 7000 for each
});
```

✅ **Check Company Revenue:**
```javascript
// COMPANY_REVENUE transactions should be 2,000 cents each
db.transactions.find({ type: 'COMPANY_REVENUE', source: 'activation' }).forEach(tx => {
  console.log(`Revenue: ${tx.amount_cents} cents`);
  // Should be 2000
});
```

## New Functionality

### 1. Admin Correction Function
**Available at:** `fixReferralBonuses()` in admin actions

**Purpose:** Automatically correct historical referral bonus amounts

**Usage:**
```typescript
const result = await fixReferralBonuses();
// Result: { success: true, data: { fixed: X, created: Y, skipped: Z } }
```

### 2. Better Dashboard Display
The referral dashboard now shows:
- Accurate earnings totals
- Correct commission structure (KES 70 per referral)
- Count of activated referrals with bonuses paid
- Proper bonus amounts for each referral

### 3. Enhanced Logging
All referral operations now log:
- Bonus amounts
- User balances
- Transaction creation
- Corrections applied

## Rollback Plan

If issues occur:

1. **Immediate:** Disable new referral signups if needed
2. **Investigation:** Check logs for error details
3. **Revert:** Use git to revert to previous version if critical issues found
4. **Communicate:** Inform admins/support of any issues

## Monitoring Recommendations

### Daily Checks
- Monitor admin/company/referrals page for accuracy
- Check that new activations credit correctly
- Verify dashboard shows accurate earnings

### Weekly Reviews
- Audit transaction logs for referral type
- Verify company revenue totals
- Check user balance accuracy vs transactions

### Monthly Analysis
- Compare referral earnings to activation count
- Verify unclaimed referral tracking
- Review correction logs from fix operations

## FAQ

### Q: Will this affect current user balances?
**A:** Only when running the fix script. The script adjusts balances to match the correct KES 70 amount. Users will see their balance increase to reflect correct referral bonuses.

### Q: How do I know if the fix worked?
**A:** Check the referral dashboard. All referral earnings should show as multiples of KES 70. Company revenue should show as multiples of KES 20.

### Q: What about future referrals?
**A:** All new referrals after this deployment will automatically use the correct amounts (KES 70 for referrer, KES 20 for company).

### Q: Can I undo the corrections?
**A:** The correction function adds metadata tracking original amounts. You could reverse if needed, but shouldn't be necessary.

### Q: What if a user complains about their balance?
**A:** The balance adjustment is correct. Explain that referral bonuses were miscalculated before and are now fixed.

## Support Contact

For issues or questions:
- Check the detailed log: `/REFERRAL_SYSTEM_FIX.md`
- Review audit logs in admin panel
- Contact development team with specific transaction IDs

## Timeline

- **Deployment:** Code changes deployed to production
- **+2 hours:** Run correction script on historical data
- **+6 hours:** Monitor for any issues, perform verification checks
- **+24 hours:** Confirm all corrections applied successfully
- **Ongoing:** Monitor daily and weekly as specified above
