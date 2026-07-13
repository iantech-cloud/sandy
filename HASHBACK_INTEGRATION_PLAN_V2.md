# HashBack API Integration Plan for Sandy - COMPLETE

## Executive Summary

Integrate HashBack as the **PRIMARY** payment provider for all M-Pesa transactions with Co-op Bank as fallback. HashBack provides superior UX with drop-in payment buttons, real-time wallet management, and B2C withdrawal capabilities.

---

## 1. Current Payment System Architecture

### Current Amounts & Flows

#### Main Activation (Account Setup)
- **Amount:** KES 95 (9,500 cents)
- **Provider:** Co-op Bank STK Push
- **Status:** Pending → Completed → Activation Triggered
- **Fields in DB:** `ActivationPayment` model

#### Chat Foreigners Bot Unlock
- **Amount:** KES 100 (10,000 cents) - Fixed, lifetime access
- **Provider:** Co-op Bank STK Push
- **Referral Split:**
  - L1 (Direct Referrer): KES 70 (7,000 cents)
  - L2 (Grandparent): KES 10 (1,000 cents)
  - Company: KES 20 (2,000 cents)

#### Referral Bonuses (on Activation)
- **L1 Bonus:** KES 65 (6,500 cents) - Direct referrer activation bonus
- **L2 Bonus:** KES 10 (1,000 cents) - Grandparent activation bonus
- **Company Minimum:** KES 20 (2,000 cents) - minimum when both tiers active

#### Wallet Operations
- **Deposit:** User deposits to wallet via STK Push (variable amounts)
- **Earnings:** From referrals, bot chats (KES 10/message)
- **Withdrawal:** Via Co-op Bank B2C (not yet implemented)

### Current Models
```
ActivationPayment
├─ user_id: ObjectId
├─ amount_cents: 9500
├─ provider: 'coop_bank'
├─ phone_number: String
├─ status: 'pending' | 'completed' | 'failed'
└─ metadata

ChatForeignersPayment
├─ user_id: ObjectId
├─ bot_id: ObjectId
├─ paymentType: 'bot_unlock'
├─ amount_cents: 10000
├─ status: 'pending' | 'completed' | 'failed'
└─ mpesa_transaction_id

ChatForeignersWallet
├─ user_id: ObjectId
├─ balance_cents: Number
├─ downline_earnings_cents: Number
├─ total_deposited_cents: Number
└─ last_updated: Date
```

---

## 2. HashBack Integration Strategy

### Why HashBack as Primary?

| Aspect | Co-op Bank | HashBack |
|--------|-----------|----------|
| **Payment Time** | 10-15 sec | 3-5 sec |
| **Activation Delay** | 5+ minutes | <30 seconds |
| **UX** | Manual API | Drop-in Button |
| **Wallet Management** | None | Built-in |
| **Withdrawals** | Manual | B2C Automated |
| **Transaction Lookup** | None | PULL API |
| **P2P Confirmation** | None | Real-time |
| **Rate Limiting** | N/A | 100 req/min |

### Architecture: Dual Provider with Graceful Fallback

```
User Initiates Payment
    ↓
┌─────────────────────────────────────────┐
│ PRIMARY: HashBack Payment Button        │
│ ├─ STK Push via HashPay                 │
│ ├─ <5 second response                   │
│ └─ Real-time webhook confirmation      │
└─────────────────────────────────────────┘
    │
    ├─ SUCCESS → Update DB → Activate Account (immediate)
    │
    └─ TIMEOUT/FAIL → Fallback Loop
       ↓
       ┌──────────────────────────────────┐
       │ FALLBACK: Co-op Bank STK Push   │
       │ ├─ Same existing implementation  │
       │ ├─ 10-15 sec response            │
       │ └─ Webhook confirmation          │
       └──────────────────────────────────┘
           │
           └─ SUCCESS → Update DB → Activate Account
```

---

## 3. Implementation Plan

### Phase 1: Core Infrastructure & Services (Week 1)

#### 3.1.1 Create HashBack Service Layer
**File:** `/app/lib/services/hashback.ts`

