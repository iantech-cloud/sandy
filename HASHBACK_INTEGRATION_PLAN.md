# HashBack API Integration Plan for Sandy

## Executive Summary
Integrate HashBack payment APIs to enhance the existing M-Pesa payment system with better reliability, faster processing, and comprehensive wallet management. HashBack will be implemented as a **primary payment provider** alongside Co-op Bank as a fallback.

---

## Current System Analysis

### Existing Payment Architecture
- **Primary M-Pesa Provider:** Co-op Bank (STK Push)
- **Models:** ChatForeignersPayment, ChatForeignersTransaction, ChatForeignersWallet
- **Key Features:**
  - Activation payments (KSH 2,500)
  - Bot unlock payments (KSH 100)
  - User earnings/wallet system
  - Referral bonuses
  - Withdrawal system

### Current Flow
```
User Initiates Payment
    ↓
Co-op Bank STK Push
    ↓
M-Pesa Prompt
    ↓
Callback Webhook
    ↓
Update Database & Activate Account
```

---

## HashBack Integration Strategy

### Phase 1: Core Services (Week 1)

#### 1.1 Create HashBack Service Layer
**File:** `/app/lib/services/hashback.ts`

Features:
- Initialize HashBack client with API key authentication
- Implement payment button setup
- Implement wallet operations
- Implement transaction lookup
- Error handling and retry logic
- Rate limiting compliance

```typescript
export class HashBackService {
  // Payment Button
  initializePaymentButton(config)
  
  // Wallet Operations
  checkWalletBalance()
  topUpWallet()
  processWithdrawal()
  
  // Transaction Management
  getTransactionDetails()
  queryTransaction()
  confirmTransaction()
  
  // MSISDN Decoding
  decodeMsisdn()
}
```

#### 1.2 Environment Configuration
**File:** `.env.local` (add these variables)

```env
# HashBack Payment Button
NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=HP945692
HASHBACK_API_KEY=your_api_key_here
HASHBACK_WEBHOOK_SECRET=your_webhook_secret_here

# HashPeer P2P (optional)
HASHPEER_API_KEY=your_p2p_api_key_here
HASHPEER_WEBHOOK_SECRET=your_p2p_webhook_secret_here
```

---

### Phase 2: API Routes (Week 1-2)

#### 2.1 Payment Initiation Route
**File:** `/app/api/hashback/payment/route.ts`

Endpoints:
- `POST /api/hashback/payment/activate` - Initiate activation payment
- `POST /api/hashback/payment/unlock-bot` - Initiate bot unlock
- `POST /api/hashback/payment/topup` - Wallet top-up

#### 2.2 Webhook Handler
**File:** `/app/api/hashback/webhook/route.ts`

Features:
- Verify X-Hashpay-Signature header
- Handle `payment.success` event
- Update ChatForeignersPayment status
- Trigger account activation
- Log transaction

#### 2.3 Wallet Operations Route
**File:** `/app/api/hashback/wallet/route.ts`

Endpoints:
- `GET /api/hashback/wallet/balance` - Check wallet balance
- `POST /api/hashback/wallet/topup` - Initiate STK top-up
- `POST /api/hashback/wallet/withdraw` - Process withdrawal

#### 2.4 Transaction Lookup Route
**File:** `/app/api/hashback/transactions/route.ts`

Endpoints:
- `POST /api/hashback/transactions/lookup` - Query transaction by ID
- `POST /api/hashback/transactions/confirm` - Confirm pending transaction

---

### Phase 3: Server Actions (Week 2)

#### 3.1 Payment Actions
**File:** `/app/actions/hashback.ts` (NEW)

Functions:
```typescript
// Payment Initiation
export async function initiateActivationPaymentHashBack()
export async function initiateBotUnlockHashBack()
export async function initiateWalletTopupHashBack()

// Wallet Management
export async function getWalletBalanceHashBack()
export async function processWithdrawalHashBack()

// Transaction Management
export async function getTransactionDetailsHashBack()
export async function confirmPaymentHashBack()
```

