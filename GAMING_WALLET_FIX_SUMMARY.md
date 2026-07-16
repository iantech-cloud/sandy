# Gaming Wallet Deposit Bug Fix - Complete Summary

## Problem Statement

Users deposited money to their gaming wallets via M-Pesa, saw "Payment Successful" on the waiting page, but when returning to the gaming dashboard or playing games, the balance still showed KES 0 — making it look like the deposit silently failed, even though the money was actually credited server-side.

## Root Cause Analysis

### The Deposit Side (Working ✅)
- Co-op Bank callback correctly hit `/api/payments/coop-bank/callback`
- Gaming wallet balance was properly updated in MongoDB: `GamingWallet.findOneAndUpdate(..., $inc: { balance_cents: amount }, ...)`
- Transaction records were marked as `completed`
- **Problem:** Users never saw this reflected on the UI

### The Read Side (Broken ❌)

Three critical failures prevented users from seeing their deposited balance:

#### 1. **GamingWallet.tsx Component - Hardcoded Placeholder**
- File: `/app/dashboard/gaming/components/GamingWallet.tsx`
- The wallet display panel that shows on the gaming dashboard had leftover placeholder code
- ```tsx
  // BROKEN: Just hardcoded to zero
  const fetchGamingWallet = async () => {
    setBalance(0);        // ← always zero
    setTransactions([]);  // ← always empty
  };
  ```
- This component is what users see first when opening the gaming dashboard
- Even though games fetch real data, this UI shows zero, making it look like balance wasn't credited

#### 2. **Missing `/api/gaming/wallet` Endpoint**
- File: Did not exist anywhere in `/app/api/gaming/`
- **All five game pages** (crash, dice, hi-lo, mines, plinko) try to fetch from `/api/gaming/wallet`:
  ```tsx
  const response = await fetch('/api/gaming/wallet');
  const data = await response.json();
  setBalance(data.balance_cents || 0);
  ```
- Since the endpoint didn't exist, every fetch returned 404
- Games fell back to `setBalance(0)` on error
- Users saw KES 0 in every game, even though money was in the database

#### 3. **Missing Cache Invalidation**
- File: `/app/api/payments/coop-bank/callback/route.ts`
- The callback handler credited the gaming wallet correctly **BUT** never cleared the cache
- `findGamingWalletOptimized()` caches wallet reads for 2 minutes (see `CACHE_TIMES.WALLET = 120`)
- Every other balance mutation (`depositToGamingWallet()`, `playCrash()`, etc.) calls `invalidateCache('wallet')` after writing
- **Missing:** The callback handler's gaming deposit branch didn't invalidate cache
- **Result:** If a user somehow got fresh data, they'd still see stale balance for up to 2 minutes after real deposit

## Solution Implemented

### Fix 1: Created Missing Endpoint
**File:** `/app/api/gaming/wallet/route.ts` (NEW)

```typescript
export async function GET(request: NextRequest) {
  // 1. Authenticate user via session
  // 2. Look up user profile by email
  // 3. Fetch gaming wallet using optimized query (with cache)
  // 4. If no wallet exists, create one with zero balance
  // 5. Return: { balance_cents, total_deposited_cents, total_wagered_cents, total_lost_cents, updated_at }
}
```

This endpoint:
- Uses the same `findGamingWalletOptimized()` function that other parts of the app use
- Benefits from existing caching layer (cache key: `wallet:{userId}`)
- Handles missing wallets by creating them on demand
- Returns consistent shape that games expect

### Fix 2: Rewired GamingWallet.tsx Component
**File:** `/app/dashboard/gaming/components/GamingWallet.tsx`

**Before:**
```tsx
const fetchGamingWallet = async () => {
  setBalance(0);           // Hardcoded zero
  setTransactions([]);     // Hardcoded empty
};
```

**After:**
```tsx
const fetchGamingWallet = async () => {
  const response = await fetch('/api/gaming/wallet');
  if (!response.ok) throw new Error(...);
  
  const data = await response.json();
  setBalance(data.balance_cents || 0);  // Real data from API
  setTransactions([]);                  // TODO: Add transactions endpoint
};
```

