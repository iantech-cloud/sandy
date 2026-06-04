# Co-operative Bank Deposit Integration - Complete Implementation Guide

## Overview

This document describes the complete implementation of the Co-operative Bank STK Push integration for payment processing in HustleHub Africa. The system handles three types of deposits: wallet top-ups, spin wallet deposits, and activation payments.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      USER FLOW                               │
├─────────────────────────────────────────────────────────────┤
│ 1. User initiates deposit (amount + phone number)           │
│ 2. Frontend calls: POST /api/payments/coop-bank/stk-push    │
│ 3. Backend creates MpesaTransaction record                  │
│ 4. Backend calls Co-op Bank API to initiate STK push        │
│ 5. User completes M-Pesa transaction on their phone         │
│ 6. Co-op Bank POSTs callback to /api/payments/coop-bank/callback
│ 7. Backend credits balance (wallet, spin wallet, or         │
│    completes activation)                                     │
│ 8. Frontend polls status endpoint for completion            │
└─────────────────────────────────────────────────────────────┘
```

---

## File Organization

### Core Service Layer
- **`app/lib/services/coop-bank.ts`** - Main CoopBankService class
  - Handles OAuth2 token generation
  - Initiates STK push requests
  - Queries transaction status
  - Maps response codes to local payment statuses
  
- **`app/lib/types/coop-bank.ts`** - TypeScript interfaces
  - Request/response types for all Co-op Bank APIs
  - Application-level helpers for payment operations

### API Endpoints
- **`app/api/payments/coop-bank/stk-push/route.ts`** (POST)
  - Validates user input and phone number
  - Creates MpesaTransaction record
  - Initiates STK push via Co-op Bank API
  - Returns messageReference for status polling

- **`app/api/payments/coop-bank/callback/route.ts`** (POST)
  - Receives payment settlement callbacks from Co-op Bank
  - Updates MpesaTransaction status
  - Credits user balance (wallet) or spin wallet (spin_wallet)
  - Completes activation flow (activation)
  - **CRITICAL**: Uses MongoDB transactions for atomicity

- **`app/api/payments/coop-bank/status/route.ts`** (GET/POST)
  - Checks transaction status via Co-op Bank Enquiry API
  - Returns cached status for terminal states
  - Fallback to cached status if Co-op Bank API is unavailable
  - User-scoped queries (only authenticated users can check their own)

### Server Actions
- **`app/actions/deposit.ts`** - User-facing deposit operations
  - `processMpesaDeposit()` - Initiates deposit via Co-op Bank STK Push
  - `checkMpesaPaymentStatus()` - Polls transaction status
  - `getDepositHistory()` - Retrieves user's deposit history
  - `getUserBalance()` - Gets current wallet balance

---

## Detailed Flow by Deposit Type

### 1. WALLET DEPOSIT (User Wallet Top-up)

**Objective:** Increase user's main wallet balance

**Flow:**
```
User initiates deposit
    ↓
[STK Push] Phone number + amount validated
    ↓
MpesaTransaction created with deposit_type='wallet'
    ↓
STK Push sent to user's phone
    ↓
User completes M-Pesa payment
    ↓
[Callback] Payment settles from Co-op Bank
    ↓
MpesaTransaction status updated to 'completed'
    ↓
Profile.balance_cents += amount_cents
    ↓
Transaction record marked as 'completed'
```

**Key Files:**
- **Initiation:** `processMpesaDeposit()` in `app/actions/deposit.ts`
- **Settlement:** Wallet deposit handler in `app/api/payments/coop-bank/callback/route.ts` (lines 186-206)

**Balance Update Location:** `app/api/payments/coop-bank/callback/route.ts` line 199
```typescript
user.balance_cents = (user.balance_cents || 0) + mpesaTransaction.amount_cents;
```

---

### 2. SPIN WALLET DEPOSIT (Spin Credits)

**Objective:** Add funds to user's spin wallet balance, then enable spinning with those funds

**Behavior:**
- Deposit increases ONLY user's `SpinWallet.balance_cents`
- No immediate company revenue is recorded
- Company revenue (`SPIN_COST` transaction) is recorded ONLY when the user actually spins
- Unspent spin wallet funds remain in the user's balance indefinitely

**Flow:**
```
User initiates spin wallet deposit
    ↓
[STK Push] Phone validated, amount validated
    ↓
MpesaTransaction created with deposit_type='spin_wallet'
    ↓
