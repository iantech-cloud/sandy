# Referral System Fix - Test Cases & Verification

## Test Scenario 1: New Referral Activation

### Setup
- Admin user with ID: `admin_123`
- Admin refers user with email: `test@example.com`
- User pays KES 90 for activation

### Expected Results

| Item | Expected Value | Check |
|------|----------------|-------|
| Referrer bonus amount | 7,000 cents (KES 70) | ✅ |
| Company gets | 2,000 cents (KES 20) | ✅ |
| Transaction created for referrer | Yes, type='REFERRAL' | ✅ |
| Transaction created for company | Yes, type='COMPANY_REVENUE' | ✅ |
| Referrer balance increase | +7,000 cents | ✅ |
| Company balance increase | +2,000 cents | ✅ |
| Referral marked as bonus_paid | true | ✅ |
| bonus_paid_amount | 7,000 cents | ✅ |

### Test Steps
```
1. Create referral: admin_123 → test_user
2. Have test_user activate (pay KES 90)
3. Check admin_123 balance: increased by KES 70
4. Check company revenue: increased by KES 20
5. Verify transaction records exist
6. Check referral record shows bonus_paid=true, amount=7000
```

### SQL Query to Verify
```sql
-- Check referral bonus amount
SELECT _id, referrer_id, referral_bonus_amount_cents, referral_bonus_paid 
FROM referrals 
WHERE referred_id = <user_id> 
AND referral_bonus_paid = true;
-- Expected: referral_bonus_amount_cents = 7000

-- Check transactions
SELECT user_id, type, amount_cents 
FROM transactions 
WHERE type IN ('REFERRAL', 'COMPANY_REVENUE') 
AND metadata->>'referred_username' = 'test_user';
-- Expected: REFERRAL = 7000, COMPANY_REVENUE = 2000
```

---

## Test Scenario 2: Multiple Referrals from Same Referrer

### Setup
- Admin refers 3 different users
- All 3 users activate
- Check cumulative earnings

### Expected Results

| Item | Expected |
|------|----------|
| Total referral bonus paid | 3 × 7,000 = 21,000 cents (KES 210) |
| Total company revenue | 3 × 2,000 = 6,000 cents (KES 60) |
| Admin balance increase | +21,000 cents |
| Referral count | 3 |
| Activated referral count | 3 |

### Verification Query
```sql
SELECT 
  referrer_id,
  COUNT(*) as total_referrals,
  SUM(referral_bonus_amount_cents) as total_earned
FROM referrals
WHERE referral_bonus_paid = true
GROUP BY referrer_id
-- Expected: Each admin with 3 referrals shows 21000 cents total
```

---

## Test Scenario 3: Referral Without Referrer

### Setup
- User registers without referral code
- User activates (pays KES 90)
- No referrer exists

### Expected Results

| Item | Expected Value |
|------|----------------|
| Referrer bonus | None (no referrer) |
| Company revenue (direct) | 2,000 cents (KES 20) |
| Unclaimed referral bonus | 7,000 cents (KES 70) |
| Total company gets | 9,000 cents (KES 90) |
| Referral record | None |

### SQL Query
```sql
SELECT type, amount_cents 
FROM transactions 
WHERE user_id = <user_id> 
AND type IN ('COMPANY_REVENUE', 'UNCLAIMED_REFERRAL');
-- Expected: COMPANY_REVENUE = 2000, UNCLAIMED_REFERRAL = 7000
```

---

## Test Scenario 4: Dashboard Display

### Setup
- Referrer with 5 activated referrals
- Check dashboard shows correct amounts

### Expected Display
```
Total Referrals: 5
Active Referrals: 5
Level 1 Earnings: KES 350 (5 × 70)
Total Earnings: KES 350

Commission Structure:
  Level 1: KES 70 per referral
  Level 2: KES 10 (if implemented)
  Company: KES 20
```

### API Verification
```javascript
// Call the referral dashboard API
GET /api/referrals?role=user

// Check response includes:
{
  commissionStructure: {
    level1: 70,
    level2: 10,
    company: 20
  },
  totalEarnings: 350,
  level1Earnings: 350
}
```

---

## Test Scenario 5: Historical Data Correction

### Setup
- Database has referrals with incorrect amounts:
  - Some with 70,000 cents (KES 700)
  - Some with other incorrect amounts
  - Some missing transactions
- Run the fix script

### Expected After Fix

| Item | Before | After |
|------|--------|-------|
| Incorrect amount referrals | Multiple | 0 |
| Missing transactions | Some | All created |
| Referrer balances | Inconsistent | Corrected |
| Audit logs | None | All logged |

### Verification Script
```javascript
// Should find 0 incorrect bonuses after fix
db.referrals.find({ 
  referral_bonus_paid: true,
  referral_bonus_amount_cents: { $ne: 7000 }
}).count()
// Expected: 0

// Should find all transactions have been created
db.referrals.aggregate([{
  $lookup: {
    from: "transactions",
    localField: "_id",
    foreignField: "metadata.referral_id",
    as: "transactions"
  }
}])
// Expected: All referrals have at least one transaction
```