Plus added refresh logic after successful deposit:
```tsx
onSuccess={() => {
  setShowDepositModal(false);
  // Refresh wallet balance after successful deposit
  const refreshWallet = async () => {
    const response = await fetch('/api/gaming/wallet');
    if (response.ok) {
      const data = await response.json();
      setBalance(data.balance_cents || 0);
    }
  };
  refreshWallet();
}}
```

### Fix 3: Added Cache Invalidation to Callback
**File:** `/app/api/payments/coop-bank/callback/route.ts`

**Added import:**
```typescript
import { invalidateCache } from '@/app/lib/db-cache';
```

**In gaming deposit handler, after crediting balance:**
```typescript
if (depositType === 'gaming') {
  if (paymentStatus === 'completed') {
    // Credit the wallet
    await GamingWallet.findOneAndUpdate(..., { $inc: { balance_cents: ... } });
    
    // ← NEW: Clear wallet cache so next read gets fresh data
    invalidateCache('wallet');
    
    console.log('Gaming wallet credited...');
  }
}
```

This ensures:
- Wallet cache is immediately cleared when balance changes
- Next fetch (from dashboard or games) gets real balance, not stale cache
- Matches pattern already used in `depositToGamingWallet()` and `playCrash()`

## User Experience Flow (After Fix)

1. **User initiates deposit**
   - Opens gaming dashboard → sees GamingWallet panel
   - Clicks "Deposit to Gaming Wallet"
   - Enters amount & phone number in modal
   - Sent to M-Pesa waiting page

2. **M-Pesa payment completes**
   - Co-op Bank callback credits `GamingWallet.balance_cents`
   - Cache is invalidated immediately
   - Waiting page shows "Payment Successful"
   - User clicks "Start Playing" or "Back to Gaming"

3. **User returns to gaming**
   - **Dashboard:** GamingWallet component fetches `/api/gaming/wallet`
     - Gets real balance (not cached, since we cleared it)
     - Displays updated balance ✅
   - **Games:** Each game page fetches `/api/gaming/wallet`
     - Gets real balance
     - Displays updated balance ✅
     - User can play immediately ✅

## Testing Checklist

- [x] Build succeeds (no TypeScript/import errors)
- [x] New endpoint exists and is reachable: `GET /api/gaming/wallet`
- [x] GamingWallet component fetches real data instead of hardcoded zero
- [x] Cache invalidation added to callback handler
- [x] Consistent cache keys and timing across all balance-reading functions
- [ ] Manual test: Deposit → Check balance displays in dashboard
- [ ] Manual test: Deposit → Check balance displays in game
- [ ] Manual test: Fast polling doesn't show stale balance after deposit

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `/app/api/gaming/wallet/route.ts` | **NEW** - Missing endpoint | +61 |
| `/app/dashboard/gaming/components/GamingWallet.tsx` | Fetch real data instead of hardcoded zero | ~25 |
| `/app/api/payments/coop-bank/callback/route.ts` | Add import + cache invalidation | +3 |
| **Total** | | +89 |

## Remaining Work (Optional)

### Gaming Transactions Display
The GamingWallet component still shows "No transactions yet" because there's no `/api/gaming/transactions` endpoint. This is not blocking the fix but would improve UX:
- Could fetch from `GamingTransaction` model
- Could aggregate deposits, plays, winnings
- Not required for deposits to work

### Multi-Currency Stats
The GamingWallet panel shows placeholder stats:
- "Total Wagered: KES 0"
- "Total Winnings: KES 0"

These could be populated from aggregated game results, but are cosmetic placeholders currently.

## How to Verify the Fix Works

### Via Browser (After Deployment)
1. Navigate to `/dashboard/gaming`
2. Open gaming dashboard wallet panel
3. Initiate M-Pesa deposit
4. Complete payment on phone
5. Wait page shows "Success"
6. Check dashboard — balance should show new amount ✅
7. Click "Start Playing" → Open any game → Balance should show ✅

### Via API (Direct Test)
```bash
# Get authenticated session first, then:
curl -H "Cookie: <session_cookie>" \
  https://your-domain.com/api/gaming/wallet

# Should return:
{
  "success": true,
  "balance_cents": 500000,  # Real balance from DB
  "total_deposited_cents": 500000,
  "total_wagered_cents": 0,
  "total_lost_cents": 0,
  "updated_at": "2026-07-16T..."
}
```

---

**Status:** ✅ All fixes implemented and built successfully. Ready for testing.
