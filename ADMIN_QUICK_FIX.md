# Admin Quick Fix Guide - Referral System

## The Problem (In One Sentence)
Referrers were being credited KES 700 instead of KES 70 per referral, and the company was receiving wrong amounts.

## What You Need to Do

### Step 1: Deploy the Code ✅ (Done)
The code changes are already prepared. Deploy normally through your CI/CD pipeline.

### Step 2: Run the Correction (CRITICAL)
Once deployed, correct the historical data:

```bash
# Option A: If you have direct database access
node --env-file-if-exists=/vercel/share/.env.project scripts/fix-referral-bonuses.ts

# Option B: Through admin function (in app)
- Navigate to admin dashboard
- Look for "Fix Referral Bonuses" action
- Click the button to run automatic correction
```

### Step 3: Verify It Worked
Check these 3 things:

1. **Referral Dashboard**: Should show KES 70 per referral (not KES 700)
   - URL: `/referral-earn` or referral dashboard
   - Each referral should show 70 KES earned

2. **Company Revenue**: Should show KES 20 per activation
   - Go to `/admin/company`
   - Check latest transactions
   - Each activation should add KES 20

3. **User Balances**: Should be updated correctly
   - Check any referrer's balance
   - Should show correct total earnings from referrals

## Key Numbers to Remember

| What | Old (Wrong) | New (Correct) |
|------|-----------|---------------|
| Referrer Bonus | KES 700 | KES 70 |
| Company Fee | Wrong | KES 20 |
| Activation Fee | - | KES 90 |

## What Changed (Technical)

**In the code:**
- Changed `70000` cents to `7000` cents (line in activation.ts)
- Fixed company revenue calculation
- Updated dashboard display
- Added correction function

**No database changes needed** - just code updates and running the correction script.

## How to Run the Fix

### Method 1: Command Line (Fastest)
```bash
cd /vercel/share/v0-project
node --env-file-if-exists=/vercel/share/.env.project scripts/fix-referral-bonuses.ts
```

This will:
- Find all referrals with wrong amounts
- Fix each one to KES 70 (7000 cents)
- Create missing transactions
- Update user balances
- Log all changes

Time: ~5-30 minutes depending on number of referrals

### Method 2: Through Admin Dashboard
1. Log in as admin
2. Go to `/admin` (or your admin dashboard)
3. Look for "Referral Management" or "Fix Bonuses"
4. Click "Fix Referral Bonuses"
5. Wait for completion (shows progress)

## After Running the Fix

✅ Check these to confirm it worked:

```javascript
// In MongoDB console or similar
db.referrals.findOne({ referral_bonus_paid: true })
// Should show: referral_bonus_amount_cents: 7000

db.transactions.findOne({ type: 'REFERRAL' })
// Should show: amount_cents: 7000

db.transactions.findOne({ type: 'COMPANY_REVENUE', source: 'activation' })
// Should show: amount_cents: 2000
```

## Quick Troubleshooting

**Q: Script shows "no referrals found"**
- A: No incorrect amounts exist - the fix may have already been applied
- Run it anyway - it's safe and idempotent

**Q: Some referrals were "skipped"**
- A: These likely have missing data. Check the log for details
- They'll be corrected in the next run

**Q: User is complaining about changed balance**
- A: This is correct - they're now getting the right referral bonus
- Explain that KES 700 was an error and KES 70 is correct

**Q: Dashboard still shows old values**
- A: Clear browser cache or restart the app
- Values should update automatically after correction runs

## Important Notes

⚠️ **Before running the fix:**
- Backup your database (best practice)
- Run during low-traffic hours (optional but recommended)
- Notify users if they check balances frequently

⚠️ **The fix is safe because:**
- It's idempotent (safe to run multiple times)
- It only fixes amounts that are wrong
- It tracks all corrections in audit logs
- It adjusts balances to match fixed amounts

✅ **After the fix:**
- All new referrals will use correct amounts automatically
- Historical data is corrected
- Dashboard will show accurate earnings
- Company revenue will be correct

## Testing New Referrals

After applying the fix, test that new referrals work correctly:

1. Create a test referral (have a test admin refer a test user)
2. Have the test user activate (pay KES 90)
3. Verify:
   - Referrer gets +KES 70 in balance
   - Company gets +KES 20 recorded
   - Dashboard shows KES 70 for the referral
   - Transaction records exist for both

## Commands Reference

```bash
# Fix historical data
node --env-file-if-exists=/vercel/share/.env.project scripts/fix-referral-bonuses.ts

# Check build is working (optional)
npm run build

# If you need to see what would be fixed (dry-run):
# Note: modify script to add dry-run mode if needed
```

## Success Indicators ✅

After everything is done, you should see:

1. **Referral Dashboard**
   - Each referral shows 70 (not 700)
   - Totals are multiples of 70
   - Examples: 70, 140, 210, 280, etc.

2. **Company Dashboard** 
   - Activation revenue shows correct amounts
   - Revenue per activation is 20 (not 10 or 70)

3. **User Balances**
   - Referrers have correct total_earnings
   - Balance increases match transaction sums
   - No negative balances

4. **Audit Logs**
   - Show corrections made
   - Track what was changed
   - Display timestamp of corrections

## When to Call Support

Contact the development team if:
- Script fails to run
- You get database errors
- Balances don't match after correction
- Dashboard values still seem wrong
- Transaction amounts are unexpected

## Time Estimate

- Code deployment: 5-15 minutes
- Running correction: 5-30 minutes (depending on volume)
- Verification: 5-10 minutes
- **Total: 15-60 minutes**

## One More Thing

💡 **Pro Tip:** After running the fix once, run it again the next day. It's safe and will confirm that:
- All referrals were processed
- No new incorrect amounts exist
- Database is in consistent state

---

**Questions?** Check the detailed docs:
- `REFERRAL_SYSTEM_FIX.md` - Technical details
- `REFERRAL_FIX_DEPLOYMENT.md` - Full deployment guide
- `REFERRAL_FIX_SUMMARY.txt` - Complete overview
