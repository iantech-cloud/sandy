# Temporary Payment Block - All Co-op Bank Payments Disabled

**Status:** ACTIVE - All payments blocked  
**Date:** 2026-07-13  
**Reason:** Co-op Bank payment temporarily disabled for maintenance

---

## What's Blocked

All user-initiated payments are currently blocked:

- ✗ Account Activation (KES 95)
- ✗ Bot Unlock / Chat Foreigners (KES 100)
- ✗ Wallet Deposits (any amount)
- ✗ Chat Foreigners Wallet Deposits (any amount)

---

## Error Message Shown to Users

**Title:** `DEBIT ACCOUNT AUTHORIZATION FAILURE`

**Message:** `Payment processing is temporarily unavailable. Please try again later.`

---

## Implementation Details

### Frontend (UI Layer)

**File:** `app/components/CoopBankPaymentButton.tsx`

```tsx
// Payment button now shows error immediately
// Error displayed in red alert box with AlertCircle icon
// Button disabled (greyed out)
```

### Backend (Action Layer)

Payment functions blocked in:

1. **Activation**
   - File: `app/actions/activation.ts`
   - Function: `initiateActivationPayment()`
   - Returns: `{ success: false, message: 'DEBIT ACCOUNT AUTHORIZATION FAILURE' }`

2. **Deposit**
   - File: `app/actions/deposit.ts`
   - Function: `processMpesaDeposit()`
   - Returns: `{ success: false, message: 'DEBIT ACCOUNT AUTHORIZATION FAILURE' }`

3. **Chat Foreigners Bot Unlock**
   - File: `app/actions/chat-foreigners/payments.ts`
   - Function: `initiateBotUnlockViaMpesa()`
   - Returns: `{ success: false, error: 'DEBIT ACCOUNT AUTHORIZATION FAILURE' }`

4. **Chat Foreigners Wallet Deposit**
   - File: `app/actions/chat-foreigners/payments.ts`
   - Function: `initiateWalletDepositViaMpesa()`
   - Returns: `{ success: false, error: 'DEBIT ACCOUNT AUTHORIZATION FAILURE' }`

---

## How Users Experience It

### Activation Page
```
User clicks "Pay KES 95"
↓
RED ALERT appears: "DEBIT ACCOUNT AUTHORIZATION FAILURE"
↓
Button disabled
↓
No payment initiated
```

### Bot Unlock Page
```
User clicks "Unlock Chat Foreigners"
↓
RED ALERT appears: "DEBIT ACCOUNT AUTHORIZATION FAILURE"
↓
Button disabled
↓
No payment initiated
```

### Wallet Deposit Pages
```
User clicks "Deposit"
↓
RED ALERT appears: "DEBIT ACCOUNT AUTHORIZATION FAILURE"
↓
Button disabled
↓
No payment initiated
```

---

## Reverting This Block

To restore payments, simply:

1. **In `app/actions/activation.ts`:**
   - Remove the new `initiateActivationPayment()` blocking function (lines 423-442)
   - Rename `initiateActivationPayment_OLD()` back to `initiateActivationPayment()`

2. **In `app/actions/deposit.ts`:**
   - Remove the new `processMpesaDeposit()` blocking function (lines 255-277)
   - Rename `processMpesaDeposit_OLD()` back to `processMpesaDeposit()`

3. **In `app/actions/chat-foreigners/payments.ts`:**
   - Remove the new `initiateBotUnlockViaMpesa()` blocking function
   - Rename `initiateBotUnlockViaMpesa_OLD()` back to `initiateBotUnlockViaMpesa()`
   - Remove the new `initiateWalletDepositViaMpesa()` blocking function
   - Rename `initiateWalletDepositViaMpesa_OLD()` back to `initiateWalletDepositViaMpesa()`

4. **In `app/components/CoopBankPaymentButton.tsx`:**
   - Restore original payment logic (currently returns error immediately)

---

## Key Points

- All blocking is **consistent** across all payment surfaces
- Error message is **identical** everywhere: `DEBIT ACCOUNT AUTHORIZATION FAILURE`
- UI clearly communicates the issue with **red alert + icon**
- Backend blocks **all payment attempts** before any processing
- Original payment code is **preserved** with `_OLD` suffix for easy restoration
- No database records are created during blocked payments
- No webhooks are triggered
- No external API calls are made

---

## Status Monitoring

Users will see the error on:
- Activation page
- Bot unlock pages
- Wallet deposit pages
- Chat foreigners wallet pages
- Any payment form in the application

All users experience consistent, clear messaging about the temporary unavailability.

---

## Testing Checklist

- [ ] Click "Activate Account" - shows error
- [ ] Click "Unlock Bot" - shows error
- [ ] Click "Deposit" on main wallet - shows error
- [ ] Click "Deposit" on chat foreigners wallet - shows error
- [ ] Error message is consistent everywhere
- [ ] Button is disabled (not clickable)
- [ ] Red alert box displays properly on all screen sizes
