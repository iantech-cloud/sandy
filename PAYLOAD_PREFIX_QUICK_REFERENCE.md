# Payment Payload Prefix - Quick Reference

## Payment Type → Prefix Mapping

```
┌────────────────────────────────────┬──────────┐
│ Payment Type                       │ Prefix   │
├────────────────────────────────────┼──────────┤
│ Account Activation                 │ ACT_     │
│ Main Wallet Deposit                │ CHAT_    │
│ Chat Foreigners Bot Unlock         │ CHAT_    │
│ Chat Foreigners Wallet Deposit     │ CHAT_    │
│ Spin Wallet Deposit                │ SPINDY_  │
└────────────────────────────────────┴──────────┘
```

## Code Locations

| Payment Type | File | Line(s) |
|---|---|---|
| **STK Push (All Types)** | `app/api/payments/coop-bank/stk-push/route.ts` | 56-70 |
| **Activation** | `app/actions/activation.ts` | 499 |
| **Main Wallet** | `app/actions/deposit.ts` | 284 |
| **Chat Foreigners** | `app/actions/chat-foreigners/payments.ts` | 96, 565 |
| **Spin Wallet** | `app/actions/spin.ts` | 786 |
| **Spin Wallet Alt** | `app/actions/spin-wallet.ts` | 66 |
| **Service Fallback** | `app/lib/services/coop-bank.ts` | 249 |

## Format

```
{PREFIX}_{TIMESTAMP}{RANDOM}

Example: CHAT_1721050400000ABC123
         │    │    │              │
         │    │    │              └─ Random 6-char suffix
         │    │    └─ Date.now() in milliseconds
         │    └─ Separator
         └─ Type indicator
```

## Payload Generation Logic

### Main Router (STK Push)
```typescript
let prefix = 'CHAT'; // default
if (depositType === 'activation') prefix = 'ACT';
else if (depositType === 'spin_wallet') prefix = 'SPINDY';
const messageReference = `${prefix}_${Date.now()}...`;
```

### Direct Actions
```typescript
// Activation
const messageReference = `ACT_${Date.now()}${random}`;

// Chat/Wallet
const messageReference = `CHAT_${Date.now()}${random}`;

// Spin
const messageReference = `SPINDY_${Date.now()}${random}`;
```

## Database Fields

- **MpesaTransaction.account_reference**: Uses the message reference directly
- **MpesaTransaction.checkout_request_id**: Stores the message reference
- **MpesaTransaction.metadata.message_reference**: Also stores for audit

## Querying Examples

### Find all activation payments
```javascript
db.MpesaTransactions.find({
  account_reference: { $regex: "^ACT_" }
})
```

### Find all chat deposits from today
```javascript
db.MpesaTransactions.find({
  account_reference: { $regex: "^CHAT_" },
  created_at: { $gte: new Date(Date.now() - 86400000) }
})
```

### Find all spin wallet payments
```javascript
db.MpesaTransactions.find({
  account_reference: { $regex: "^SPINDY_" }
})
```

## Callback Verification

When callback arrives:
1. Co-op Bank sends: `MessageReference: "ACT_1721050400000ABC123"`
2. Callback handler queries: `MpesaTransaction.findOne({ checkout_request_id: messageReference })`
3. Finds transaction type from prefix: `ACT_` → activation, `CHAT_` → wallet, `SPINDY_` → spin
4. Routes to appropriate handler with correct logic

## Status: ✅ All Prefixes Standardized

- ACT_ ✅ Activation payments
- CHAT_ ✅ Chat wallet (includes main wallet + chat foreigners)
- SPINDY_ ✅ Spin wallet deposits
- SANDY ❌ Removed (was ambiguous)
