# Admin API - Current State & Planned Rewrite

## Executive Summary

The admin panel needs complete rewrite of:
- 15 API endpoints (some broken, some incomplete)
- 27 page components (need fresh implementation)
- Database queries (inconsistent patterns)
- Data validation (missing on most endpoints)

**The redirect mechanism from /dashboard to /admin will NOT be touched.**

---

## Database Schema Quick Reference

### Profile Collection
```javascript
{
  _id: ObjectId,
  email: String,
  username: String,
  role: 'user' | 'admin' | 'super_admin',
  is_active: Boolean,
  is_verified: Boolean,
  approval_status: 'pending' | 'approved' | 'rejected',
  created_at: Date,
  activation_paid_at: Date,
  account_balance_cents: Number,
  total_earnings_cents: Number,
  // ... other fields
}
```

### Transaction Collection
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  type: String,
  amount_cents: Number,
  status: 'pending' | 'completed' | 'failed',
  target_type: 'user' | 'company',
  created_at: Date,
}
```

### Withdrawal Collection
```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  amount_cents: Number,
  status: 'pending' | 'completed' | 'failed',
  created_at: Date,
  processed_at: Date,
}
```

### Company Collection
```javascript
{
  _id: ObjectId,
  name: String,
  wallet_balance_cents: Number,
  total_revenue_cents: Number,
  total_expenses_cents: Number,
}
```

---

## Current API Endpoints Analysis

### 1. `/api/admin/stats/users` - User Statistics
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Incomplete aggregation, no error handling
**Rewrite**: Clean aggregation with proper error handling

**Should Return**:
```json
{
  total_users: number,
  active_users: number,
  pending_approvals: number,
  today_registrations: number,
  new_users_this_week: number,
  approval_rate_percentage: number
}
```

### 2. `/api/admin/stats/financial` - Financial Metrics
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Complex calculations, missing fields
**Rewrite**: Separate revenue vs expenses clearly

**Should Return**:
```json
{
  company_wallet_balance: number,
  total_revenue: number,
  total_expenses: number,
  net_profit: number,
  pending_withdrawals: number,
  pending_withdrawal_count: number,
  user_total_balances: number
}
```

### 3. `/api/admin/stats/breakdown` - Revenue Breakdown
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Missing transaction categories
**Rewrite**: Proper categorization by transaction type

**Should Return**:
```json
{
  revenue: {
    activation_fees: number,
    unclaimed_referrals: number,
    spin_costs: number,
    content_payments: number,
    other: number
  },
  expenses: {
    user_payouts: number,
    bonuses: number,
    referral_commissions: number,
    spin_prizes: number,
    task_payments: number,
    survey_payments: number,
    other: number
  }
}
```

### 4. `/api/admin/transactions` - Get Transactions
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No pagination, no filtering
**Rewrite**: Add pagination, filters, sorting

**Query Params**:
- `page`: number (default 1)
- `limit`: number (default 20)
- `type`: string (filter by type)
- `status`: string (filter by status)
- `sort`: string (created_at, amount)

**Should Return**:
```json
{
  data: Transaction[],
  total: number,
  pages: number,
  page: number
}
```

### 5. `/api/admin/audit-logs` - Audit Logs
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No pagination, incomplete logging
**Rewrite**: Add pagination, proper filtering

**Query Params**:
- `page`: number
- `limit`: number
- `action`: string (filter)
- `user_id`: string (filter)

**Should Return**:
```json
{
  data: AuditLog[],
  total: number,
  pages: number
}
```

### 6. `/api/admin/submissions` - Content Submissions
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No filtering, incomplete data
**Rewrite**: Add proper status filtering

**Query Params**:
- `status`: 'pending' | 'approved' | 'rejected'
- `page`: number
- `limit`: number

### 7. `/api/admin/spin/settings` - Spin Settings
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Incomplete CRUD operations
**Rewrite**: Add update/create operations

**Methods**: GET, POST (update)

### 8. `/api/admin/spin/toggle` - Toggle Spin
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No validation
**Rewrite**: Add proper status validation

### 9. `/api/admin/spin/logs` - Spin Logs
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No pagination
**Rewrite**: Add pagination and filtering

### 10. `/api/admin/spin/analytics` - Spin Analytics
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Complex calculations, no caching
**Rewrite**: Add proper metrics calculation

### 11. `/api/admin/reports` - Generate Reports
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No report templates
**Rewrite**: Add standard report types

### 12. `/api/admin/company-reports` - Company Reports
**Status**: ⚠️ NEEDS REWRITE
**Issues**: Overlaps with #11
**Rewrite**: Consolidate or clarify

### 13. `/api/admin/audit-logs` (duplicate) - Already listed

### 14. `/api/admin/mpesa-change-requests` - M-Pesa Changes
**Status**: ⚠️ NEEDS REWRITE
**Issues**: No validation
**Rewrite**: Add proper request handling

### 15. `/api/admin/fix-blog-links` & `/api/admin/normalize-emails`
**Status**: ⚠️ MAINTENANCE ENDPOINTS
**Action**: Keep but mark as internal only

---

## Priority API Rewrite Order

### CRITICAL (Do First)
1. **User Statistics** - Foundation for dashboard
2. **Financial Stats** - Core business metrics
3. **Transactions API** - Data for reports

### HIGH (Do Second)
4. **Audit Logs** - Compliance/debugging
5. **Submissions** - Content management
6. **Spin Management** - Feature critical

### MEDIUM (Do Third)
7. **Reports Generation** - Reporting features
8. **Chat Management** - Secondary feature
9. **Settings APIs** - Configuration

### LOW (Can Defer)
10. **Maintenance endpoints** - Internal tools
11. **Specialized endpoints** - Nice to have

---

## Data Validation Requirements

All APIs should validate:
- ✅ Admin authentication (role check)
- ✅ Request parameters (type, length, range)
- ✅ Query filters (valid values)
- ✅ Pagination (valid page/limit)
- ✅ Response format (consistent)

---

## Error Handling

All APIs should return:
```json
{
  "success": false,
  "error": "Description",
  "code": "ERROR_CODE",
  "status": 400
}
```

---

## Performance Requirements

- Dashboard load: < 2 seconds
- API response: < 500ms
- Database query: < 100ms (use lean() for optimization)
- Pagination: Always use for large datasets
- Caching: 1-minute cache for stats

---

## Testing Checklist

For each API endpoint:
- [ ] Test with valid data
- [ ] Test with invalid data
- [ ] Test pagination
- [ ] Test filters
- [ ] Test auth failure
- [ ] Test role check
- [ ] Verify response format
- [ ] Check performance

---

## Implementation Notes

### Use These Patterns:
```typescript
// 1. Authentication check
const session = await auth();
if (!session?.user?.id) return unauthorized();

// 2. Admin role check
const admin = await Profile.findById(session.user.id).select('role');
if (admin?.role !== 'admin' && admin?.role !== 'super_admin') {
  return unauthorized();
}

// 3. Error handling
try {
  // code
  return NextResponse.json({ success: true, data });
} catch (error) {
  return NextResponse.json({ success: false, error: error.message }, { status: 500 });
}

// 4. Pagination
const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
const skip = (page - 1) * limit;

// 5. Lean queries (faster)
const data = await Model.find(filter).lean().limit(limit).skip(skip);
const total = await Model.countDocuments(filter);
```

---

## What NOT to Change

**PRESERVE THESE EXACTLY**:
- `/admin/layout.tsx` - The redirect mechanism
- `app/admin/admin-layout-client.tsx` - Navigation layout
- The authentication flow in layout
- The role checking in layout
- The redirect to `/unauthorized` for non-admins

---

## Next Action

Follow this order:
1. Rewrite critical APIs first (users, financial, transactions)
2. Test each API thoroughly
3. Update page components to use new APIs
4. Test entire admin panel flow
5. Verify redirect still works
