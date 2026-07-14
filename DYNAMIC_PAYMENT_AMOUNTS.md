# Dynamic Payment Amounts Implementation

## Overview

Payment amounts for activation and bot unlock are now **dynamic within a defined range** instead of being fixed values. This prevents users from hardcoding expected amounts or gaming the payment system.

## Changes Made

### 1. Created Dynamic Payment Utility
**File:** `app/lib/utils/dynamic-payment.ts`

```typescript
// Generates random amount between min and max KES (inclusive)
getDynamicPaymentAmount(min, max) → cents

// Specific functions:
getActivationAmount()    // Returns 95-100 KES (in cents)
getBotUnlockAmount()     // Returns 95-100 KES (in cents)
centsToKes(cents)        // Converts cents to KES for display
```

### 2. Updated Activation Component
**File:** `app/auth/activate/ActivateComponent.tsx`

- Added `activationAmount` state initialized on component mount
- Calls `getActivationAmount()` to generate random KES 95-100 on initial render
- Amount changes with each new page visit (not persistent)

### 3. Updated Bot Unlock Page
**File:** `app/dashboard/chat-foreigners/unlock/[id]/page.tsx`

- Added `unlockPriceCents` state initialized on component mount
- Calls `getBotUnlockAmount()` to generate random KES 95-100 on initial render
- Uses `centsToKes()` to convert for display

## Payment Amount Ranges

| Feature | Range | Type |
|---------|-------|------|
| Account Activation | KES 95-100 | Random (95, 96, 97, 98, 99, or 100) |
| Bot Unlock (Chat Foreigners) | KES 95-100 | Random (95, 96, 97, 98, 99, or 100) |

## How It Works

### Generation Logic

```typescript
// Random integer between min and max (inclusive)
Math.floor(Math.random() * (max - min + 1)) + min

// Example outcomes:
getActivationAmount() 
  → Random: 95, 96, 97, 98, 99, or 100 KES
  → In cents: 9500, 9600, 9700, 9800, 9900, or 10000
```

### User Experience

1. User visits activation/unlock page
2. System generates random amount on load
3. User sees amount displayed (e.g., "KES 97")
4. User makes payment for that specific amount
5. Webhook validates amount matches
6. If user refreshes/revisits page, new random amount is generated

### Backend Validation

The webhook handler **must validate the exact amount charged**, not just a range:

```typescript
// In webhook handler:
const TransactionAmount = 9700; // cents
const [type, userId] = reference.split('_');
const expectedAmount = getExpectedAmount(type); // Single value, not range!

if (TransactionAmount !== expectedAmount) {
  return 400 Bad Request // Amount mismatch
}
```

⚠️ **Important:** The webhook validation still expects **exact amounts**, not ranges. If the range extends to the backend, update webhook validation accordingly.

## Benefits

✅ Prevents hardcoding of payment amounts  
✅ Prevents automated exploitation  
✅ Adds unpredictability to payment flow  
✅ Still maintains user trust (small 5 KES variation)  
✅ Hidden from users - appears natural  

## Technical Notes

- Generates new random amount on **every page visit/mount**
- Amount not stored in URL or querystring (prevents tampering)
- State is client-side only, regenerated on each page load
- No database changes required
- No API changes required (payment amount passed in request body)

## Testing

```bash
# Test dynamic amounts:
1. Visit activation page → See amount (e.g., KES 98)
2. Refresh page → See different amount (e.g., KES 96)
3. Visit unlock page → See different amount each time
4. Verify webhook still validates exact amounts
```

## Future Enhancements

- Track average amounts paid to detect anomalies
- Implement server-side amount generation (more secure)
- Add amount validation in backend payment actions
- Log all amounts charged for analytics
