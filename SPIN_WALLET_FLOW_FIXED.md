# Spin Wallet Crediting Flow - Fixed

## Problem Statement
The spin wallet was incorrectly crediting the company wallet immediately upon user deposit, instead of:
1. Crediting the user's spin wallet balance when they deposit
2. Only crediting the company wallet when the user completes a spin

## Solution Summary
Fixed the backend transaction logic to ensure proper order of credits:
- **User Deposit** → User's spin wallet balance increases
- **User Spin** → Company wallet is credited for the spin cost

## Changes Made

### 1. Backend: Transaction Record Type (app/actions/spin.ts)
**File:** `/app/actions/spin.ts` (lines 821-822)

**Before:**
```typescript
target_type: 'company',
target_id: 'company',
```

**After:**
```typescript
target_type: 'user',
target_id: currentUser._id.toString(),
```

**Impact:** Deposit transactions are now correctly marked as user transactions, not company revenue.

---

### 2. Backend: Callback Handler (app/api/payments/coop-bank/callback/route.ts)
**File:** `/app/api/payments/coop-bank/callback/route.ts` (lines 178-203)

**Added:** Transaction record status updates when deposits complete/fail

```typescript
// On successful deposit:
await (Transaction as any).findOneAndUpdate(
  {
    mpesa_transaction_id: mpesaTransaction._id,
    type: 'SPIN_WALLET_DEPOSIT',
  },
  { status: 'completed' },
  { session }
);

// On failed deposit:
await (Transaction as any).findOneAndUpdate(
  {
    mpesa_transaction_id: mpesaTransaction._id,
    type: 'SPIN_WALLET_DEPOSIT',
  },
  { status: paymentStatus },
  { session }
);
```

**Impact:** Deposit transactions are now properly marked as completed/failed in the database.

---

## Complete Flow (Corrected)

### Deposit Flow (User deposits via M-Pesa)
1. User initiates deposit: `depositSpinWalletViaMpesa()`
2. M-Pesa prompt sent to user's phone
3. User enters M-Pesa PIN
4. Co-op Bank callback is received:
   - `MpesaTransaction` status updated
   - `SpinWallet.balance_cents` is **credited** (+KES X)
   - `SpinWallet.total_deposited_cents` incremented
   - `Transaction` record marked as 'completed' with `target_type: 'user'`
5. Frontend fetches updated balance via `/api/spin-wallet/balance`
6. UI displays new balance to user

**Key Point:** Money goes to USER's spin wallet, NOT company.

---

### Spin Flow (User spins the wheel)
1. User clicks "Spin" button
2. System checks `spinWallet.balance_cents >= spinCost`
3. If sufficient balance:
   - `SpinWallet.balance_cents` is **deducted** (-KES Y)
   - `SpinWallet.total_used_cents` incremented
   - Prize is selected based on probability
   - **Company revenue `Transaction` created** with `target_type: 'company'`
4. Frontend displays result
5. Balance is refreshed

**Key Point:** Company ONLY gets credited when user spins, not when user deposits.

---

## Database Schema

### SpinWallet Document
```
{
  user_id: ObjectId,
  balance_cents: number,              // Actual spendable balance
  total_deposited_cents: number,       // Cumulative deposits
  total_used_cents: number,            // Cumulative spins
  total_spins: number,                 // Spin count
  deposits: [
    {
      amount_cents: number,
      mpesa_receipt_number: string,
      status: 'completed' | 'failed',
      deposited_at: Date,
    }
  ]
}
```

### Transaction Records

**Deposit Transaction (on user deposit):**
```
{
  user_id: ObjectId,
  type: 'SPIN_WALLET_DEPOSIT',
  amount_cents: number,
  status: 'completed' | 'failed',
  target_type: 'user',                 // ← User, NOT company
  target_id: userId,
  mpesa_transaction_id: ObjectId,
}
```

**Spin Cost Transaction (on spin completion):**
```
{
  user_id: ObjectId,
  type: 'SPIN_COST',
  amount_cents: number,
  status: 'completed',
  target_type: 'company',              // ← Company only gets credited on spin
  target_id: 'company',
  source: 'spin_wallet',
}
```

---

## Frontend Display

### Spin Wheel Component
**File:** `/app/ui/dashboard/spin-wheel.tsx`

- Fetches balance from `/api/spin-wallet/balance` endpoint
- Displays `balance_cents` as user's spendable balance
- On deposit success, calls `loadAll()` to refresh balance
- Shows "You have X spins remaining" based on balance ÷ spin cost

No changes needed to frontend - it already displays correctly.

---

## Testing Checklist

- [x] User can deposit via M-Pesa without company receiving credit
- [x] SpinWallet.balance_cents increases on successful deposit
- [x] Frontend shows updated balance after deposit
- [x] User can spin only if balance >= spin cost
- [x] SpinWallet.balance_cents decreases after spin
- [x] Company revenue recorded only on spin completion
- [x] Transaction records have correct target_type (user vs company)
- [x] Failed deposits properly marked in both SpinWallet and Transaction

---

## Notes

- The fix ensures accounting accuracy by separating user deposits from company revenue
- All transaction history is preserved for auditing
- Both pending deposits and completed deposits are tracked
- The callback handler is idempotent - duplicate callbacks are ignored
