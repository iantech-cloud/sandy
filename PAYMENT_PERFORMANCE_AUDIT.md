# Payment Performance Audit & Optimization

## Issues Found

### 1. **Token Caching Strategy is Broken**
- Line 235 in coop-bank.ts: `this.tokenCache = null` ALWAYS clears cache before each STK push
- Each payment request now makes TWO API calls:
  - Token request (60s timeout)
  - STK Push request (60s timeout)
- **Impact**: 120s+ latency per payment instead of 60s+

### 2. **Session/Transaction Management Issues**
- Callback route creates MongoDB session BEFORE checking idempotency (line 61-62)
- If duplicate callback arrives, session is created but immediately aborted (waste)
- No index on `checkout_request_id` for fast lookups (line 65-67)

### 3. **N+1 Query in Callback**
- Line 218: Fetches user profile AFTER already having user_id
- Line 243-248: Fetches ActivationPayment with $or query (non-indexed)
- Line 140: Fetches SpinWallet without index on user_id

### 4. **Blocking Operations in Callback**
- All database saves use `await` in transaction
- No parallelization of independent updates
- Background activation work decoupled but other operations block

## Solutions

### Fix 1: Restore Token Caching
- Only clear cache on actual token errors
- Reuse valid tokens within 60s safety window
- Expected improvement: **50% latency reduction**

### Fix 2: Add Database Indexes
- Create index on MpesaTransaction.checkout_request_id
- Create index on SpinWallet.user_id
- Create index on ActivationPayment.checkout_request_id

### Fix 3: Optimize Callback Flow
- Check idempotency BEFORE creating session
- Parallelize independent update operations
- Use lean queries where possible

### Fix 4: Add Monitoring
- Log payment latency metrics
- Track token reuse rate
- Alert on slow callbacks (>10s)

## Expected Results
- Token caching: 40-60% faster
- Database indexes: 20-30% faster
- Query parallelization: 10-15% faster
- **Total: 50-70% latency reduction**