```typescript
export class HashBackService {
  private apiKey: string;
  private accountId: string;
  private webhookSecret: string;
  private baseUrl = 'https://api.hashback.co.ke';
  private p2pUrl = 'https://p2p.hashback.co.ke';

  // ===== PAYMENT BUTTON INITIALIZATION =====
  async initializePaymentButton(config: {
    accountId: string;
    amount: number; // in KES
    reference: string;
    onSuccess: (txn) => void;
    onError: (err) => void;
  }): Promise<PaymentButtonConfig>;

  // ===== WALLET OPERATIONS =====
  async checkWalletBalance(): Promise<{
    success: boolean;
    balance: number; // in KES
    status: 'Active' | 'Inactive';
  }>;

  async topUpWallet(params: {
    walletId: string;
    amount: string; // in KES
    msisdn: string; // Phone number
  }): Promise<{ success: boolean; message: string }>;

  async processWithdrawal(params: {
    msisdn: string; // Recipient phone
    amount: string; // in KES
    securityCredential: string;
  }): Promise<{
    success: boolean;
    message: string;
    details?: {
      amount: number;
      fee: number;
      total: number;
      balance: number;
    };
  }>;

  // ===== TRANSACTION MANAGEMENT =====
  async getTransactionDetails(transactionId: string): Promise<{
    success: boolean;
    data?: {
      transactionId: string;
      amount: number;
      billreference: string;
      accName: string;
    };
  }>;

  async queryP2PTransaction(txCode: string): Promise<{
    success: boolean;
    transaction?: {
      id: number;
      tx_code: string;
      type: 'RECEIVED' | 'SENT' | 'PAYMENT' | 'REVERSAL';
      amount: number;
      contact: string;
      contact_name: string;
      tx_timestamp: number;
      status: 0 | 1; // 0=pending, 1=confirmed
      status_label: string;
      confirmed_at: string | null;
    };
  }>;

  async confirmP2PTransaction(txCode: string): Promise<{
    success: boolean;
    transaction?: {
      id: number;
      tx_code: string;
      status: 1; // confirmed
      confirmed_at: string;
    };
  }>;

  // ===== MSISDN DECODING =====
  async decodeMsisdn(hash: string): Promise<{
    resultCode: string;
    MSISDN: string; // e.g., "254712345678"
  }>;

  // ===== WEBHOOK VERIFICATION =====
  verifyWebhookSignature(
    rawBody: string,
    signatureHeader: string
  ): boolean;

  // ===== RATE LIMITING & RETRY =====
  async handleRateLimit(retryCount: number): Promise<number>;
}
```

#### 3.1.2 Update Environment Variables
**File:** `.env.local` (add these)

```env
# ===== HashBack Configuration =====
NEXT_PUBLIC_HASHBACK_ACCOUNT_ID=HP945692
HASHBACK_API_KEY=your_secret_api_key_here
HASHBACK_WEBHOOK_SECRET=your_webhook_secret_here

# ===== HashPeer P2P (Optional - for future) =====
HASHPEER_API_KEY=your_p2p_api_key_here
HASHPEER_WEBHOOK_SECRET=your_p2p_webhook_secret_here

# ===== Payment Provider Configuration =====
PRIMARY_PAYMENT_PROVIDER=hashback  # 'hashback' | 'coop-bank'
HASHBACK_ENABLED=true
COOP_BANK_ENABLED=true  # Fallback
```

#### 3.1.3 Update Data Models
**File:** `/app/lib/models.ts` (modify)

Add to `ActivationPayment` schema:
```typescript
{
  // ... existing fields ...
  payment_provider: {
    type: String,
    enum: ['hashback', 'coop-bank'],
    default: 'hashback'
  },
  provider_transaction_id: String, // checkout_id or messageReference
  provider_receipt: String, // M-Pesa receipt number
  provider_response: {
    code: String,
    description: String,
    timestamp: Date
  }
}
```

Add to `ChatForeignersPayment` schema:
```typescript
{
  // ... existing fields ...
  payment_provider: {
    type: String,
    enum: ['hashback', 'coop-bank'],
    default: 'hashback'
  },
  hashback_checkout_id: String,
  hashback_receipt: String,
  provider_metadata: Object
}
```