STK Push sent to user's phone (narration: 'Spin Wallet Deposit')
    ↓
User completes M-Pesa payment
    ↓
[Callback] Payment settles
    ↓
MpesaTransaction status updated to 'completed'
    ↓
SpinWallet.balance_cents += amount_cents
    ↓
SpinWallet.total_deposited_cents += amount_cents
    ↓
[Later, when user spins]
    ↓
SpinWallet.balance_cents -= SPIN_COST (30 KES)
    ↓
Company revenue Transaction created with type='SPIN_COST'
```

**Key Files:**
- **Initiation:** `depositSpinWallet()` action (typically in wallet deposit flow with `depositType='spin_wallet'`)
- **Callback Processing:** Spin wallet handler in `app/api/payments/coop-bank/callback/route.ts` (lines 121-172)
- **Spin Revenue Recording:** `app/actions/spin.ts` in `performSpin()` function (lines ~1125-1140)

**Balance Update Location:** `app/api/payments/coop-bank/callback/route.ts` line 156
```typescript
spinWallet.balance_cents = (spinWallet.balance_cents || 0) + mpesaTransaction.amount_cents;
```

**Revenue Recording Location:** `app/actions/spin.ts` (after deducting from spin wallet)
```typescript
await (Transaction as any).create({
  user_id: userId,
  target_type: 'company',
  type: 'SPIN_COST',
  amount_cents: SPIN_COST_CENTS,
  status: 'completed',
  source: 'spin_wallet',
  ...
})
```

---

### 3. ACTIVATION PAYMENT

**Objective:** Complete account activation after payment verification

**Flow:**
```
User initiates activation payment
    ↓
ActivationPayment record created
    ↓
[STK Push] STK sent to user's phone
    ↓
User completes M-Pesa payment
    ↓
[Callback] Payment settles
    ↓
MpesaTransaction status updated to 'completed'
    ↓
ActivationPayment marked as 'completed'
    ↓
[Server Action] completeActivationAfterPayment() runs
    ↓
User account activated
```

**Key Files:**
- **Callback Processing:** Activation handler in `app/api/payments/coop-bank/callback/route.ts` (lines 208-248)
- **Activation Completion:** `app/actions/activation.ts` - `completeActivationAfterPayment()`

---

## Co-operative Bank API Integration

### 1. Authentication (OAuth2 Client Credentials)

**Endpoint:** `POST https://openapi.co-opbank.co.ke/token`

**Flow:**
```typescript
Headers:
  Authorization: Basic <COOP_BANK_BASIC_AUTH>
  Content-Type: application/x-www-form-urlencoded

Body: grant_type=client_credentials

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Implementation Details:**
- Token is generated fresh for each STK push (no caching)
- 60-second timeout per request
- Automatic retry with exponential backoff (1s, 2s) on 5xx errors
- Cache cleared on any failure to ensure fresh token on next attempt

**Code Location:** `app/lib/services/coop-bank.ts` - `getAccessToken()` method (lines 137-205)

---

### 2. STK Push Request

**Endpoint:** `POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0`

**Request Format (PascalCase):**
```typescript
{
  "MessageReference": "SANDY1718892345ABCDEF",    // Unique ID, used as idempotency key
  "CallBackUrl": "https://app.hustlehub.co.ke/api/payments/coop-bank/callback",
  "OperatorCode": "SANDY",                         // Pre-configured at Co-op Bank
  "TransactionCurrency": "KES",
  "MobileNumber": "254712345678",                  // 254 + 9 digits
  "Narration": "Spin Wallet Deposit",             // Max 60 chars, shown on M-Pesa prompt
  "Amount": 100,                                   // Integer KES, no decimals
  "MessageDateTime": "2024-06-15T10:30:45Z",      // ISO format
  "OtherDetails": [
    {
      "Name": "ReferenceNumber",
      "Value": "SANDY1718892345ABCDEF"
    }
  ]
}
```

**Success Response:**
```typescript
{
  "ResponseCode": "0",                           // "0" = success
  "ResponseDescription": "Success",
  "MessageReference": "SANDY1718892345ABCDEF",
  "OperatorTxnID": "...",
  "ConversationID": "..."
}
```

**Failure Response:**
```typescript
{
  "ResponseCode": "1001",                        // Non-zero = error
  "ResponseDescription": "Invalid phone number",
  "MessageReference": "SANDY1718892345ABCDEF"
}
```

**Implementation Details:**
- Message reference is auto-generated if not provided
- Phone number automatically normalized to `254XXXXXXXXX` format
- Amount truncated to integer (fractions discarded)
- 60-second timeout
- Response fields normalized: `MessageCode` → `ResponseCode`, `MessageDescription` → `ResponseDescription`

**Code Location:** `app/lib/services/coop-bank.ts` - `initiateSTKPush()` method (lines 226-333)

---

### 3. Transaction Status Query

**Endpoint:** `POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/`

**Request:**
```typescript
{
  "MessageReference": "SANDY1718892345ABCDEF"
}
```

**Response Codes:**
| Code | Status | Meaning | Terminal |
|------|--------|---------|----------|
| `0` | `completed` | Transaction successful | ✅ Yes |
| `1` or `S_001` | `pending` | Still processing | ❌ No |
| `S_*` | `pending` | Intermediate state | ❌ No |
| `2001` | `timeout` | User didn't respond within timeout | ✅ Yes |
| `2002` | `cancelled` | User cancelled STK prompt | ✅ Yes |
| `1037` | `timeout` | No response from user | ✅ Yes |
| Other | `failed` | Error/failure | ✅ Yes |

**Code Location:** `app/lib/services/coop-bank.ts` - `mapResponseCode()` method (lines 442-478)

---

## Status Lifecycle

### Payment Status States

```
INITIATED
    ↓
