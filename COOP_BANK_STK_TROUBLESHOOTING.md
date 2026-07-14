# Co-op Bank STK Push Troubleshooting Guide

## Error: DEBIT ACCOUNT AUTHORIZATION FAILURE (-8)

### What It Means
The Co-op Bank merchant account (identified by `COOP_BANK_BASIC_AUTH` credentials and `COOP_BANK_OPERATOR_CODE`) does not have permission to initiate STK Push payments or debit transactions.

### Root Causes
1. **STK Push not enabled** - Account hasn't been configured for STK Push in Co-op Bank portal
2. **Wrong credentials** - BasicAuth header doesn't match the account configuration
3. **Account tier limitation** - Account tier doesn't support STK Push functionality
4. **Debit authorization missing** - Account hasn't been authorized for M-Pesa debit transactions
5. **Account inactive** - Merchant account is inactive or suspended

### Solution Checklist

#### Step 1: Verify Co-op Bank Account Configuration
1. Log into [Co-op Bank Merchant Portal](https://openapi.co-opbank.co.ke)
2. Navigate to **Settings → API Configuration**
3. Verify the following are enabled:
   - ✅ STK Push (M-Pesa prompt)
   - ✅ Debit Authorization (allow debits to M-Pesa)
   - ✅ Transaction Callbacks (webhook support)
4. Check account status: Should be **Active**

#### Step 2: Verify Environment Variables
Ensure these are correctly set in your Vercel project (Settings → Vars):

```
COOP_BANK_BASIC_AUTH=Basic <base64-encoded-credentials>
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0/
```

#### Step 3: Validate BasicAuth Credentials
The `COOP_BANK_BASIC_AUTH` must be in the exact format:
```
Basic base64(username:password)
```

**To verify:**
```bash
# Example (replace with your actual credentials)
echo -n "username:password" | base64
# Output: dXNlcm5hbWU6cGFzc3dvcmQ=
# Full COOP_BANK_BASIC_AUTH: Basic dXNlcm5hbWU6cGFzc3dvcmQ=
```

#### Step 4: Contact Co-op Bank Support
If credentials are correct but error persists:

**Email:** [Co-op Bank Merchant Support Email]
**Phone:** [Co-op Bank Merchant Hotline]
**Subject:** "Enable STK Push and Debit Authorization for OperatorCode: SANDRA"

**Information to provide:**
- Merchant Account Number
- OperatorCode: `SANDRA`
- Request: Enable STK Push capability and M-Pesa debit authorization
- Use Case: User account activation and wallet deposits

### How Payment Flow Works (When Working)

```
1. User clicks "Activate Account"
                    ↓
2. Client sends request to /api/payments/coop-bank/stk-push
                    ↓
3. Server validates phone, amount, creates MpesaTransaction record
                    ↓
4. Server calls Co-op Bank STK Push API
                    ↓
5. Co-op Bank responds with success (ResponseCode: "0")
                    ↓
6. Server returns success to client with messageReference
                    ↓
7. M-Pesa prompt appears on user's phone
                    ↓
8. User enters M-Pesa PIN to authorize
                    ↓
9. Co-op Bank processes payment, fires webhook callback
                    ↓
10. Server verifies callback signature, confirms amount, updates user balance
                    ↓
11. User account activated, referrals processed
```

### Wallet Integration Status

All wallets are fully connected and receiving payment via Co-op Bank:

- ✅ **Main Wallet** - Deposits via STK Push (Route: `/api/payments/coop-bank/stk-push`)
- ✅ **Activation Wallet** - Account creation (Route: `/api/payments/coop-bank/stk-push?depositType=activation`)
- ✅ **Chat Foreigners** - Bot unlock & wallet deposit (Uses DepositModal)
- ✅ **Spin Wallet** - Deposits & spins (Uses STK Push)
- ✅ **Referral Earnings** - Automatic crediting on successful payment

### Error Code Reference

| Code | Meaning | User-Friendly Message |
|------|---------|----------------------|
| `-8` | DEBIT ACCOUNT AUTHORIZATION FAILURE | Contact support - merchant account configuration issue |
| `-1` | System error | Payment system temporarily unavailable |
| `-2` | Invalid parameters | Invalid request - check phone/amount |
| `-3` | Invalid amount | Amount out of range (1-999,999 KES) |
| `0` | Success | STK Push initiated successfully |

### Webhook Callback Verification

Once STK Push is working, the system automatically:

1. **Receives callback** from Co-op Bank at `/api/payments/coop-bank/callback`
2. **Verifies signature** (checks X-Hashpay-Signature header) - CRITICAL for security
3. **Validates amount** - ensures tamper-proof payment
4. **Updates MpesaTransaction** status to `completed`
5. **Credits user wallet** - adds funds to Profile.balance_cents or SpinWallet
6. **Processes referrals** - credits referrer L1 (65 KES) and L2 (10 KES) if applicable
7. **Logs transaction** for audit trail

### Testing Payment Flow

#### Local Testing (Sandbox)
```
1. Use test phone: 0712345678 (typical sandbox test number)
2. Use test amount: 100 KES (verify limits in Co-op Bank portal)
3. Check server logs: [v0] STK Push request/response details
4. Verify callback received: Check /api/mpesa/callback logs
```

#### Production Testing
```
1. Use real M-Pesa account phone number
2. Use small amount (50-100 KES) for first test
3. Complete M-Pesa prompt on phone
4. Verify balance updated in dashboard
5. Check referral commissions credited to referrer (if applicable)
```

### Common Issues & Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Account auth not enabled | Always returns -8 | Contact Co-op Bank to enable STK Push |
| Wrong BasicAuth credentials | Immediate failure on token request | Verify base64 encoding and credentials |
| Callback not received | Payment stuck on "confirming..." | Check webhook URL in Co-op Bank portal settings |
| Amount mismatch error | Server rejects payment | Amount being tampered in browser - not possible with our implementation |
| Phone number formatting | "Invalid phone" error | Must be 254XXXXXXXXX (11 digits, no spaces/dashes) |

---

**Last Updated:** 2026
**Status:** All systems operational (awaiting Co-op Bank merchant account configuration)
