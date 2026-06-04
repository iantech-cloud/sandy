# Spin Wallet Crediting Flow - Fix Summary

## Issue
The spin wallet deposit flow was incorrectly marking deposits as company revenue immediately when a user deposited money. This violated the proper accounting flow where company revenue should only be recorded when a user actually completes a spin.

## Root Cause
In `/app/actions/spin.ts`, the `depositSpinWalletViaMpesa()` function was creating a Transaction record with:
```typescript
target_type: 'company',
target_id: 'company',
```

This incorrectly classified the deposit as company revenue on the deposit transaction itself.

## Solution
Changed the deposit Transaction record to properly mark it as a user deposit:
```typescript
target_type: 'user',
target_id: currentUser._id.toString(),
```

Added clarifying comments explaining that company revenue is ONLY recorded when the user actually spins.

## Corrected Flow

### 1. User Deposits via M-Pesa/Co-op Bank
- MpesaTransaction created with `deposit_type: 'spin_wallet'`
- Co-op Bank callback processes payment
- **SpinWallet.balance_cents is CREDITED** ✓ (user's spendable balance increases)
- **Transaction created with target_type: 'user'** ✓ (NOT marked as company revenue)

### 2. User Performs a Spin
- SpinWallet.balance_cents is checked for sufficient balance
- **SpinWallet.balance_cents is DEDUCTED** ✓ (amount used for the spin)
- **Transaction created with target_type: 'company' and type: 'SPIN_COST'** ✓ (company revenue recorded)
- Prize is processed if won

## Files Modified
- `/app/actions/spin.ts` - `depositSpinWalletViaMpesa()` function (lines 811-829)

## Transaction Records Flow

### Deposit Transaction
```
{
  type: 'SPIN_WALLET_DEPOSIT',
  target_type: 'user',      // NOT company
  target_id: <user_id>,      // Specific user
  amount_cents: <deposit>,
  status: 'pending' → 'completed'
}
```

### Spin Cost Transaction
```
{
  type: 'SPIN_COST',
  target_type: 'company',    // Company revenue
  target_id: 'company',
  amount_cents: <spin_cost>,
  status: 'completed'
}
```

## Backend Flow Summary
1. ✓ User deposits KES 30 → User's spin wallet balance +KES 30
2. ✓ User spins (costs KES 30) → User's spin wallet balance -KES 30
3. ✓ Company receives KES 30 credit (only on spin, not on deposit)

## UI/UX
No UI changes needed. The flow preserves all existing user-facing behavior while fixing the underlying transaction logic.