PENDING (polling in progress)
    ↓
COMPLETED ──→ Balance credited immediately
    │
    ├→ FAILED ──→ User receives error, no balance change
    │
    ├→ CANCELLED ──→ User cancelled STK prompt, no balance change
    │
    └→ TIMEOUT ──→ No M-Pesa response, no balance change
```

### Status Determination

**Sequence:**
1. API initiates → MpesaTransaction status = `initiated`
2. Frontend polls status endpoint
3. Status endpoint queries Co-op Bank API
4. Co-op Bank returns ResponseCode
5. ResponseCode mapped to local status (via `mapResponseCode()`)
6. If terminal state reached, callback is expected
7. Callback updates MpesaTransaction with final status
8. Balance credited (if completed and deposit type is wallet/spin_wallet)

---

## Database Models & Records

### MpesaTransaction

Tracks the payment transaction across the entire lifecycle.

**Key Fields:**
```typescript
{
  user_id: ObjectId,                    // Which user initiated this
  amount_cents: Number,                 // 3000 = KES 30
  phone_number: String,                 // "254712345678"
  status: String,                       // 'initiated' → 'pending' → 'completed'/'failed'
  source: String,                       // 'coop_bank'
  checkout_request_id: String,          // Message reference (lookup key for callback)
  completed_at: Date,                   // When payment settled
  failed_at: Date,                      // When payment failed
  callback_payload: Object,             // Raw callback from Co-op Bank
  callback_received_at: Date,           // When callback arrived
  metadata: {
    deposit_type: String,               // 'wallet' | 'spin_wallet' | 'activation'
    message_reference: String,
    payment_method: String,             // 'coop_bank_stk_push'
    callback_processed: Boolean,        // Idempotency flag
    callback_processed_at: String
  }
}
```

**Lifecycle Example (Wallet Deposit):**
```
Created by: POST /api/payments/coop-bank/stk-push
    status: 'initiated'
    source: 'coop_bank'

Updated by: GET /api/payments/coop-bank/status (polling)
    status: 'pending' (if still processing)

Updated by: POST /api/payments/coop-bank/callback (settlement)
    status: 'completed'
    completed_at: 2024-06-15T10:35:00Z
    callback_processed: true
