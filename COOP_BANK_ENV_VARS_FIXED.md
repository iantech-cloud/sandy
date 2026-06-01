# Co-op Bank Environment Variables — Fixed

## Problem
The code was looking for `COOP_BANK_*` prefixed env vars:
- `COOP_BANK_CLIENT_ID`
- `COOP_BANK_CLIENT_SECRET`
- `COOP_BANK_OPERATOR_CODE`

But your `.env.local` uses `COOP_*` prefixed names:
- `COOP_CLIENT_ID`
- `COOP_CLIENT_SECRET`
- `COOP_OPERATOR_CODE`

Additionally, the API URLs were hardcoded, making them inflexible.

## Solution
Updated `/app/lib/services/coop-bank.ts`:

1. **Changed factory function to read correct env var names:**
   - `COOP_CLIENT_ID` (was: `COOP_BANK_CLIENT_ID`)
   - `COOP_CLIENT_SECRET` (was: `COOP_BANK_CLIENT_SECRET`)
   - `COOP_OPERATOR_CODE` (was: `COOP_BANK_OPERATOR_CODE`)

2. **Made API endpoints configurable via env vars:**
   - `COOP_BASE_URL` → baseUrl (defaults to https://openapi.co-opbank.co.ke)
   - `COOP_TOKEN_URL` → tokenUrl (defaults to {baseUrl}/token)
   - `COOP_STK_PUSH_URL` → stkPushUrl (defaults to {baseUrl}/FT/stk/1.0.0)
   - `COOP_STK_STATUS_URL` → stkStatusUrl (defaults to {baseUrl}/Enquiry/STK/1.0.0/)

3. **Updated `CoopBankConfig` interface** to include optional URL fields.

4. **Updated `CoopBankService` constructor** to accept and use the configurable URLs instead of hardcoded values.

## Result
✅ Code now reads from your `.env.local` file correctly
✅ All 7 environment variables are properly configured
✅ API endpoints are now environment-configurable
✅ Build passes with exit code 0
✅ No type errors or missing variable references

Your STK push calls should now work without the "Missing env var" error.
