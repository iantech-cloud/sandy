# Admin System: Environment Variables & Accounting Guide

## Environment Variables

### Required Variables for Admin APIs

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db` | ✅ Yes |
| `NEXTAUTH_SECRET` | Session encryption key | Generate with: `openssl rand -base64 32` | ✅ Yes |
| `NODE_ENV` | Environment (development/production) | `production` | ✅ Yes |
| `ADMIN_IP` | IP address for admin action logging | Optional - defaults to 127.0.0.1 | ❌ No |

### Usage in .env.local or .env.example

```bash
# Authentication & Session
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=https://hustlehubafrica.com

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/hustlehubafrica

# Application
NODE_ENV=production
ADMIN_IP=192.168.1.1  # Optional
```

### Validation in Code

The middleware automatically validates required environment variables:

```typescript
export function validateAdminEnv() {
  const required = ['MONGODB_URI', 'NEXTAUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`[Admin] Missing environment variables: ${missing.join(', ')}`);
    return false;
  }
  return true;
}
```

## Bookkeeping & Accounting System

### Core Principles

1. **Atomicity**: All balance operations use MongoDB atomic operators
2. **Auditability**: Every transaction is logged with full context
3. **Correctness**: Aggregation pipelines ensure accurate calculations
4. **Immutability**: Transaction records cannot be modified after creation

### Transaction Types

| Type | Description | Example Amount | Source |
|------|-------------|-----------------|--------|
| `DEPOSIT` | User funds added | 1000 KES | Manual admin or payment gateway |
| `WITHDRAWAL` | User withdrawal request approved | -1000 KES | Withdrawal approval |
| `BONUS` | System bonus awarded | 500 KES | Spin wheel, referral, survey |
| `TASK_PAYMENT` | Payment for completed task | 200 KES | Task completion |
| `SPIN_WIN` | Prize from spin wheel | Variable | Spin wheel win |
| `REFERRAL` | Referral commission | 100 KES | New referral signup |
| `SURVEY` | Survey payment | 300 KES | Survey completion |
| `SURVEY_REVOKE` | Survey payment reversed | -300 KES | Survey rejection/dispute |
| `ACTIVATION_FEE` | Account activation fee | -50 KES | User account activation |
| `ADMIN_CREDIT` | Admin credit/correction | Variable | Manual admin action |
| `ADMIN_DEBIT` | Admin debit/correction | Variable | Manual admin action |

### Creating Transaction Records

#### Method 1: Using Helper Function

```typescript
import { createTransactionRecord } from '@/app/lib/admin-middleware';

const result = await createTransactionRecord(
  userId,           // MongoDB ObjectId of user
  'REFERRAL',       // Transaction type
  1000,             // Amount in KES (positive = credit, handled in UI)
  'Referral bonus from user XYZ signup',  // Description
  {                 // Optional metadata
    referrer_id: 'user123',
    referred_user_id: 'user456'
  }
);

// Returns: { success: true, transaction }
if (result.success) {
  console.log('Transaction created:', result.transaction._id);
}
```

#### Method 2: Direct API Call

```typescript
// POST /api/admin/transactions
const response = await fetch('/api/admin/transactions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: userId,
    type: 'BONUS',
    amount: 500,
    description: 'Spin wheel win - Prize: KES 500',
    metadata: {
      spin_id: 'spin123',
      spin_prize_index: 2
    }
  })
});

const { success, data } = await response.json();
```

### Updating User Balance

#### Method 1: Using Helper Function

```typescript
import { updateUserBalance } from '@/app/lib/admin-middleware';

// Add balance
const addResult = await updateUserBalance(userId, 1000, 'add');
// Returns: { success: true, user: { id, balance } }

// Subtract balance
const subResult = await updateUserBalance(userId, 500, 'subtract');
// Returns: { success: true, user: { id, balance } }
```

#### Method 2: Direct Atomic Update

The middleware uses MongoDB's `$inc` operator for atomic operations:

```typescript
await Profile.findByIdAndUpdate(
  userId,
  { 
    $inc: { account_balance: 1000 },  // Atomic increment
    updated_at: new Date()
  },
  { new: true }
);
```

### Getting Financial Summaries

#### User Financial Summary

```typescript
import { getUserFinancialSummary } from '@/app/lib/admin-middleware';

const summary = await getUserFinancialSummary(userId);

// Returns:
{
  userId: 'user123',
  currentBalance: 5000,
  totalTransactions: 25,
  byType: {
    REFERRAL: { total: 1000, count: 2 },
    BONUS: { total: 2000, count: 4 },
    TASK_PAYMENT: { total: 1500, count: 6 },
    WITHDRAWAL: { total: -500, count: 1 }
  }
}
```

#### Platform Financial Stats

```typescript
import { getPlatformFinancialStats } from '@/app/lib/admin-middleware';

const stats = await getPlatformFinancialStats();