```

---

### Transaction (General Ledger)

Records all financial events for reporting and audit trails.

**Wallet Deposit Example:**
```typescript
{
  user_id: ObjectId,
  type: 'DEPOSIT',
  amount_cents: 3000,
  status: 'pending',           // ← 'completed' after callback
  target_type: 'user',
  target_id: ObjectId,
  description: 'Co-op Bank deposit from 254712345678',
  mpesa_transaction_id: ObjectId,  // Links to MpesaTransaction
  source: 'coop_bank_stk_push'
}
```

**Spin Cost (Revenue) Example:**
```typescript
{
  user_id: ObjectId,
  type: 'SPIN_COST',
  amount_cents: 3000,
  status: 'completed',
  target_type: 'company',      // Revenue goes to company
  source: 'spin_wallet',       // Created when user spins
  description: 'Spin cost - KES 30.00 (1 spin)'
}
```

---

### SpinWallet

Holds user's spin credits and deposit history.

**Key Fields:**
```typescript
{
  user_id: ObjectId,
  balance_cents: Number,                // Current balance available to spin
  total_deposited_cents: Number,        // Cumulative deposits (for reporting)
  total_used_cents: Number,             // Cumulative spins (for reporting)
  total_spins: Number,                  // How many times user has spun
  deposits: [
    {
      amount_cents: Number,
      mpesa_checkout_request_id: String,
      mpesa_transaction_id: ObjectId,
      status: String,                   // 'pending' → 'completed'
      deposited_at: Date,
      created_at: Date
    }
  ]
}
```

**Example After Deposit:**
```
User deposits KES 300
    ↓
SpinWallet.balance_cents: 0 → 30000
SpinWallet.total_deposited_cents: 0 → 30000
deposits[].status: 'pending' → 'completed'
```

**Example After Spin:**
```
User spins (costs KES 30)
    ↓
SpinWallet.balance_cents: 30000 → 27000
SpinWallet.total_used_cents: 0 → 3000
SpinWallet.total_spins: 0 → 1
Transaction created: type='SPIN_COST', amount_cents=3000
```

---

## Callback Processing (Critical Path)

### Callback Reception & Validation

**POST /api/payments/coop-bank/callback**

1. **Receive callback** from Co-op Bank containing payment result
2. **Extract MessageReference** (lookup key)
3. **Find MpesaTransaction** by `checkout_request_id` (=MessageReference)
4. **Idempotency check**: If already processed, return immediately
5. **Map ResponseCode** to local status (completed/failed/cancelled/timeout)

### Transactional Processing

All updates are wrapped in a **MongoDB transaction** for atomicity:

```typescript
session.startTransaction()
  ├─ Update MpesaTransaction status
  ├─ Determine deposit type
  ├─ If wallet → Credit user.balance_cents
  ├─ If spin_wallet → Credit spinWallet.balance_cents
  ├─ If activation → Update ActivationPayment, run completeActivationAfterPayment()
  └─ Commit transaction
```

### Critical: Idempotency Guard

Co-op Bank may send the same callback multiple times. The system prevents duplicate balance credits:

```typescript
const terminalStatuses = ['completed', 'failed', 'cancelled', 'timeout'];
if (
  terminalStatuses.includes(mpesaTransaction.status) &&
  mpesaTransaction.metadata?.callback_processed
) {
  // Already processed — skip duplicate callback
  return NextResponse.json({ success: true, message: 'Already processed' });
}
```

**Idempotency Flag Set By:**
```typescript
metadata: {
  callback_processed: true,
  callback_processed_at: callbackReceivedAt.toISOString()
}
```

---

## Status Polling (Client-Side)

### Status Check Sequence

1. **POST /api/payments/coop-bank/stk-push** initiated by user
   - Returns: `{ messageReference, transactionId }`

2. **Frontend polls GET /api/payments/coop-bank/status?MessageReference=...**
   - Interval: Every 2-3 seconds
   - Timeout: 3+ minutes (matches M-Pesa STK timeout)

3. **Status endpoint behavior:**
   - **Terminal state cached**: Return immediately from DB
   - **Pending state**: Query Co-op Bank API
   - **API unavailable**: Fallback to cached DB status

4. **On terminal status**: Stop polling, credit balance if completed

### Response Format

```typescript
{
  "success": true,
  "data": {
    "messageReference": "SANDY...",
    "status": "completed" | "failed" | "cancelled" | "timeout" | "pending",
    "amount": 30,                          // KES
    "cached": true | false,                // true = from DB, false = from Co-op API
    "fallback": false,                     // true = API was down, used cache
    "lastCheckedAt": "2024-06-15T10:35:00Z"
  }
}
```

---

## Environment Variables Required

```bash
# Co-operative Bank OAuth2 Credentials
COOP_BANK_BASIC_AUTH="Basic <base64-encoded-client-id:client-secret>"
COOP_BANK_OPERATOR_CODE="SANDY"

# Co-operative Bank API Endpoints (optional, uses defaults if omitted)
COOP_BANK_BASE_URL="https://openapi.co-opbank.co.ke"
COOP_BANK_TOKEN_ENDPOINT="/token"
COOP_BANK_STK_PUSH_ENDPOINT="/FT/stk/1.0.0"
COOP_BANK_STK_STATUS_ENDPOINT="/Enquiry/STK/1.0.0/"

