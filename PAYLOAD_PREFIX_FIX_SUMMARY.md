# Payload Prefix Standardization - Complete Fix

## Issue Summary
All payment transaction payloads were incorrectly starting with `SANDY` prefix regardless of payment type. This has been fully rectified to use type-specific prefixes for proper transaction categorization and tracking.

## Fixed Prefixes

| Payment Type | Old Prefix | New Prefix | Example |
|--------------|-----------|-----------|---------|
| Activation | `SANDY` | `ACT_` | `ACT_1721050400000ABC123` |
| Chat Wallet | `SANDY` / `CHATF` | `CHAT_` | `CHAT_1721050400000ABC123` |
| Chat Foreigners Unlock | `CHATF` | `CHAT_` | `CHAT_1721050400000ABC123` |
| Spin Wallet | `SPIN` / `SPINDY` | `SPINDY_` | `SPINDY_1721050400000ABC123` |

## Files Modified

### 1. **app/api/payments/coop-bank/stk-push/route.ts** (MAIN ROUTER)
- **Change**: Added prefix logic based on `depositType` parameter
- **Logic**:
  ```typescript
  if (depositType === 'activation') prefix = 'ACT';
  else if (depositType === 'wallet') prefix = 'CHAT';
  else if (depositType === 'spin_wallet') prefix = 'SPINDY';
  else prefix = 'CHAT'; // default
  
  const messageReference = `${prefix}_${Date.now()}${random}`;
  ```
- **Impact**: All API-routed payments now use correct prefixes
- **Backwards Compatible**: Yes (only affects new payments)

### 2. **app/actions/deposit.ts** (DIRECT WALLET DEPOSITS)
- **Change**: Changed from `SANDY` to `CHAT_` prefix
- **Line**: 284
- **Impact**: Direct wallet deposits now properly tagged as CHAT

### 3. **app/actions/activation.ts** (ACCOUNT ACTIVATION)
- **Change**: Added underscore to `ACT` prefix (was `ACT`, now `ACT_`)
- **Line**: 499
- **Impact**: Activation payments consistently prefixed with `ACT_`

### 4. **app/actions/chat-foreigners/payments.ts** (CHAT UNLOCK & DEPOSITS)
- **Changes**: 
  - Bot unlock: `CHATF` → `CHAT_` (Line 96)
  - Wallet deposit: `CHATDEP` → `CHAT_` (Line 565)
- **Impact**: All chat foreigners payments use `CHAT_` prefix

### 5. **app/actions/spin.ts** (SPIN WALLET DEPOSITS)
- **Change**: `SPINDY` → `SPINDY_` (added underscore)
- **Line**: 786
- **Impact**: Spin deposits consistently use `SPINDY_` prefix

### 6. **app/actions/spin-wallet.ts** (ALTERNATIVE SPIN ROUTER)
- **Change**: `SPIN` → `SPINDY_`
- **Line**: 66
- **Impact**: All spin wallet paths use `SPINDY_` prefix

### 7. **app/lib/services/coop-bank.ts** (SERVICE FALLBACK)
- **Change**: Fallback generator changed from `SANDY` to `CHAT_`
- **Line**: 249
- **Context**: Only used if messageReference not passed (rare)
- **Impact**: Service-level fallback now uses proper prefix

## Documentation Updated

### COOP_BANK_PAYMENT_FULL_INTEGRATION.md
- Updated "Idempotency Guarantee" section with new prefix format
- Updated "Database Records Created" section to show prefix usage
- Added `✅ FIXED:` markers to indicate what was corrected

## Payload Format Examples

### Before (❌ Wrong)
```
SANDY1721050400000ABC123  ← Ambiguous, could be activation, chat, or spin
SANDY1721050400000DEF456  ← Same prefix, different payment types
SANDY1721050400000GHI789  ← No way to distinguish transaction type
```

### After (✅ Correct)
```
ACT_1721050400000ABC123    ← Clearly activation payment
CHAT_1721050400000DEF456   ← Clearly chat wallet deposit
SPINDY_1721050400000GHI789 ← Clearly spin wallet deposit
```

## Testing Checklist

- [x] Activation payments now generate `ACT_` prefix
- [x] Wallet deposits now generate `CHAT_` prefix
- [x] Chat foreigners payments now generate `CHAT_` prefix
- [x] Spin wallet deposits now generate `SPINDY_` prefix
- [x] STK push route correctly routes based on depositType
- [x] Fallback prefix in service uses `CHAT_`
- [x] No `SANDY` payment prefixes remain in codebase
- [x] Documentation updated with new format
- [x] All modified files compile without new errors

## Transaction Tracking Benefits

With proper prefixes, transactions can now be:

1. **Categorized at a glance**: `ACT_` = activation, `CHAT_` = chat, `SPINDY_` = spin
2. **Queried efficiently**: Filter by prefix to find transaction type
3. **Audited properly**: Admin dashboards can display correct transaction categories
4. **Debugged faster**: Support team immediately knows payment type from reference number
5. **Reported accurately**: Finance reports use correct transaction categorization

## Callback Processing

The callback handler (`/api/payments/coop-bank/callback`) now receives transactions with:
- **Proper prefix**: Identifies payment type immediately
- **Consistent format**: All timestamps and random components uniform
- **Unique IDs**: No collisions between payment types
- **Audit trail**: Clear prefix → type → handling logic

## Deployment Notes

- ✅ **No database migration needed**: Only affects new payment references
- ✅ **Backwards compatible**: Existing completed transactions unaffected
- ✅ **No API changes**: External integrations unaffected
- ✅ **Immediate effect**: All new payments use correct prefixes
- ✅ **Zero downtime**: Can deploy anytime

## Verification Commands

To verify the fix in production:

```bash
# Find all activation payments created after fix deployment
db.MpesaTransactions.find({
  account_reference: /^ACT_/,
  created_at: { $gte: new Date('2024-07-14') }
})

# Find all chat wallet deposits
db.MpesaTransactions.find({
  account_reference: /^CHAT_/,
  source: 'wallet'
})

# Find all spin wallet deposits
db.MpesaTransactions.find({
  account_reference: /^SPINDY_/,
  source: 'spin_wallet'
})
```

## Status: ✅ COMPLETE

All payment transaction payloads now use correct, type-specific prefixes. The system can properly categorize and track transactions by type while maintaining backwards compatibility with existing records.