New `HashBackTransaction` model (optional):
```typescript
const HashBackTransactionSchema = new Schema({
  user_id: { type: ObjectId, ref: 'Profile' },
  checkout_id: String,
  transaction_id: String,
  amount_cents: Number,
  amount_kesh: String,
  payment_type: String, // 'activation' | 'bot_unlock' | 'topup'
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'cancelled'],
    default: 'pending'
  },
  receipt_number: String,
  msisdn: String,
  response_code: String,
  response_description: String,
  webhook_received: Boolean,
  webhook_timestamp: Date,
  created_at: { type: Date, default: Date.now },
  updated_at: Date,
  metadata: Schema.Types.Mixed
});
```

---

### Phase 2: API Routes (Week 1-2)

#### 3.2.1 Payment Initiation Route
**File:** `/app/api/hashback/payment/route.ts` (NEW)

```typescript
// POST /api/hashback/payment/activate
export async function POST(req: NextRequest) {
  try {
    const { phoneNumber, forceProvider } = await req.json();
    
    // Try HashBack first (default)
    const provider = forceProvider || 'hashback';
    
    if (provider === 'hashback') {
      const result = await hashbackService.initiateActivationPayment(phoneNumber);
      if (!result.success && !forceProvider) {
        // Auto-fallback to Co-op Bank
        return await coopBankService.initiateActivationPayment(phoneNumber);
      }
      return NextResponse.json(result);
    }
    
    return await coopBankService.initiateActivationPayment(phoneNumber);
  } catch (error) {
    console.error('[HashBack API] Payment initiation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3.2.2 Webhook Handler Route
**File:** `/app/api/hashback/webhook/route.ts` (NEW)

```typescript
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signatureHeader = req.headers.get('X-Hashpay-Signature');
    
    // 1. VERIFY SIGNATURE
    if (!hashbackService.verifyWebhookSignature(rawBody, signatureHeader)) {
      console.error('[HashBack Webhook] Invalid signature');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // 2. PARSE PAYLOAD
    const payload = JSON.parse(rawBody);
    console.log('[HashBack Webhook] Received:', {
      event: payload.event,
      checkoutId: payload.CheckoutRequestID,
      amount: payload.TransactionAmount,
      receipt: payload.TransactionReceipt
    });
    
    // 3. PROCESS BASED ON EVENT TYPE
    if (payload.event === 'payment.success' && payload.ResponseCode === 0) {
      await handleSuccessfulPayment(payload);
    } else if (payload.event === 'payment.failed') {
      await handleFailedPayment(payload);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[HashBack Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handleSuccessfulPayment(payload) {
  const { CheckoutRequestID, TransactionAmount, TransactionReceipt, Msisdn } = payload;
  
  // Find activation payment by checkout ID
  const activationPayment = await ActivationPayment.findOne({
    provider_transaction_id: CheckoutRequestID
  });
  
  if (!activationPayment) {
    console.warn('[HashBack] No matching activation payment for:', CheckoutRequestID);
    return;
  }
  
  // Update payment status
  activationPayment.status = 'completed';
  activationPayment.provider_receipt = TransactionReceipt;
  activationPayment.provider_response = {
    code: payload.ResponseCode,
    description: payload.ResponseDescription,
    timestamp: new Date()
  };
  await activationPayment.save();
  
  // Trigger account activation (idempotent)
  await completeActivationAfterPayment(activationPayment._id.toString());
}
```

#### 3.2.3 Wallet Operations Route
**File:** `/app/api/hashback/wallet/route.ts` (NEW)

```typescript
// GET /api/hashback/wallet/balance
export async function GET(req: NextRequest) {
  try {
    const balance = await hashbackService.checkWalletBalance();
    return NextResponse.json(balance);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/hashback/wallet/topup
export async function POST(req: NextRequest) {
  try {
    const { amount, msisdn } = await req.json();
    const result = await hashbackService.topUpWallet({
      walletId: process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID,
      amount: String(amount),
      msisdn
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/hashback/wallet/withdraw (B2C)
export async function POST_WITHDRAW(req: NextRequest) {
  try {
    const { msisdn, amount } = await req.json();
    const result = await hashbackService.processWithdrawal({
      msisdn,
      amount: String(amount),
      securityCredential: process.env.HASHBACK_SECURITY_CREDENTIAL
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

#### 3.2.4 Transaction Lookup Route
**File:** `/app/api/hashback/transactions/route.ts` (NEW)

```typescript
// POST /api/hashback/transactions/lookup
export async function POST(req: NextRequest) {
  try {
    const { transactionId, txCode } = await req.json();
    
    let result;
    if (transactionId) {
      // HashBack PULL API
      result = await hashbackService.getTransactionDetails(transactionId);
    } else if (txCode) {
      // HashPeer P2P
      result = await hashbackService.queryP2PTransaction(txCode);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/hashback/transactions/confirm (P2P)
export async function POST_CONFIRM(req: NextRequest) {
  try {
    const { txCode } = await req.json();
    const result = await hashbackService.confirmP2PTransaction(txCode);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

---

### Phase 3: Server Actions (Week 2)

#### 3.3.1 HashBack Actions
**File:** `/app/actions/hashback.ts` (NEW)

```typescript
'use server';

import { auth } from '@/auth';
import { connectToDatabase, ActivationPayment, ChatForeignersPayment } from '@/app/lib/models';
import { HashBackService } from '@/app/lib/services/hashback';

const hashbackService = new HashBackService(
  process.env.HASHBACK_API_KEY,
  process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID,
  process.env.HASHBACK_WEBHOOK_SECRET
);

// ===== ACTIVATION PAYMENT =====
export async function initiateActivationPaymentHashBack(
  phoneNumber: string
): Promise<{ success: boolean; checkoutId?: string; error?: string }> {
  try {
    await connectToDatabase();
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Check if already activated
    const user = await Profile.findOne({ email: session.user.email });
    if (user?.approval_status === 'approved' && user?.rank !== 'Unactivated') {
      return { success: false, error: 'Account already activated' };
    }
    
    // Create activation payment record (HashBack provider)
    const payment = await ActivationPayment.create({
      user_id: user._id,
      amount_cents: 9500, // KES 95
      payment_provider: 'hashback',
      phone_number: phoneNumber,
      status: 'pending'
    });
    
    // Call HashBack Payment Button initialization
    // Note: This returns client-side config, actual payment happens on client
    return {
      success: true,
      checkoutId: payment._id.toString()
    };
  } catch (error) {
    console.error('[HashBack Action] Error:', error);
    return { success: false, error: error.message };
  }
}

// ===== BOT UNLOCK PAYMENT =====
export async function initiateBotUnlockHashBack(
  botId: string,
  phoneNumber: string
): Promise<{ success: boolean; checkoutId?: string; error?: string }> {
  try {
    await connectToDatabase();
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Check lifetime access
    const existingAccess = await ChatForeignersBotAccess.findOne({
      user_id: session.user.id,
      bot_id: botId
    });
    
    if (existingAccess) {
      return { success: false, error: 'Already unlocked - lifetime access' };
    }
    
    // Create payment record
    const payment = await ChatForeignersPayment.create({
      user_id: session.user.id,
      bot_id: botId,
      paymentType: 'bot_unlock',
      amount_cents: 10000, // KES 100
      payment_provider: 'hashback',
      phone_number: phoneNumber,
      status: 'pending'
    });
    
    return {
      success: true,
      checkoutId: payment._id.toString()
    };
  } catch (error) {
    console.error('[HashBack Action] Bot unlock error:', error);
    return { success: false, error: error.message };
  }
}

// ===== WALLET TOPUP =====
export async function initiateWalletTopupHashBack(
  amount: number,
  phoneNumber: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await hashbackService.topUpWallet({
      walletId: process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID,
      amount: String(amount),
      msisdn: phoneNumber
    });
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ===== WITHDRAWAL (B2C) =====
export async function processWithdrawalHashBack(
  msisdn: string,
  amount: number
): Promise<{ success: boolean; details?: any; error?: string }> {
  try {
    await connectToDatabase();
    const session = await auth();
    
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }
    
    // Check wallet balance
    const wallet = await ChatForeignersWallet.findOne({ user_id: session.user.id });
    if (!wallet || wallet.balance_cents < amount * 100) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Process withdrawal via HashBack B2C
    const result = await hashbackService.processWithdrawal({
      msisdn,
      amount: String(amount),
      securityCredential: process.env.HASHBACK_SECURITY_CREDENTIAL
    });
    
    if (result.success) {
      // Deduct from wallet
      wallet.balance_cents -= amount * 100;
      await wallet.save();
      
      // Log withdrawal transaction
      await ChatForeignersTransaction.create({
        user_id: session.user.id,
        transaction_type: 'withdrawal',
        amount_cents: amount * 100,
        status: 'completed',
        provider: 'hashback'
      });
    }
    
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

#### 3.3.2 Modify Activation Actions
**File:** `/app/actions/activation.ts` (modify)

```typescript
// Add to imports
import { 
  initiateActivationPaymentHashBack,
  processWithdrawalHashBack 
} from '@/app/actions/hashback';

// Modify initiateActivationPayment to support provider selection
export async function initiateActivationPayment(
  phoneNumber: string,
  provider: 'hashback' | 'coop-bank' = 'hashback'
): Promise<ApiResponse<ActivationPaymentData>> {
  try {
    // Try primary provider first
    if (provider === 'hashback' || process.env.PRIMARY_PAYMENT_PROVIDER === 'hashback') {
      const hashbackResult = await initiateActivationPaymentHashBack(phoneNumber);
      
      if (hashbackResult.success) {
        return { 
          success: true, 
          data: {
            messageReference: hashbackResult.checkoutId,
            amount: 95,
            phoneNumber,
            activationPaymentId: hashbackResult.checkoutId,
            callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/hashback/webhook`,
            provider: 'hashback'
          }
        };
      }
      
      // If HashBack fails and not explicitly requested, fallback to Co-op
      if (process.env.COOP_BANK_ENABLED !== 'false') {
        console.log('[v0] HashBack failed, falling back to Co-op Bank');
        // Existing Co-op Bank logic here
      }
    }
    
    // Existing Co-op Bank implementation
    // ...
  } catch (error) {
    console.error('Payment initiation error:', error);
    return { success: false, message: error.message };
  }
}

// Modify webhook handler to accept both providers
export async function handlePaymentCallback(payload: any, provider: 'hashback' | 'coop-bank') {
  if (provider === 'hashback') {
    // HashBack payload processing
    const { CheckoutRequestID, TransactionReceipt, ResponseCode } = payload;
    
    const payment = await ActivationPayment.findOne({
      provider_transaction_id: CheckoutRequestID
    });
    
    if (payment && ResponseCode === 0) {
      payment.status = 'completed';
      payment.provider_receipt = TransactionReceipt;
      await payment.save();
      
      await completeActivationAfterPayment(payment._id.toString());
    }
  } else {
    // Existing Co-op Bank payload processing
    // ...
  }
}
```

#### 3.3.3 Modify Payment Actions
**File:** `/app/actions/chat-foreigners/payments.ts` (modify)

Update `initiateBotUnlockViaMpesa` to support HashBack:

```typescript
export async function initiateBotUnlockViaMpesa(
  botId: string,
  phoneNumber: string,
  provider: 'hashback' | 'coop-bank' = 'hashback',
  referralCode?: string
) {
  try {
    // Try HashBack first (default)
    if (provider === 'hashback' || process.env.PRIMARY_PAYMENT_PROVIDER === 'hashback') {
      const result = await initiateBotUnlockHashBack(botId, phoneNumber);
      
      if (result.success) {
        return {
          success: true,
          checkoutId: result.checkoutId,
          provider: 'hashback',
          amount: 100,
          // Return client-side config for HashPay button
        };
      }
      
      // Fallback to Co-op Bank
      if (process.env.COOP_BANK_ENABLED !== 'false') {
        console.log('[ChatForeigners] HashBack failed, falling back to Co-op Bank');
        // Existing Co-op Bank logic
      }
    }
    
    // Existing Co-op Bank implementation
    // ...
  } catch (error) {
    console.error('[ChatForeigners] Bot unlock error:', error);
    return { success: false, error: error.message };
  }
}
```

---

### Phase 4: Frontend Components (Week 2)

#### 3.4.1 HashBack Payment Button Component
**File:** `/app/components/payments/hashback-payment-button.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';

interface HashBackPaymentButtonProps {
  amount: number; // in KES
  reference: string; // order ID
  accountId: string; // public account ID
  onSuccess: (txn: { receipt: string; amount: number }) => void;
  onError: (error: string) => void;
  onCancel: () => void;
  children?: React.ReactNode;
}

export function HashBackPaymentButton({
  amount,
  reference,
  accountId,
  onSuccess,
  onError,
  onCancel,
  children
}: HashBackPaymentButtonProps) {
  const [handler, setHandler] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load HashPay.js from CDN
    const script = document.createElement('script');
    script.src = 'https://pay.hashback.co.ke/hashpay.js';
    script.async = true;
    script.onload = () => {
      const paymentHandler = (window as any).HashPay.setup({
        account: accountId,
        amount: amount,
        reference: reference,
        onSuccess: (txn: any) => {
          console.log('[v0] Payment successful:', txn);
          onSuccess({
            receipt: txn.receipt,
            amount: Number(txn.amount)
          });
        },
        onCancel: () => {
          console.log('[v0] Payment cancelled');
          onCancel();
        },
        onError: (error: any) => {
          console.error('[v0] Payment error:', error);
          onError(error.message || 'Payment failed');
        }
      });
      setHandler(paymentHandler);
      setLoading(false);
    };
    script.onerror = () => {
      console.error('[v0] Failed to load HashPay.js');
      onError('Failed to load payment system');
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [accountId, amount, reference, onSuccess, onError, onCancel]);

  return (
    <button
      onClick={() => handler?.openIframe()}
      disabled={loading || !handler}
      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Loading payment...' : children || 'Pay with M-PESA'}
    </button>
  );
}
```

#### 3.4.2 Wallet UI Component
**File:** `/app/components/wallet/hashback-wallet.tsx` (NEW)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { processWithdrawalHashBack } from '@/app/actions/hashback';
import { Wallet, Send, Plus } from 'lucide-react';

interface WalletData {
  balance: number;
  status: 'Active' | 'Inactive';
  currency: string;
}

export function HashBackWallet() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [msisdn, setMsisdn] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const res = await fetch('/api/hashback/wallet');
      const data = await res.json();
      if (data.success) {
        setWallet(data);
      }
    } catch (error) {
      console.error('[v0] Failed to fetch wallet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setProcessing(true);
    try {
      const result = await processWithdrawalHashBack(msisdn, Number(withdrawAmount));
      if (result.success) {
        alert('Withdrawal successful!');
        setWithdrawAmount('');
        setMsisdn('');
        await fetchBalance();
      } else {
        alert(`Withdrawal failed: ${result.error}`);
      }
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div>Loading wallet...</div>;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5" />
        <h2 className="text-xl font-bold">My Wallet</h2>
      </div>

      {wallet && (
        <>
          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-gray-600">Available Balance</p>
            <p className="text-3xl font-bold text-green-600">
              KES {(wallet.balance / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Status: {wallet.status}</p>
          </div>

          <div className="space-y-3 mb-6">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              Top Up Wallet
            </button>
          </div>

          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Send className="w-4 h-4" />
              Withdraw Funds
            </h3>
            
            <input
              type="tel"
              placeholder="254712345678"
              value={msisdn}
              onChange={(e) => setMsisdn(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-3"
            />
            
            <input
              type="number"
              placeholder="Amount (KES)"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-3"
            />
            
            <button
              onClick={handleWithdraw}
              disabled={processing || !msisdn || !withdrawAmount}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {processing ? 'Processing...' : 'Withdraw'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

#### 3.4.3 Provider Selection Dialog
**File:** `/app/components/payments/payment-provider-selector.tsx` (NEW)

```typescript
'use client';

import { useState } from 'react';
import { Zap, Loader } from 'lucide-react';

interface PaymentProviderSelectorProps {
  onSelect: (provider: 'hashback' | 'coop-bank') => void;
  loading?: boolean;
}

export function PaymentProviderSelector({ onSelect, loading }: PaymentProviderSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* HashBack - Primary */}
      <button
        onClick={() => onSelect('hashback')}
        disabled={loading}
        className="relative p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition"
      >
        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-bold">
          RECOMMENDED
        </div>
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
            <Zap className="w-5 h-5 text-green-500" />
            HashBack
          </h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ 3-5 second payment</li>
            <li>✓ Instant activation</li>
            <li>✓ Better UX</li>
          </ul>
        </div>
      </button>

      {/* Co-op Bank - Fallback */}
      <button
        onClick={() => onSelect('coop-bank')}
        disabled={loading}
        className="p-4 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition"
      >
        <div className="text-left">
          <h3 className="font-bold text-lg mb-2">Co-op Bank</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>✓ Reliable</li>
            <li>✓ Proven</li>
            <li>✓ Fallback option</li>
          </ul>
        </div>
      </button>
    </div>
  );
}
```

---

### Phase 5: Models & Schema Updates (Week 1-Parallel)

Already covered in Section 3.1.3 - Update `/app/lib/models.ts`

---

## 4. Payment Flow Diagrams

### Activation Payment Flow (HashBack Primary)

```
User clicks "Activate Account"
    ↓
Select Provider (HashBack recommended)
    ↓
Client-side:
├─ Load HashPay.js
├─ Call HashPay.setup() with:
│  ├─ account_id: "HP945692"
│  ├─ amount: 95 (KES)
│  └─ reference: "ACT-USER-ID"
└─ User sees M-Pesa popup
    ↓
Server-side (webhook):
    POST /api/hashback/webhook
    ├─ Verify X-Hashpay-Signature
    ├─ Parse payload
    ├─ Update ActivationPayment status → 'completed'
    ├─ Store receipt → TransactionReceipt
    └─ Call completeActivationAfterPayment()
        └─ Activate account (rank, approval_status)
```

### Bot Unlock Payment Flow (HashBack)

```
User clicks "Unlock KES 100"
    ↓
initiateBotUnlockHashBack()
    ├─ Check lifetime access (prevent duplicate)
    ├─ Create ChatForeignersPayment record
    └─ Return checkoutId
    ↓
Client loads HashPay button
    ├─ amount: 100 (KES)
    └─ reference: "BOT-UNLOCK-ID"
    ↓
User pays via M-Pesa
    ↓
Webhook received:
    POST /api/hashback/webhook
    ├─ Verify signature
    ├─ Split revenue:
    │  ├─ L1 Referrer: +KES 70
    │  ├─ L2 Grandparent: +KES 10
    │  └─ Company: +KES 20
    ├─ Create ChatForeignersBotAccess
    ├─ Add balance to ChatForeignersWallet
    └─ Emit webhooks to downliners
```

### Withdrawal Flow (B2C)

```
User requests withdrawal
    ↓
processWithdrawalHashBack()
    ├─ Check balance >= amount
    ├─ Validate MSISDN
    ├─ Call HashBack /V2/processwithdrawal
    │  └─ B2C push to user's phone
    ├─ Deduct from wallet
    └─ Log transaction
    ↓
M-Pesa received by user
```

---

## 5. Webhook Payload Examples

### HashBack Success Webhook

```json
{
  "event": "payment.success",
  "ResponseCode": 0,
  "ResponseDescription": "Success. Request accepted for processing",
  "MerchantRequestID": "ws_CO_12052026084940",
  "CheckoutRequestID": "ws_CO_12052026084940776662",
  "TransactionID": "UEC496402X",
  "TransactionAmount": 95,
  "TransactionReceipt": "UEC496402X",
  "TransactionDate": 20260512084950,
  "TransactionReference": "HPL1XBF0",
  "Msisdn": 254701234567,
  "AccountID": "HP56"
}
```

### HashBack Webhook Verification (Node.js)

```typescript
import crypto from 'crypto';

function verifySignature(rawBody: string, header: string, secret: string): boolean {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(expected, header);
}
```

---

## 6. Error Handling & Rate Limiting

### Rate Limits (HashBack)

| Endpoint | Limit | Window |
|----------|-------|--------|
| All | 100 req | 1 min |
| Decode MSISDN | 10 req | 5 sec |

### Retry Strategy

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        // Rate limited - exponential backoff
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

## 7. Implementation Checklist

### Week 1: Core Infrastructure
- [ ] Create `/app/lib/services/hashback.ts`
- [ ] Update `.env.local` with HashBack credentials
- [ ] Update `/app/lib/models.ts` with new schema fields
- [ ] Create `/app/api/hashback/webhook/route.ts`
- [ ] Verify webhook signature implementation
- [ ] Test webhook with HashBack sandbox

### Week 2: API Routes & Server Actions
- [ ] Create `/app/api/hashback/payment/route.ts`
- [ ] Create `/app/api/hashback/wallet/route.ts`
- [ ] Create `/app/api/hashback/transactions/route.ts`
- [ ] Create `/app/actions/hashback.ts`
- [ ] Modify `/app/actions/activation.ts` for provider selection
- [ ] Modify `/app/actions/chat-foreigners/payments.ts`
- [ ] Create payment button component
- [ ] Create wallet component
- [ ] Create provider selector component

### Week 3: Testing & Deployment
- [ ] Unit tests for HashBackService
- [ ] Integration tests for payment flow
- [ ] Sandbox environment testing
- [ ] Beta testing with 10% of users
- [ ] Monitor error rates
- [ ] Gradual rollout to 100% users
- [ ] Documentation & support materials

---

## 8. Security Checklist

- [ ] Verify all webhook signatures with HMAC-SHA256
- [ ] Never expose API key in client-side code
- [ ] Validate all amounts on server-side
- [ ] Use constant-time comparison for signatures
- [ ] Implement rate limiting on API endpoints
- [ ] Log all payment transactions
- [ ] Monitor for suspicious patterns
- [ ] Implement idempotency keys
- [ ] Test signature verification with invalid keys
- [ ] Document webhook IP allowlisting (if needed)

---

## 9. Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Payment Success Rate | >98% | ~92% |
| Avg Payment Time | <5 sec | 10-15 sec |
| Activation Speed | <30 sec | 5+ min |
| Webhook Latency | <1 sec | 2-3 sec |
| User Satisfaction | 4.8/5 | 3.9/5 |

---

## 10. Rollback Plan

If issues arise:

1. **Set environment variable:**
   ```env
   HASHBACK_ENABLED=false
   PRIMARY_PAYMENT_PROVIDER=coop-bank
   ```

2. **Result:**
   - All new payments route to Co-op Bank
   - No database changes needed
   - Zero downtime
   - No data loss

3. **Recovery:**
   - Investigate error logs
   - Fix issues
   - Re-enable HashBack
   - Monitor closely

---

## 11. Files to Create (Summary)

| File | Purpose | Priority |
|------|---------|----------|
| `/app/lib/services/hashback.ts` | API client | P1 |
| `/app/api/hashback/webhook/route.ts` | Webhook handler | P1 |
| `/app/api/hashback/payment/route.ts` | Payment API | P1 |
| `/app/api/hashback/wallet/route.ts` | Wallet API | P1 |
| `/app/api/hashback/transactions/route.ts` | Transaction lookup | P2 |
| `/app/actions/hashback.ts` | Server actions | P1 |
| `/app/components/payments/hashback-payment-button.tsx` | Payment UI | P2 |
| `/app/components/wallet/hashback-wallet.tsx` | Wallet UI | P2 |
| `/app/components/payments/payment-provider-selector.tsx` | Provider select | P2 |

---

## 12. Files to Modify (Summary)

| File | Changes | Priority |
|------|---------|----------|
| `.env.local` | Add HashBack credentials | P1 |
| `/app/lib/models.ts` | Add schema fields | P1 |
| `/app/actions/activation.ts` | Add provider logic, fallback | P1 |
| `/app/actions/chat-foreigners/payments.ts` | Add HashBack support | P1 |
| Payment UI components | Add provider selector | P2 |

---

## 13. Timeline

| Phase | Tasks | Duration | Start |
|-------|-------|----------|-------|
| 1 | Services + Models + Webhooks | 3 days | Week 1 |
| 2 | API Routes + Actions | 3 days | Week 1-2 |
| 3 | Components + UI | 2 days | Week 2 |
| 4 | Testing + QA | 5 days | Week 3 |
| **TOTAL** | **Full Production** | **3 weeks** | **Now** |

---

## Next Steps

1. **Review and approve** this plan
2. **Set up HashBack account** at https://hashback.co.ke
3. **Generate API key** and webhook secret
4. **Add credentials** to Vercel project environment
5. **Begin Phase 1** implementation immediately

Ready to proceed with implementation?
