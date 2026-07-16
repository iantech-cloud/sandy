# Gaming Wallet Deposit Flow - Before & After

## BEFORE (Broken) ❌

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Initiates Deposit                        │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  GamingDepositModal.tsx   │
        │  - User enters amount     │
        │  - Enters phone number    │
        └───────────┬───────────────┘
                    │ onClick="handleDeposit"
                    ▼
        ┌─────────────────────────────────────────────┐
        │  POST /api/payments/coop-bank/stk-push      │
        │  Body: { amount, phone, depositType:'gaming'}
        └───────────┬─────────────────────────────────┘
                    │ ← messageReference
                    ▼
    ┌───────────────────────────────────────────┐
    │ Redirect to mpesa-waiting?messageReference=...
    └────┬──────────────────────────────────────┘
         │
         ├─ User enters M-Pesa PIN on phone
         │
         ▼
    ┌──────────────────────────────────────┐
    │ Co-op Bank calls /api/payments/      │
    │   coop-bank/callback [WORKING ✅]    │
    └────┬─────────────────────────────────┘
         │
         ├─ MpesaTransaction marked 'completed'
         │
         ├─ GamingWallet.balance_cents += amount [IN DB ✅]
         │
         ├─ Cache NOT invalidated ❌
         │
         ▼
    ┌──────────────────────────────────────┐
    │ waiting page shows "Success!"         │
    │ User clicks "Start Playing"           │
    └────┬─────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Dashboard /dashboard/gaming            │
    │                                        │
    │ ┌──────────────────────────────────┐  │
    │ │ GamingWallet component           │  │
    │ │ ❌ setBalance(0)  [HARDCODED]    │  │
    │ │ Shows: KES 0                     │  │
    │ └──────────────────────────────────┘  │
    │                                        │
    │ Click game (e.g., Crash):             │
    │ ┌──────────────────────────────────┐  │
    │ │ Game page (crash/dice/etc)       │  │
    │ │ fetch('/api/gaming/wallet')      │  │
    │ │ ❌ 404 NOT FOUND - route missing │  │
    │ │ Falls back: setBalance(0)        │  │
    │ │ Shows: KES 0                     │  │
    │ └──────────────────────────────────┘  │
    │                                        │
    └────────────────────────────────────────┘

USER SEES: KES 0 (even though KES 1000 is in database)
RESULT: Looks like deposit failed ❌
```

---

## AFTER (Fixed) ✅

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Initiates Deposit                        │
└───────────────────┬─────────────────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────────┐
        │  GamingDepositModal.tsx   │
        │  - User enters amount     │
        │  - Enters phone number    │
        └───────────┬───────────────┘
                    │ onClick="handleDeposit"
                    ▼
        ┌─────────────────────────────────────────────┐
        │  POST /api/payments/coop-bank/stk-push      │
        │  Body: { amount, phone, depositType:'gaming'}
        └───────────┬─────────────────────────────────┘
                    │ ← messageReference
                    ▼
    ┌───────────────────────────────────────────┐
    │ Redirect to mpesa-waiting?messageReference=...
    └────┬──────────────────────────────────────┘
         │
         ├─ User enters M-Pesa PIN on phone
         │
         ▼
    ┌──────────────────────────────────────┐
    │ Co-op Bank calls /api/payments/      │
    │   coop-bank/callback [WORKING ✅]    │
    └────┬─────────────────────────────────┘
         │
         ├─ MpesaTransaction marked 'completed'
         │
         ├─ GamingWallet.balance_cents += amount [IN DB ✅]
         │
         ├─ invalidateCache('wallet') [NEW FIX ✅]
         │
         ▼
    ┌──────────────────────────────────────┐
    │ waiting page shows "Success!"         │
    │ User clicks "Start Playing"           │
    │ onSuccess() triggers wallet refresh   │ [NEW FIX ✅]
    └────┬─────────────────────────────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │ Dashboard /dashboard/gaming            │
    │                                        │
    │ ┌──────────────────────────────────┐  │
    │ │ GamingWallet component [FIXED]   │  │
    │ │ fetch('/api/gaming/wallet') ✅   │  │
    │ │ Shows: KES 1000 [REAL DATA]      │  │
    │ └──────────────────────────────────┘  │
    │                                        │
    │ Click game (e.g., Crash):             │
    │ ┌──────────────────────────────────┐  │
    │ │ Game page (crash/dice/etc)       │  │
    │ │ fetch('/api/gaming/wallet')      │  │
    │ │ ✅ GET /api/gaming/wallet [NEW]  │  │
    │ │ Returns: { balance_cents: 100000}│  │
    │ │ Shows: KES 1000 [REAL DATA] ✅   │  │
    │ └──────────────────────────────────┘  │
    │                                        │
    └────────────────────────────────────────┘

USER SEES: KES 1000 everywhere ✅
RESULT: Deposit confirmed and playable ✅
```

---

## Key Improvements

### Before Problems (❌)
| Component | Problem | Result |
|-----------|---------|--------|
| GamingWallet.tsx | Hardcoded `setBalance(0)` | Always shows KES 0 |
| Game pages | Call non-existent `/api/gaming/wallet` | 404 → falls back to KES 0 |
| Callback handler | No cache invalidation | Stale balance for 2 minutes |

### After Solutions (✅)
| Component | Solution | Result |
|-----------|----------|--------|
| GamingWallet.tsx | Fetch real data from new endpoint | Displays actual balance |
| Game pages | New `/api/gaming/wallet` endpoint exists | Gets real balance immediately |
| Callback handler | Call `invalidateCache('wallet')` after credit | Fresh data on next read |

---

## Request/Response Flows

