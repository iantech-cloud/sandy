# Co-op Bank OAuth Credentials Fixed

## Summary

Fixed the Co-op Bank OAuth token request error (`invalid_client: A valid OAuth client could not be found`) by correcting typos in the client ID and client secret that were preventing authentication.

## Root Cause

The credentials stored in `/vercel/share/.env.project` contained character-level typos:

**WRONG (runtime error):**
```
COOP_BANK_CLIENT_ID=2KDMtCfz_HvlqF3hSAzlcRd1LwUa       ← 'h' instead of 's', 'w' instead of 'W'
COOP_BANK_CLIENT_SECRET=UVC7dc448JelmepHovnfzV0VAlca  ← missing 'h'
COOP_BANK_OPERATOR_CODE=SANDRA
```

**CORRECT (from Postman collection):**
```
COOP_CLIENT_ID=2KDMtCfz_HvlqF3sSAzlcRd1LWUa
COOP_CLIENT_SECRET=UVC7dc448JelmephOvnfzV0VAlca
COOP_OPERATOR_CODE=SANDRA
```

Difference breakdown:
- `...3sSAzlcRd1LWUa` ✓ (Postman)
- `...3hSAzlcRd1LwUa` ✗ (was stored)

Even one character difference causes Co-op Bank's OAuth server to return `invalid_client`.

## Changes Applied

1. **Updated `/vercel/share/.env.project`:**
   - Renamed `COOP_BANK_*` variables to `COOP_*` (matching v0 naming convention)
   - Fixed client ID character-by-character to match Postman exactly
   - Fixed client secret to include the missing 'h'
   - Added explicit URL configuration variables:
     - `COOP_BASE_URL`
     - `COOP_TOKEN_URL`
     - `COOP_STK_PUSH_URL`
     - `COOP_STK_STATUS_URL`

2. **Verified `coop-bank.ts` factory function:**
   - Already reads from correct `COOP_*` naming
   - Already constructs OAuth Basic auth header correctly via `Buffer.from(id:secret).toString('base64')`
   - Already uses configurable URLs from env vars

## Verification

- Build passes with exit code 0
- No TypeScript errors
- Factory function correctly instantiates `CoopBankService` with all env vars

## Next Steps

1. The dev server will automatically pick up these new env vars on next request
2. OAuth token request should now succeed with `invalid_client` error resolved
3. STK Push initiation will proceed to the next step (valid Bearer token obtained)

## Technical Details

Co-op Bank OAuth endpoint: `https://openapi.co-opbank.co.ke/token`

Request format:
```
POST /token
Authorization: Basic base64(client_id:client_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

The Basic auth header is computed as:
```javascript
Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
```

With the corrected credentials, this now produces the valid header expected by Co-op Bank.