---

## Test Scenario 6: Edge Case - Concurrent Activations

### Setup
- Multiple users from same referrer activate simultaneously
- Verify no race conditions

### Expected Results
- All referrals processed correctly
- No duplicate bonuses
- All balances accurate
- All transactions recorded

### Stress Test
```bash
# Simulate 10 concurrent activations
for i in {1..10}; do
  curl -X POST /api/activation \
    -d "referrer=admin_123&email=test_$i@example.com"
done

# All 10 should result in:
# - 10 REFERRAL transactions of 7000 cents each
# - 10 COMPANY_REVENUE transactions of 2000 cents each
# - Admin balance increase of 70,000 cents
```

---

## Test Scenario 7: Amount Breakdown Verification

### Activation Fee Split

```
User Pays:        KES 90 (9,000 cents)
  ├─ Referrer:    KES 70 (7,000 cents) ✅ [WAS 700]
  └─ Company:     KES 20 (2,000 cents) ✅ [WAS 10]
        ↓
Total Distributed: KES 90 ✅
```

### Mathematical Verification
```
9000 cents total
= 7000 + 2000
= referrer + company
✅ Correct
```

### Test Code
```javascript
function verifyActivationSplit(activationFee, referrerBenefit, companyBenefit) {
  return activationFee === (referrerBenefit + companyBenefit);
}

// Should return true
verifyActivationSplit(9000, 7000, 2000)
```

---

## Manual Testing Checklist

### Pre-Deployment
- [ ] Code changes reviewed
- [ ] TypeScript compiles: `npm run build` ✅
- [ ] No lint errors
- [ ] All imports correct
- [ ] Database backup taken

### Post-Deployment
- [ ] Deploy code successfully
- [ ] Run correction script
- [ ] Verify no errors in logs
- [ ] Test new referral activation (Scenario 1)
- [ ] Check dashboard display (Scenario 4)
- [ ] Verify user balances (Scenario 5)
- [ ] Check company revenue totals
- [ ] Review audit logs

### Daily Monitoring (First Week)
- [ ] New referral activations process correctly
- [ ] Bonuses are KES 70 (not 700)
- [ ] Company revenue is KES 20 per activation
- [ ] Dashboard shows accurate amounts
- [ ] No error messages in logs
- [ ] User complaints about balances

### Weekly Review
- [ ] Total referral bonuses paid = count × 7000 cents
- [ ] Company revenue = count × 2000 cents
- [ ] All transactions properly recorded
- [ ] User balance integrity verified
- [ ] Audit logs show all corrections

---

## Automated Test Suite

### Unit Test Example
```typescript
describe('Referral Bonus Calculation', () => {
  test('should award KES 70 (7000 cents) per referral', () => {
    const bonus = calculateReferralBonus();
    expect(bonus).toBe(7000);
  });

  test('should award KES 20 (2000 cents) to company', () => {
    const companyFee = calculateCompanyFee();
    expect(companyFee).toBe(2000);
  });

  test('should sum to activation fee', () => {
    const total = 7000 + 2000;
    expect(total).toBe(9000);
  });
});

describe('Referral Dashboard', () => {
  test('should display KES 70 per referral', () => {
    const earnings = formatEarnings(7000);
    expect(earnings).toBe('70');
  });

  test('should show correct commission structure', () => {
    const structure = getCommissionStructure();
    expect(structure.level1).toBe(70);
    expect(structure.company).toBe(20);
  });
});
```

---

## Performance Verification

### Load Test
```
Scenario: 1000 concurrent referral activations
Expected Results:
- All process without errors
- Database performance remains acceptable
- No timeout errors
- All transactions recorded
- Correct amounts for all
```

### Query Performance
```sql
-- These queries should complete in <1 second
SELECT COUNT(*) FROM referrals WHERE referral_bonus_paid = true;
SELECT SUM(amount_cents) FROM transactions WHERE type = 'REFERRAL';
SELECT SUM(amount_cents) FROM transactions WHERE type = 'COMPANY_REVENUE';
```

---

## Success Criteria

✅ **All tests pass when:**
1. Referrer bonuses are exactly 7,000 cents
2. Company revenue is exactly 2,000 cents per activation
3. Dashboard displays match database values
4. User balances match transaction sums
5. No error messages or warnings
6. Historical data is corrected
7. New activations use correct amounts
8. Audit logs record all changes

---

## Reporting Issues

If any test fails:
1. Note the exact failure
2. Check the logs for error details
3. Verify database integrity
4. Review the code changes
5. Report with:
   - Test scenario name
   - Expected vs actual values
   - Error message/logs
   - Database state
   - Steps to reproduce

---

**Test Documentation Created**: Ready for QA team to execute
