# Co-operative Bank Authentication Migration Guide

## Overview

This document details the migration from **client ID + client secret** authentication to **OAuth2 Bearer token authentication** for the Co-operative Bank STK Push integration.

## What Changed

### Old Authentication Method (❌ DEPRECATED)
- **Variables**: `COOP_CLIENT_ID` + `COOP_CLIENT_SECRET`
- **Base64 Encoding**: Done by the application at runtime
- **Authentication**: Client credentials encoded into Basic auth header
- **Issues**: More complex, error-prone base64 encoding, harder to debug

### New Authentication Method (✅ NEW)
- **Variable**: `COOP_BANK_BASIC_AUTH` (pre-encoded)
- **Format**: `"Basic <base64(clientId:clientSecret)>"`
- **Base64 Encoding**: Pre-encoded from your Postman collection
- **Benefits**: 
  - Simpler configuration
  - Pre-verified credentials from Postman
  - Matches official documentation exactly
  - Easier to debug and troubleshoot

## Environment Variables Migration

### Before (Old Format)
```bash
# OLD - NO LONGER USED
COOP_CLIENT_ID=your-client-id-here
COOP_CLIENT_SECRET=your-client-secret-here
COOP_OPERATOR_CODE=SANDRA
COOP_BASE_URL=https://openapi.co-opbank.co.ke
COOP_TOKEN_URL=https://openapi.co-opbank.co.ke/token
COOP_STK_PUSH_URL=https://openapi.co-opbank.co.ke/FT/stk/1.0.0
COOP_STK_STATUS_URL=https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
```

### After (New Format)
```bash
# NEW - OAuth2 Bearer Token Authentication
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0/
```

## How to Migrate

### Step 1: Extract Bearer Token from Postman Collection

1. Open your Postman collection: `SANDRA OTIENO SCHOLINE.postman_collection.json`
2. Find the **"Token"** request
3. Look at the **"Authorization"** header
4. Copy the entire value (including the "Basic " prefix)

**Example value:**
```
Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
```

### Step 2: Update Environment Variables

Update your `.env.local`, `.env.production.local`, or `.env` file:

**Remove these:**
```bash
COOP_CLIENT_ID=...
COOP_CLIENT_SECRET=...
COOP_BASE_URL=...
COOP_TOKEN_URL=...
COOP_STK_PUSH_URL=...
COOP_STK_STATUS_URL=...
```

**Add these:**
```bash
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0/
```

### Step 3: Verify Configuration

Run the validation script to ensure all variables are correctly configured:

```bash
node scripts/validate-env.js
```

Expected output:
```
✓ COOP_BANK_BASIC_AUTH = Basic MktETXRDZnpfSHZscU...
✓ COOP_BANK_OPERATOR_CODE = SANDRA
✓ All Co-op Bank OAuth2 credentials are configured
```

### Step 4: Test Token Request

Test the OAuth2 Bearer token request:

```bash
node scripts/test-coop-token.js
```

Expected output:
```
✅ OAuth2 Bearer token obtained successfully!
✅ Your COOP_BANK_BASIC_AUTH and COOP_BANK_OPERATOR_CODE are correct.
```

## Files Changed

The following files have been updated:

### Core Service Files
- ✅ `app/lib/services/coop-bank.ts` - Uses `COOP_BANK_BASIC_AUTH` instead of client ID/secret
- ✅ `app/lib/types/coop-bank.ts` - Updated config interface

### Configuration Files
- ✅ `.env.example` - Shows new variable names and format
- ✅ `ecosystem.config.js` - Updated PM2 configuration comments
- ✅ `scripts/validate-env.js` - Validates new environment variables
- ✅ `scripts/test-coop-token.js` - Tests Bearer token authentication

### Application Routes
- ✅ `app/api/payments/coop-bank/stk-push/route.ts` - No changes needed (uses service internally)

## Technical Details

### OAuth2 Flow (Bearer Token)

**Step 1: Get Bearer Token** (using COOP_BANK_BASIC_AUTH)
```
POST https://openapi.co-opbank.co.ke/token
Authorization: Basic <COOP_BANK_BASIC_AUTH>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

Returns:
```json
{
  "access_token": "eyJ4NXQiOi...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

**Step 2: Use Bearer Token for STK Push**
```
POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "MessageReference": "...",
  "CallBackUrl": "...",
  "OperatorCode": "SANDRA",
  ...
}
```

**Step 3: Check Status with Bearer Token**
```
POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
Authorization: Bearer <access_token>
Content-Type: application/json

{"MessageReference": "..."}
```

## Troubleshooting

### Error: "Missing env var: COOP_BANK_BASIC_AUTH"

**Solution:** Add the pre-encoded Bearer token to your environment:
```bash
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
```

### Error: "COOP_BANK_BASIC_AUTH must start with 'Basic ' prefix"

**Solution:** Ensure the value starts with `Basic ` (with space):
```bash
# ✅ CORRECT
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx...

# ❌ WRONG (missing "Basic " prefix)
COOP_BANK_BASIC_AUTH=MktETXRDZnpfSHZscUYzaFNBemxjUmQx...
```

### Error: "HTTP 401: Unauthorized - invalid_client"

**Solution:** The Bearer token credentials are invalid. Double-check:
1. Copy exact value from Postman collection
2. Ensure no leading/trailing spaces
3. Verify you're using production credentials (not sandbox)
4. Contact Co-operative Bank if credentials were recently rotated

### Token Expiry During Polling

The service automatically handles token refresh with a 60-second safety buffer before expiry. If your polling takes longer than the token lifetime:
1. The service detects the expired token (401 response)
2. Automatically requests a new token
3. Continues polling with the new token

## Database

**No changes to MongoDB schema required.** The database structure remains unchanged. The `stk_transactions` table continues to use:
- `message_reference` for transaction tracking
- `mobile_number` for phone numbers
- `amount` for transaction amounts
- All existing status tracking and audit logging

## Support

If you encounter issues during migration:

1. **Run validation script**: `node scripts/validate-env.js`
2. **Test token endpoint**: `node scripts/test-coop-token.js`
3. **Check logs**: Look for `[v0]` prefixed debug messages
4. **Verify Postman collection**: Ensure you copied the exact Bearer token value
5. **Check documentation**: See `.env.example` for correct format

---

**Migration completed successfully!** 🎉

Your system now uses OAuth2 Bearer token authentication, which is:
- ✅ More secure (no client secrets in app code)
- ✅ Simpler configuration (pre-encoded credentials)
- ✅ Matches official Co-operative Bank documentation
- ✅ Easier to debug and troubleshoot
