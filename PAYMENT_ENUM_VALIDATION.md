# Payment Transaction Enum Validation Guide

## Issue Fixed
**Error:** `MpesaTransaction validation failed: account_reference: Path 'account_reference' is required., source: 'coop_bank' is not a valid enum value`

## Root Cause
The STK push route (`/api/payments/coop-bank/stk-push`) was creating MpesaTransaction records with:
- Missing required `account_reference` field
- Invalid `source` enum value: `'coop_bank'` (not in valid enum)

## Valid Enum Values

### MpesaTransaction.source (SourceTypes)
Valid values defined in `app/lib/models.ts` line 45:
```javascript
const SourceTypes = ['wallet', 'dashboard', 'api', 'activation', 'spin_wallet'];
```

**NOT valid:**
- ❌ `'coop_bank'` - This is a payment provider, not a source type
- ❌ `'coop_bank_api'` - Not in enum
- ❌ `'coop_callback'` - Not in enum
- ❌ `'database'` - Not in enum

**Correct mapping from depositType to source:**
| depositType | source |
|---|---|
| `'activation'` | `'activation'` |
| `'wallet'` | `'wallet'` |
| `'spin_wallet'` | `'spin_wallet'` |
| `'deposit'` | `'wallet'` |
| `'chat_wallet'` | `'wallet'` |
| other | `'wallet'` (default) |

### MpesaTransaction.provider (PaymentProviders)
Valid values defined in `app/lib/models.ts` line 10:
```javascript
const PaymentProviders = ['mpesa', 'card', 'bank', 'coop_bank', 'hashback'];
```

**Correct usage:**
- ✅ `'coop_bank'` - Valid provider (Co-op Bank M-Pesa STK Push)
- ✅ `'hashback'` - Valid provider (HashBack M-Pesa payments)
- ✅ `'mpesa'` - Valid provider (Generic M-Pesa)

### MpesaTransaction.account_reference (Required Field)
**Must be provided** when creating a transaction. Format examples:
```javascript
// For activation
`ACTIVATION-${userProfileId}`

// For STK push
`STK-${depositType.toUpperCase()}-${messageReference}`

// For deposits
`DEPOSIT-${userId}-${checkoutId}`
```

## Fixed Implementation

### Before (Broken)
```typescript
const mpesaTransaction = await MpesaTransaction.create({
  user_id: userId,
  amount_cents: Math.round(amount * 100),
  phone_number: formattedPhone,
  // ❌ Missing account_reference
  source: 'coop_bank',  // ❌ Invalid enum value
  checkout_request_id: messageReference,
  // ...
});
```

### After (Fixed)
```typescript
const sourceMap = {
  'activation': 'activation',
  'wallet': 'wallet',
  'spin_wallet': 'spin_wallet',
  'deposit': 'wallet',
};
const source = sourceMap[depositType] || 'wallet';

const mpesaTransaction = await MpesaTransaction.create({
  user_id: userId,
  amount_cents: Math.round(amount * 100),
  phone_number: formattedPhone,
  account_reference: `STK-${depositType.toUpperCase()}-${messageReference}`,  // ✅ Added
  transaction_desc: narration,
  source: source,  // ✅ Valid enum from mapping
  checkout_request_id: messageReference,
  is_activation_payment: depositType === 'activation',
  metadata: {
    deposit_type: depositType,
    message_reference: messageReference,
    payment_method: 'coop_bank_stk_push',
    revenue_target: depositType === 'spin_wallet' ? 'company' : 'user',
    initiated_at: new Date().toISOString(),
  },
});
```

## Files Modified
- `/app/api/payments/coop-bank/stk-push/route.ts` - Added source mapping and account_reference

## Testing Checklist
- [x] Build completes successfully
- [x] MpesaTransaction validates with correct enums
- [ ] Activation payment flow works end-to-end
- [ ] Spin wallet deposit works
- [ ] Chat foreigners unlock works
- [ ] Webhook callback handles all source types correctly

## Enum Reference

### Complete Enum Values

**MpesaTransactionStatuses:**
- `'initiated'`, `'pending'`, `'completed'`, `'failed'`, `'cancelled'`, `'timeout'`

**PaymentProviders:**
- `'mpesa'`, `'card'`, `'bank'`, `'coop_bank'`, `'hashback'`

**PaymentStatuses:**
- `'pending'`, `'completed'`, `'failed'`, `'refunded'`

**SourceTypes (for MpesaTransaction.source):**
- `'wallet'`, `'dashboard'`, `'api'`, `'activation'`, `'spin_wallet'`

**TransactionTypes (for ledger):**
- `'DEPOSIT'`, `'WITHDRAWAL'`, `'BONUS'`, `'TASK_PAYMENT'`, `'SPIN_WIN'`, `'REFERRAL'`, `'SURVEY'`, `'SURVEY_REVOKE'`, `'ACTIVATION_FEE'`, `'ADMIN_ACTIVATION'`, `'COMPANY_REVENUE'`, `'ACCOUNT_ACTIVATION'`, `'SPIN_COST'`, `'SPIN_PRIZE'`, `'SPIN_WALLET_DEPOSIT'`, `'ADMIN_CREDIT'`, `'ADMIN_DEBIT'`, `'UNCLAIMED_REFERRAL'`