#### 3.2 Modify Activation Actions
**File:** `/app/actions/activation.ts` (MODIFY)

Changes:
- Add `useHashBack` parameter to `initiateActivationPayment()`
- Implement fallback logic: Try HashBack first → Fall back to Co-op Bank
- Update `completeActivationAfterPayment()` to handle both providers

```typescript
export async function initiateActivationPayment(
  phoneNumber: string,
  provider: 'hashback' | 'coop-bank' = 'hashback'
)
```

#### 3.3 Modify Payment Actions
**File:** `/app/actions/chat-foreigners/payments.ts` (MODIFY)

Changes:
- Add HashBack as primary payment method
- Implement provider selection logic
- Add fallback error handling

---

### Phase 4: Frontend Components (Week 2)

#### 4.1 Payment Button Component
**File:** `/app/components/payments/hashback-payment-button.tsx` (NEW)

Features:
- Load HashPay.js script
- Integrate payment button
- Handle success/cancel/error callbacks
- Display receipt
- Mobile-responsive design

#### 4.2 Wallet UI Components
**File:** `/app/components/wallet/hashback-wallet.tsx` (NEW)

Features:
- Display wallet balance
- Top-up button
- Withdrawal button
- Transaction history

#### 4.3 Modify Existing Payment UI
**File:** `/app/components/payments/payment-dialog.tsx` (MODIFY if exists)

Changes:
- Add provider selection toggle
- Show both HashBack and Co-op Bank options
- Display estimated fees
- Better error messaging

---

### Phase 5: Data Models (Week 1)

#### 5.1 Update Payment Schema
**File:** `/app/lib/models.ts` (MODIFY)

Add fields to `ChatForeignersPayment`:
```typescript
payment_provider: 'hashback' | 'coop-bank' // NEW
hashback_checkout_id?: string // NEW (for HashBack tracking)
hashback_receipt?: string // NEW (M-Pesa receipt)
```

#### 5.2 Add HashBack Transaction Model (Optional)
**File:** `/app/lib/models.ts` (MODIFY)

```typescript
const HashBackTransactionSchema = new Schema({
  user_id: ObjectId,
  checkout_id: String,
  transaction_id: String,
  amount_cents: Number,
  status: String,
  receipt: String,
  created_at: Date,
  updated_at: Date
})
```

---

### Phase 6: Testing & QA (Week 3)

#### 6.1 Unit Tests
```
/app/lib/services/__tests__/hashback.test.ts
/app/api/hashback/__tests__/webhook.test.ts
```

#### 6.2 Integration Tests
- Test payment flow: Button → Callback → Activation
- Test wallet operations
- Test fallback to Co-op Bank
- Test webhook signature verification

#### 6.3 Manual Testing
- Sandbox environment testing
- Production readiness verification
- User acceptance testing

---

## Implementation Sequence

### Week 1: Core Infrastructure
1. Create HashBack service (`/app/lib/services/hashback.ts`)
2. Add environment variables
3. Create payment API routes
4. Create webhook handler
5. Update data models

### Week 2: Business Logic & UI
1. Create server actions (`/app/actions/hashback.ts`)
2. Modify activation and payment actions
3. Create payment button component
4. Create wallet components
5. Integrate with existing UI

### Week 3: Testing & Optimization
1. Unit and integration tests
2. QA and bug fixes
3. Performance optimization
4. Documentation

---

## Key Technical Decisions

### 1. Dual Provider Strategy
- **Primary:** HashBack (faster, more reliable)
- **Fallback:** Co-op Bank (existing, proven)
- **Logic:** Try HashBack first, fall back on error

### 2. Webhook Signature Verification
```typescript
// Always verify X-Hashpay-Signature header
const expected = 'sha256=' + hash_hmac('sha256', rawBody, secret);
if (!constant_time_equal(expected, header)) {
  return 401; // Reject
}
```