// Returns:
{
  transactions: {
    totalTransactions: 15000,
    totalVolume: 2500000,        // Total KES moved
    avgTransaction: 166.67,       // Average per transaction
    minTransaction: 10,           // Smallest transaction
    maxTransaction: 50000         // Largest transaction
  },
  users: {
    totalUsers: 1500,
    activeUsers: 1200,
    totalBalance: 1250000,        // Total KES in user accounts
    avgBalance: 833.33            // Average balance per user
  }
}
```

### Audit Logging

Every financial operation is automatically logged:

```typescript
await logAdminAction(
  adminId,                    // Admin making the change
  'John Admin',               // Admin name
  'BALANCE_ADJUSTMENT',       // Action type
  'user',                     // Resource type
  userId,                     // Resource ID
  {                           // Changes
    amount: 1000,
    reason: 'Spin wheel correction',
    previous_balance: 4000,
    new_balance: 5000
  },
  'success'                   // Status
);
```

The audit log includes:
- Admin ID and name
- Action performed
- Resource affected
- All changes made
- IP address of request
- Exact timestamp
- Success/failure status

### Accounting Best Practices

#### 1. Always Use Atomic Operations

✅ CORRECT:
```typescript
await Profile.findByIdAndUpdate(userId, {
  $inc: { account_balance: 1000 }  // Atomic
});
```

❌ INCORRECT:
```typescript
const user = await Profile.findById(userId);
user.account_balance += 1000;
await user.save();  // Race condition risk!
```

#### 2. Create Transaction Records for All Changes

```typescript
// 1. Update balance atomically
await updateUserBalance(userId, 1000, 'add');

// 2. Create transaction record
await createTransactionRecord(
  userId,
  'REFERRAL',
  1000,
  'Referral bonus'
);

// 3. Audit log (automatic in API handlers)
await logAdminAction(adminId, name, 'REFERRAL_BONUS', 'user', userId, {...});
```

#### 3. Validate Before Operations

```typescript
// Always validate amount
if (amount <= 0 || !Number.isFinite(amount)) {
  throw new Error('Invalid amount');
}

// Always validate user exists
const user = await Profile.findById(userId);
if (!user) {
  throw new Error('User not found');
}

// Always validate sufficient balance for debits
if (user.account_balance < amount && operation === 'subtract') {
  throw new Error('Insufficient balance');
}
```

#### 4. Use Transactions for Multi-Step Operations

For operations affecting multiple users or records:

```typescript
const session = await mongoose.startSession();
session.startTransaction();

try {
  // All operations within transaction
  await updateUserBalance(senderId, -1000, 'subtract');
  await updateUserBalance(receiverId, 1000, 'add');
  await createTransactionRecord(senderId, 'TRANSFER_SENT', -1000, 'P2P transfer');
  await createTransactionRecord(receiverId, 'TRANSFER_RECEIVED', 1000, 'P2P transfer');
  
  await session.commitTransaction();
} catch (error) {
  await session.abortTransaction();
  throw error;
} finally {
  await session.endSession();
}
```

#### 5. Reconciliation Queries

Regular reconciliation to catch discrepancies:

```typescript
// Sum all transactions should match total debits/credits
const transactionSum = await Transaction.aggregate([
  { $group: { _id: null, total: { $sum: '$amount' } } }
]);

// User balances should match transaction totals
const userBalances = await Profile.aggregate([
  { $group: { _id: null, total: { $sum: '$account_balance' } } }
]);

console.log('Transaction sum:', transactionSum[0].total);
console.log('User balances:', userBalances[0].total);
```

### Rate Limiting Configuration

Admin APIs use rate limiting to prevent abuse:

```typescript
// Default admin limits in rate-limit.ts
{
  admin: { limit: 200, windowMs: 60_000 }  // 200 requests per 60 seconds
}
```

### Error Handling

All financial operations include proper error handling:

```typescript
try {
  const result = await updateUserBalance(userId, amount, 'add');
  
  if (!result.success) {
    console.error('Balance update failed:', result.error);
    return { error: result.error, status: 400 };
  }
  
  return { success: true, user: result.user };
} catch (error) {
  console.error('Unexpected error:', error);
  return { error: 'Internal server error', status: 500 };
}
```

## Compliance & Regulations

### Audit Trail Requirements

✅ All admin actions include:
- Who performed the action
- What was changed
- When it happened
- Why (description/reason)
- IP address for accountability
- Success/failure indicator

### Data Validation

✅ All amounts validated as:
- Positive numbers for credits
- Proper currency (KES)
- Within reasonable limits
- By authorized personnel only

### Segregation of Duties

✅ Different role requirements:
- Regular admins: Can view and manage users
- Super admins: Can approve accounts, change user roles
- System: Can create automatic transactions

## Testing Accounting Operations

```typescript
// Test creating and retrieving transaction
const userId = new ObjectId();
const result = await createTransactionRecord(
  userId.toString(),
  'TEST',
  100,
  'Test transaction'
);

// Verify transaction was created
const transaction = await Transaction.findById(result.transaction._id);
expect(transaction.amount).toBe(100);

// Verify balance was updated
const user = await Profile.findById(userId);
expect(user.account_balance).toBeGreaterThanOrEqual(0);

// Verify audit log
const audit = await AuditLog.findOne({ resource_id: userId.toString() });
expect(audit.action).toBe('TRANSACTION_CREATE');
```

## Monitoring & Alerts

Implement monitoring for:
- Unusual transaction volumes
- Large single transactions
- Failed operations
- Rate limit threshold exceeded (>150/minute)
- Admin actions from unusual IPs
- Balance reconciliation discrepancies

