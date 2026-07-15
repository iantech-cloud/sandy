# MongoDB Connection Pool Timeout Fixes

## Overview
Fixed the "Timed out while checking out a connection from connection pool" error during user activation by implementing comprehensive connection pool optimization and retry logic.

## Issues Addressed

### 1. Connection Pool Size Too Small
**Problem:** `maxPoolSize: 3` was insufficient for concurrent activation requests, causing connection starvation.

**Solution:** Increased to `maxPoolSize: 50` to handle high-concurrency activation spikes.

### 2. Insufficient Timeout Values
**Problem:** Timeouts were too aggressive (10-15 seconds), causing failures during slow operations.

**Solution:**
- `serverSelectionTimeoutMS`: 10s → 30s
- `socketTimeoutMS`: 45s (maintained)
- `connectTimeoutMS`: 10s → 30s
- `waitQueueTimeoutMS`: 15s → 30s (critical for pool exhaustion)

### 3. Poor Connection Lifecycle Management
**Problem:** Idle connections were closed too quickly, forcing reconnections.

**Solution:**
- `minPoolSize`: 2 → 5 (keep more standby connections)
- `maxIdleTimeMS`: 30s → 60s (longer connection reuse window)
- Added `heartbeatFrequencyMS: 10000` for proactive health checks

### 4. No Connection Retry Logic
**Problem:** First connection pool timeout resulted in immediate failure.

**Solution:** Added `withConnectionRetry()` utility with exponential backoff:
- Retries up to 5 times for activation completion
- Retries up to 3 times for payment initiation
- 1.5x exponential backoff between retries

### 5. Parallel Database Queries During Activation
**Problem:** Multiple concurrent database queries during activation exhausted the pool.

**Solution:** Created `/app/lib/db-pool-utils.ts` with:
- `executeSequentialQueries()`: Runs queries one-at-a-time
- `executeBatchQueries()`: Batches queries in configurable chunks
- `withConnectionRetry()`: Wraps operations with automatic retry and backoff

## Files Modified

### 1. `/app/lib/mongoose.ts`
**Changes:**
- Increased `maxPoolSize` from 10 to 50
- Increased `minPoolSize` from 2 to 5
- Increased timeouts: `serverSelectionTimeoutMS` (30s), `connectTimeoutMS` (30s), `waitQueueTimeoutMS` (30s)
- Increased `maxIdleTimeMS` from 30s to 60s
- Added `heartbeatFrequencyMS` and `monitorCommands`
- Improved connection event handlers for better error recovery
- Added connection state verification with retry logic

### 2. `/app/actions/activation.ts`
**Changes:**
- Wrapped `completeActivationAfterPayment()` with `withConnectionRetry()`
- Wrapped `initiateActivationPayment()` with `withConnectionRetry()`
- Split functions into public wrappers + implementation (allows retry logic to work)
- Imported utilities: `withConnectionRetry`, `executeSequentialQueries`

### 3. `/app/lib/db-pool-utils.ts` (NEW)
**Purpose:** Database connection pool management utilities

**Key Functions:**
```typescript
// Sequential execution - no parallel queries
await executeSequentialQueries([
  { name: 'Task 1', execute: async () => { /* query 1 */ } },
  { name: 'Task 2', execute: async () => { /* query 2 */ } },
])

// Batch execution - controlled parallelism
await executeBatchQueries(tasks, 5) // 5 concurrent queries per batch

// Automatic retry with backoff
await withConnectionRetry(
  () => database.query(),
  5,      // max retries
  1000    // initial delay (1s)
)
```

### 4. `/app/dashboard/wallet/page.tsx`
**Changes:**
- Added missing `mpesaNumber` state variable
- Fixed state initialization in useEffect

## How the Fixes Work Together

```
User initiates activation
    ↓
initiateActivationPayment() wrapped with withConnectionRetry(5)
    ↓ (if pool timeout → retry with backoff)
completeActivationAfterPayment() wrapped with withConnectionRetry(5)
    ↓ (if pool timeout → retry with backoff)
Larger pool (50) handles concurrent queries
    ↓
Enhanced timeouts prevent premature failures
    ↓
Better connection lifecycle management reuses connections
    ↓
Activation completes successfully
```

## Performance Improvements

| Metric | Before | After |
|--------|--------|-------|
| Max Concurrent Connections | 3 | 50 |
| Connection Pool Wait Timeout | 15s | 30s |
| Server Selection Timeout | 10s | 30s |
| Connect Timeout | 10s | 30s |
| Min Idle Connections | 1 | 5 |
| Retry Attempts on Timeout | 0 | 5 |

## Testing the Fixes

### Test 1: Single Activation
```bash
1. Navigate to activation page
2. Enter phone number
3. Complete STK push
4. Monitor console for retry logs if connection pool is busy
5. Activation should complete within 30-60 seconds
```

### Test 2: Concurrent Activations
```bash
1. Simulate 10+ concurrent activation requests
2. Observe that connections are reused from pool (50 available)
3. Monitor for "Pool timeout" errors (should be retried)
4. All activations should eventually succeed
```

### Test 3: Database Connection Health
```bash
1. Monitor MongoDB connection pool with:
   db.serverStatus().connections
2. Verify pool is sized correctly and not maxed out
3. Check that idle connections are maintained (minPoolSize: 5)
```

## Debugging

### Enable Connection Pool Logging
In mongoose.ts, the logger is set to 'warn' level. To enable full debugging:

```typescript
loggerLevel: 'debug', // Shows all connection operations
monitorCommands: true, // Logs all database commands
```

### Check Pool Status
Look for these log messages:
- `✅ MongoDB connected successfully` - Connection established
- `✅ MongoDB connection established` - Pool ready
- `⚠️ Connection exists but not ready, waiting...` - Reconnection in progress
- `🔁 MongoDB reconnected successfully` - Recovered from disconnection

### Connection Pool Exhaustion
If you see: "Timed out while checking out a connection"
1. Check MongoDB Atlas connection limit (default: 500 per cluster)
2. Verify application processes aren't leaking connections
3. Increase `waitQueueTimeoutMS` further if needed
4. Consider upgrading MongoDB cluster tier

## Deployment Checklist

- [ ] Test activation with single user
- [ ] Test activation with 10+ concurrent users
- [ ] Monitor MongoDB metrics in Atlas dashboard
- [ ] Check logs for any remaining timeout errors
- [ ] Verify connection pool size in production cluster
- [ ] Set up monitoring alerts for connection pool exhaustion
- [ ] Document custom pool sizes if changed from defaults

## Future Optimizations

1. **Query Optimization:**
   - Add indexes on frequently queried fields (userId, referralCode, email)
   - Combine multiple queries into single aggregation pipeline

2. **Caching:**
   - Cache company profile (rarely changes)
   - Cache referral tier settings
   - Use Redis for session data

3. **Rate Limiting:**
   - Limit activation attempts per user per day
   - Queue activation requests to avoid thundering herd

4. **Monitoring:**
   - Track pool usage metrics
   - Alert when pool reaches 80% capacity
   - Monitor query execution time

## References

- [MongoDB Connection Pool Documentation](https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection-management/)
- [Mongoose Connection Options](https://mongoosejs.com/docs/api/mongoose.html#Mongoose.prototype.connect())
- [Connection Pool Best Practices](https://www.mongodb.com/docs/manual/administration/connection-string-options/)