### Fix #1: New `/api/gaming/wallet` Endpoint

**Request:**
```http
GET /api/gaming/wallet
Authorization: Bearer <session_token>
```

**Response:**
```json
{
  "success": true,
  "balance_cents": 100000,
  "total_deposited_cents": 100000,
  "total_wagered_cents": 0,
  "total_lost_cents": 0,
  "updated_at": "2026-07-16T10:30:00.000Z"
}
```

### Fix #2: GamingWallet Component Flow

```typescript
// OLD (Broken)
const fetchGamingWallet = async () => {
  setBalance(0);        // ❌ Hardcoded
  setTransactions([]);
};

// NEW (Fixed)
const fetchGamingWallet = async () => {
  const response = await fetch('/api/gaming/wallet');
  const data = await response.json();
  setBalance(data.balance_cents || 0);  // ✅ Real data
};
```

### Fix #3: Cache Invalidation in Callback

```typescript
// In POST /api/payments/coop-bank/callback
if (depositType === 'gaming' && paymentStatus === 'completed') {
  // Credit the wallet
  await GamingWallet.findOneAndUpdate(
    { user_id: mpesaTransaction.user_id },
    { $inc: { balance_cents: mpesaTransaction.amount_cents } }
  );
  
  // ← NEW: Invalidate cache immediately
  invalidateCache('wallet');
  
  console.log('Gaming wallet credited...');
}
```

---

## Data Flow Timeline

```
Time  Event                              Balance in DB    Balance in Cache
────  ─────────────────────────────────  ────────────────  ────────────────
T=0   User initiates deposit             KES 0             KES 0
T=5   STK Push sent to phone             KES 0             KES 0
T=10  User enters M-Pesa PIN             KES 0             KES 0
T=15  Co-op Bank sends callback          KES 0 → 1000      (stale: KES 0)
T=15+ invalidateCache('wallet') called   KES 1000          [CLEARED]
T=16  Dashboard fetches /api/wallet      KES 1000          KES 1000 (fresh)
T=17  User sees: "KES 1000" ✅           KES 1000          KES 1000
T=20  Game fetches /api/wallet           KES 1000          KES 1000
T=21  User plays with correct balance ✅ KES 1000          KES 1000
```

**BEFORE FIX (T=15+):**
- Cache NOT cleared, still had old value
- Dashboard shows "KES 0" (from hardcoded fallback)
- User confused: "Where's my money?"

**AFTER FIX (T=15+):**
- Cache cleared immediately after credit
- Dashboard fetches fresh balance: "KES 1000" ✅
- User sees deposit reflected instantly

---

## Transaction Lifecycle (Detailed)

```
Phase 1: Deposit Initiation
  └─ GamingDepositModal collects amount + phone
  
Phase 2: Payment Request
  └─ POST /api/payments/coop-bank/stk-push
     └─ Creates MpesaTransaction with source='gaming'
     └─ Co-op Bank sends STK Push
     └─ Returns messageReference
  
Phase 3: User Action
  └─ User confirms on phone with M-Pesa PIN
  └─ Co-op Bank processes payment
  
Phase 4: Webhook Callback [THIS IS WHERE THE FIX HAPPENS]
  └─ Co-op Bank POST /api/payments/coop-bank/callback
  └─ Validate payment succeeded
  
  ✅ FIX #3 HERE:
  └─ depositType === 'gaming' && paymentStatus === 'completed'
     ├─ GamingWallet.findOneAndUpdate(..., $inc balance)
     └─ ✅ invalidateCache('wallet')  [NEW]
  
Phase 5: User Returns to Gaming
  └─ Router.push('/dashboard/gaming')
  
  ✅ FIX #2 HERE:
  └─ GamingWallet component mounts
     ├─ useEffect calls fetchGamingWallet()
     └─ ✅ fetch('/api/gaming/wallet')  [NEW ENDPOINT - FIX #1]
        └─ ✅ setBalance(data.balance_cents)  [FIXED FROM 0]
  
Phase 6: User Plays Game
  └─ Router.push('/dashboard/gaming/crash')
  
  ✅ FIX #1 USED AGAIN:
  └─ Game component mounts
     ├─ useEffect calls fetchBalance()
     └─ ✅ fetch('/api/gaming/wallet')  [NOW WORKS]
        └─ setBalance(data.balance_cents)
```

---

## Cache Invalidation Pattern

All balance-mutating operations now follow this pattern:

```typescript
// Example: User plays Crash game (loses money)
async function playCrash(betAmount) {
  // Debit the balance
  await GamingWallet.updateOne(
    { user_id },
    { $inc: { balance_cents: -betAmount } }
  );
  
  // ✅ Clear cache so next read gets fresh data
  invalidateCache('wallet');  
  
  return { success: true };
}
```

**Consistent calls to invalidateCache:**
- ✅ `depositToGamingWallet()` → calls invalidateCache
- ✅ `playCrash()` → calls invalidateCache
- ✅ `playSpin()` → calls invalidateCache
- ✅ Callback handler (gaming) → NOW CALLS invalidateCache [FIX #3]

---

## Summary

| Issue | Before | After | Impact |
|-------|--------|-------|--------|
| Read endpoint | ❌ Missing `/api/gaming/wallet` | ✅ Created | Games can fetch balance |
| Dashboard display | ❌ Hardcoded `setBalance(0)` | ✅ Fetches real API | Users see actual balance |
| Cache timing | ❌ No invalidation after deposit | ✅ Immediate invalidation | No stale balance window |
| User experience | ❌ "Deposit disappeared" | ✅ "Balance updated instantly" | ✅ Money visible everywhere |
