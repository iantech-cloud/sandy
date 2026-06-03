# Co-operative Bank STK Push Integration - OAuth2 Bearer Token Authentication

## 📌 Overview

This is a complete implementation of **Co-operative Bank STK Push integration** using **OAuth2 Bearer token authentication**. The system is designed for the **HustleHub Africa** platform and integrates with **MongoDB** for persistent transaction storage.

### ✨ Key Features

- ✅ **OAuth2 Bearer Token Authentication** - Secure, industry-standard authentication
- ✅ **STK Push Initiation** - Send M-Pesa payment prompts to customer phones
- ✅ **Transaction Polling** - Actively track transaction status without callbacks
- ✅ **Automatic Token Refresh** - Seamless token management during long operations
- ✅ **MongoDB Integration** - Persistent transaction tracking with audit logs
- ✅ **Complete Error Handling** - Handles all failure scenarios with clear messaging
- ✅ **Comprehensive Validation** - Environment variable validation & diagnostic tools

---

## 🚀 Quick Start (5 Minutes)

### 1. Extract Bearer Token from Postman
```bash
# Open: SANDRA OTIENO SCHOLINE.postman_collection.json
# Find: "Token" request → "Authorization" header
# Copy: The entire value (e.g., "Basic MktETXRDZnp...")
```

### 2. Update Environment Variables
Create or update `.env.local`:
```bash
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
COOP_BANK_OPERATOR_CODE=SANDRA
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
NEXTAUTH_SECRET=your-secret-here
NEXTAUTH_URL=https://yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

### 3. Validate Configuration
```bash
# Check all environment variables
node scripts/validate-env.js

# Test Bearer token request
node scripts/test-coop-token.js

# Run full integration test
node scripts/test-coop-integration.js
```

### 4. Start Application
```bash
npm install
npm run dev
```

### 5. Test STK Push
```bash
curl -X POST http://localhost:3000/api/payments/coop-bank/stk-push \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "phoneNumber": "254707919065",
    "narration": "Test payment",
    "depositType": "wallet"
  }'
```

---

## 📚 Documentation

### For Developers
- **[COOP_BANK_SETUP_QUICK_REF.md](./COOP_BANK_SETUP_QUICK_REF.md)** - Quick reference & common tasks
- **[COOP_BANK_AUTH_MIGRATION.md](./COOP_BANK_AUTH_MIGRATION.md)** - Detailed migration guide (if upgrading)
- **[CHANGES_SUMMARY.md](./CHANGES_SUMMARY.md)** - Summary of all modifications

### For System Integration
- **[.env.example](./.env.example)** - Sample environment configuration
- **[scripts/validate-env.js](./scripts/validate-env.js)** - Validation utility
- **[scripts/test-coop-token.js](./scripts/test-coop-token.js)** - Token endpoint test
- **[scripts/test-coop-integration.js](./scripts/test-coop-integration.js)** - Full integration test

---

## 🔐 Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `COOP_BANK_BASIC_AUTH` | ✅ | `Basic MktETXRDZnp...` | Pre-encoded Bearer token from Postman |
| `COOP_BANK_OPERATOR_CODE` | ✅ | `SANDRA` | Operator code |
| `COOP_BANK_BASE_URL` | ❌ | `https://openapi.co-opbank.co.ke` | API base URL (default: production) |
| `COOP_BANK_TOKEN_ENDPOINT` | ❌ | `/token` | Token endpoint path |
| `COOP_BANK_STK_PUSH_ENDPOINT` | ❌ | `/FT/stk/1.0.0` | STK push endpoint path |
| `COOP_BANK_STK_STATUS_ENDPOINT` | ❌ | `/Enquiry/STK/1.0.0/` | Status check endpoint path |

---

## 🏗️ Architecture

### OAuth2 Bearer Token Flow