### 3. Idempotency
- Payment callbacks are idempotent
- Safe to retry webhook processing
- Database updates use unique constraints

### 4. Client-Side Validation
```typescript
// MUST validate amount on client before fulfilling
if (Number(txn.amount) !== Number(expectedAmount)) {
  console.error('Amount tampered with');
  return;
}
```

---

## Files to Create

| File | Purpose | Priority |
|------|---------|----------|
| `/app/lib/services/hashback.ts` | HashBack API client | P1 |
| `/app/api/hashback/webhook/route.ts` | Webhook receiver | P1 |
| `/app/api/hashback/payment/route.ts` | Payment API | P1 |
| `/app/api/hashback/wallet/route.ts` | Wallet API | P1 |
| `/app/api/hashback/transactions/route.ts` | Transaction API | P2 |
| `/app/actions/hashback.ts` | Server actions | P1 |
| `/app/components/payments/hashback-payment-button.tsx` | UI Component | P2 |
| `/app/components/wallet/hashback-wallet.tsx` | UI Component | P2 |

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `.env.local` | Add HashBack config | P1 |
| `/app/lib/models.ts` | Add HashBack fields | P1 |
| `/app/actions/activation.ts` | Add provider logic | P1 |
| `/app/actions/chat-foreigners/payments.ts` | Add HashBack support | P1 |
| `/app/components/payments/payment-dialog.tsx` | Add provider selection | P2 |

---

## Migration Strategy

### Phase A: Silent Rollout (Week 1-2)
- Deploy HashBack infrastructure
- Backend ready but not exposed to users
- Internal testing only

### Phase B: Beta Testing (Week 2-3)
- 10% of users get HashBack option
- Monitor error rates and performance
- Gather feedback

### Phase C: Full Rollout (Week 3+)
- Default to HashBack for new users
- Gradual migration of existing users
- Keep Co-op Bank as fallback

---

## Security Considerations

1. **API Key Management**
   - Store in Vercel environment variables
   - Never expose in client-side code
   - Rotate regularly

2. **Webhook Security**
   - Always verify HMAC-SHA256 signature
   - Use constant-time comparison
   - Reject unsigned requests with 401

3. **Amount Validation**
   - Always verify client-submitted amounts
   - Check against server-side order price
   - Never trust browser values

4. **Rate Limiting**
   - Implement exponential backoff (429 responses)
   - Store rate limit headers
   - Queue retries for later

---

## Success Metrics

- Payment success rate: **>95%** (vs current Co-op Bank)
- Average transaction time: **<5 seconds** (vs 10-15s currently)
- Webhook processing latency: **<1 second**
- Activation delay: **<30 seconds** (vs 5+ minutes currently)
- User satisfaction: **>4.5/5** stars

---

## Rollback Plan

If HashBack integration causes issues:
1. Set `HASHBACK_DISABLED=true` env variable
2. All payment requests automatically fall back to Co-op Bank
3. No database migrations needed (schema supports both)
4. Zero downtime rollback

---

## Timeline

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Core Services | 3 days | Week 1, Day 1 | Week 1, Day 3 |
| Phase 2: API Routes | 3 days | Week 1, Day 4 | Week 2, Day 2 |
| Phase 3: Server Actions | 2 days | Week 2, Day 1 | Week 2, Day 2 |
| Phase 4: Frontend | 3 days | Week 2, Day 3 | Week 2, Day 5 |
| Phase 5: Models | 1 day | Week 1, Day 1 | Week 1, Day 1 |
| Phase 6: Testing | 5 days | Week 3, Day 1 | Week 3, Day 5 |

**Total: 3 weeks to full production deployment**

---

## Next Steps

1. **Approve this plan** and prioritize components
2. **Set up HashBack account** at https://hashback.co.ke
3. **Generate API key** and webhook secret
4. **Add environment variables** to Vercel project
5. **Begin Phase 1** implementation