# Application
NEXT_PUBLIC_BASE_URL="https://app.hustlehub.co.ke"  # Used for callback URL
```

---

## Error Handling & Recovery

### Graceful Degradation

**If Co-op Bank API is down:**
- Status checks return cached status from database
- Polling continues to retry API calls
- Balance credits still happen when callback eventually arrives

**If callback is delayed:**
- User can manually check status via polling
- Transaction is eventually settled via callback when it arrives
- Status endpoint updates DB when callback arrives late

### Timeout Handling

**Co-op Bank STK timeout: 2-3 minutes**
- M-Pesa prompt expires after 2-3 minutes of inactivity
- Co-op Bank returns ResponseCode `2001` (timeout) or `1037` (no response)
- These map to local status `timeout`
- User can retry immediately

**API request timeout: 60 seconds**
- All HTTP requests to Co-op Bank have 60-second timeout
- Timeouts trigger retry with exponential backoff
- After max retries, error is surfaced to user

---

## Phone Number Normalization

Co-op Bank requires phone numbers in **Kenyan format: `254XXXXXXXXX`** (254 + 9 digits)

**Supported input formats:**
- `07XXXXXXXX` → `254XXXXXXXX` (add country code, drop leading 0)
- `2547XXXXXXXX` → `254712345678` (already correct)
- `+254712345678` → `254712345678` (strip leading +)
- `712345678` → `254712345678` (add country code)

**Normalization logic:**
```typescript
static normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
  if (digits.startsWith('1') && digits.length === 9) return `254${digits}`;
  
  return digits.startsWith('+') ? digits.slice(1) : digits;
}
```

**Code Location:** `app/lib/services/coop-bank.ts` - `normalisePhone()` (lines 415-425)

---

## Testing & Debugging

### Key Console Logs

The implementation includes extensive logging prefixed with `[v0]` for debugging:

```
[v0] Token Request (Attempt 1/2)
[v0] Token obtained successfully (expires in 3600s)
[v0] STK Push Request Details
[v0] STK Push Success Response
[v0] STK Status Result
[CoopCallback] Received at ...
[CoopCallback] Status mapped: ...
[CoopCallback] SpinWallet: +KES 30 credited to user ...
```

### Test Scripts

Located in `/scripts/`:
- `test-coop-token.js` - Test token generation
- `test-coop-endpoints.js` - Test STK push and status endpoints
- `test-coop-integration.js` - Full integration test

---

## Security Considerations

### 1. Idempotency
- Message reference is unique per request (`SANDY` + timestamp + random)
- Duplicate callbacks are detected and skipped (no double-crediting)

### 2. Phone Number Validation
- User can only deposit from their registered phone number
- Check: `phoneNumbersMatch(formattedPhone, user.phone_number)`
- Prevents unauthorized deposits from wrong numbers

### 3. Transaction Atomicity
- All balance updates use MongoDB transactions
- Either all updates succeed or all rollback
- Prevents partial updates on errors

### 4. User Scoping
- Status checks are user-scoped (only authenticated users can check their own)
- Balance updates validate user_id matches

### 5. Authentication
- All deposit actions require authenticated session
- `auth()` check on every endpoint

---

## Future Improvements

1. **Webhook Signature Verification** - Verify callback signature from Co-op Bank
2. **Rate Limiting** - Limit deposits per user per timeframe
3. **Admin Override** - Manual balance credit for special cases
4. **Deposit Limits** - Enforce daily/monthly deposit caps
5. **Analytics** - Track deposit success rates, average amounts, peak times

---

## Summary Table

| Component | Purpose | Key File |
|-----------|---------|----------|
| **CoopBankService** | Handles all Co-op Bank API calls | `coop-bank.ts` |
| **STK Push Endpoint** | Initiates payment | `/stk-push/route.ts` |
| **Callback Endpoint** | Receives payment results | `/callback/route.ts` |
| **Status Endpoint** | Checks transaction status | `/status/route.ts` |
| **Deposit Actions** | User-facing deposit operations | `deposit.ts` |
| **SpinWallet** | Stores spin wallet balance | Database model |
| **MpesaTransaction** | Payment transaction tracking | Database model |
| **Transaction** | General ledger | Database model |

---

**Last Updated:** June 2024  
**Status:** Production Ready