```
┌──────────────────────────────────────────────────────────────┐
│ 1. GET BEARER TOKEN                                          │
│    POST /token                                               │
│    Authorization: Basic <COOP_BANK_BASIC_AUTH>              │
│    Response: { access_token, expires_in }                    │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 2. INITIATE STK PUSH                                         │
│    POST /FT/stk/1.0.0                                        │
│    Authorization: Bearer <access_token>                      │
│    Body: { MessageReference, CallBackUrl, Amount, ... }      │
│    Response: { ConversationID }                              │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 3. POLL FOR STATUS (every 3 seconds)                         │
│    POST /Enquiry/STK/1.0.0/                                  │
│    Authorization: Bearer <access_token>                      │
│    Body: { MessageReference }                                │
│    Response: { ResultCode, ResultDescription }               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│ 4. TRANSACTION COMPLETE                                      │
│    ResultCode = 0: Success ✓                                 │
│    ResultCode = 1032: User Cancelled                         │
│    ResultCode = 1037: Wrong PIN                              │
│    ResultCode = 2001: Insufficient Balance                   │
│    ResultCode = 1001: Timeout                                │
└──────────────────────────────────────────────────────────────┘
```

### Database Schema (MongoDB)

```javascript
db.mpesa_transactions {
  _id: ObjectId,
  user_id: String,                      // App user ID
  amount_cents: Number,                 // Amount in cents
  phone_number: String,                 // 254XXXXXXXXX format
  status: String,                       // pending, completed, failed, etc.
  source: String,                       // "coop_bank"
  checkout_request_id: String,          // MessageReference from Co-op Bank
  is_activation_payment: Boolean,       // Type of transaction
  
  metadata: {
    deposit_type: String,               // wallet, spin_wallet, activation
    message_reference: String,          // Unique transaction reference
    payment_method: String,             // coop_bank_stk_push
    revenue_target: String,             // user or company
    initiated_at: ISODate,
    // ... additional fields
  },
  
  bank_result_code: String,             // Result from Co-op Bank
  bank_result_description: String,      // Description of result
  
  created_at: ISODate,
  updated_at: ISODate,
  completed_at: ISODate                 // When transaction settled
}
```

---

## 📡 API Endpoints

### Initiate STK Push
```
POST /api/payments/coop-bank/stk-push
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "amount": 100,                          // Amount in KES
  "phoneNumber": "254707919065",          // Customer phone number
  "narration": "Payment description",     // Max 60 chars
  "depositType": "wallet"                 // wallet | spin_wallet | activation
}

Response (200 OK):
{
  "success": true,
  "data": {
    "messageReference": "SANDY...",
    "transactionId": "ObjectId",
    "amount": 100,
    "phoneNumber": "254707919065"
  },
  "message": "STK Push initiated. Please check your phone..."
}
```

### Check Transaction Status
```
POST /api/payments/coop-bank/status
Content-Type: application/json
Authorization: Bearer <session-token>

{
  "messageReference": "SANDY..."
}

Response (200 OK):
{
  "messageReference": "SANDY...",
  "status": "completed",
  "amount": 100,
  "timestamp": "2026-06-03T10:00:00Z",
  "receiptNumber": "CO123456789"
}
```

---

## 🔍 Troubleshooting

### Validation Issues

**"Missing env var: COOP_BANK_BASIC_AUTH"**
- Add the Bearer token to your `.env.local` file
- Format: `COOP_BANK_BASIC_AUTH=Basic MktETXRDZnp...` (with "Basic " prefix)

**"COOP_BANK_BASIC_AUTH must start with 'Basic '"**
- Copy the exact value from Postman (including "Basic " prefix)
- Check for extra spaces before/after

### Connection Issues

**"HTTP 401: Unauthorized"**
- Verify credentials from Postman collection
- Check they're production credentials (not sandbox)
- Ensure no leading/trailing spaces

**"Token request failed (HTTP 400)"**
- Grant type must be "client_credentials"
- Content-Type must be "application/x-www-form-urlencoded"
- Body must be raw text (not JSON)

### Payment Issues

**STK push not showing on phone**
- Verify phone format: `254XXXXXXXXX` (11 digits, must be Safaricom)
- Check amount: minimum 1 KES
- Verify narration: max 60 characters
- Check M-Pesa account isn't restricted

**Transaction status shows "PROCESSING" forever**
- Check application logs for errors
- Verify token doesn't expire during polling (rare)
- Contact Co-op Bank support if API is down

---

## 🛠️ Development Tools

### Validation Script
```bash
# Check environment configuration
node scripts/validate-env.js
```

Validates:
- All required environment variables are set
- Format and length of credentials
- URL validity
- Common configuration mistakes

### Token Test Script
```bash
# Test Bearer token request
node scripts/test-coop-token.js
```

Tests:
- Bearer token format
- Token endpoint connectivity
- OAuth2 credentials validity
- Error diagnostics

### Integration Test Script
```bash
# Run comprehensive integration test
node scripts/test-coop-integration.js
```

Tests:
- Environment variables
- Bearer token format
- Token endpoint connectivity
- Bearer token usage
- MongoDB configuration

---

## 📊 Transaction Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| `0` | Success | Transaction completed, funds deducted |
| `1032` | User Cancelled | User pressed cancel, can retry |
| `1037` | Wrong PIN | User entered wrong PIN, can retry |
| `2001` | Insufficient Balance | Customer needs to add funds |
| `2002` | Limit Exceeded | Daily transaction limit reached |
| `1001` | Timeout | No response in 90 seconds |
| `1003` | Network Error | Bank system error, safe to retry |

---

## 🚀 Deployment

### Pre-Deployment Checklist

- [ ] Environment variables configured correctly
- [ ] `node scripts/validate-env.js` passes
- [ ] `node scripts/test-coop-token.js` passes
- [ ] `node scripts/test-coop-integration.js` passes
- [ ] MongoDB connection verified
- [ ] HTTPS/SSL certificate installed
- [ ] Static IP whitelisted with Co-op Bank
- [ ] Callback URL configured in application

### Deployment Steps

1. **Staging Environment**
   ```bash
   # Copy configuration
   cp .env.example .env.staging
   # Edit with staging credentials
   nano .env.staging
   # Validate
   node scripts/validate-env.js
   # Deploy
   npm run build
   npm run start
   ```

2. **Production Environment**
   ```bash
   # Set environment variables on server/CI
   export COOP_BANK_BASIC_AUTH="Basic MktETXRDZnp..."
   export COOP_BANK_OPERATOR_CODE="SANDRA"
   export MONGODB_URI="mongodb+srv://..."
   # ... other variables
   
   # Validate
   node scripts/validate-env.js
   
   # Test with 1 KES transaction
   # Monitor logs
   # Gradually increase volume
   ```

---

## 📞 Support

### Quick Fixes
1. Run validation: `node scripts/validate-env.js`
2. Test token: `node scripts/test-coop-token.js`
3. Check logs for `[v0]` messages
4. Read docs in this directory

### Contact Co-operative Bank
- **API Issues**: Contact Co-op Bank API support
- **Credentials**: Verify with account manager
- **Merchant Issues**: Contact merchant support

---

## 📄 Files in This Integration

### Core Files
- `app/lib/services/coop-bank.ts` - Service layer (OAuth2, STK push, polling)
- `app/lib/types/coop-bank.ts` - TypeScript types and interfaces
- `app/api/payments/coop-bank/stk-push/route.ts` - STK push endpoint
- `app/api/payments/coop-bank/status/route.ts` - Status check endpoint
- `app/api/payments/coop-bank/callback/route.ts` - Callback endpoint (optional)

### Configuration Files
- `.env.example` - Sample environment variables
- `ecosystem.config.js` - PM2 deployment configuration
- `tailwind.config.ts` - TailwindCSS configuration (unchanged)

### Scripts
- `scripts/validate-env.js` - Validate environment setup
- `scripts/test-coop-token.js` - Test Bearer token
- `scripts/test-coop-integration.js` - Full integration test

### Documentation
- `COOP_BANK_README.md` - This file
- `COOP_BANK_SETUP_QUICK_REF.md` - Quick reference guide
- `COOP_BANK_AUTH_MIGRATION.md` - Migration guide (if upgrading)
- `CHANGES_SUMMARY.md` - Summary of changes

---

## 🎉 Success!

Your Co-operative Bank STK Push integration is ready to:

✅ Accept payments from customers  
✅ Send M-Pesa STK pushes to their phones  
✅ Automatically track transaction status  
✅ Update order status on completion  
✅ Handle all failure scenarios gracefully  
✅ Maintain comprehensive audit logs in MongoDB  

**Next Step:** Follow the [Quick Start](#-quick-start-5-minutes) section to get started!

---

## 📝 License & Support

This integration is part of the HustleHub Africa platform.

For support or questions, refer to the documentation files in this directory or contact your development team.

**Last Updated:** June 3, 2026  
**Version:** 2.0 (OAuth2 Bearer Token)
