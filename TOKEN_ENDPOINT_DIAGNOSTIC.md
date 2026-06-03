# Co-op Bank Token Endpoint 500 Error Diagnostic Guide

## Problem
Token endpoint returning HTTP 500 errors, blocking all STK Push calls.

## Recent Fixes Applied
1. **Response Scope Bug** - STK Push response parsing was outside try block
   - Now all response handling inside try block
   - Proper JSON parsing and normalization

2. **Enhanced Error Logging** - Full error responses logged
   - No more truncated error messages
   - Complete Co-op Bank response visible

3. **Auth Format Verification** - Check COOP_BANK_BASIC_AUTH format
   - Log shows first 20 + last 10 characters
   - Total length displayed
   - "Basic " prefix verified

## Diagnostic Steps

### Step 1: Check Auth Header Format
Look for logs like:
```
[v0] COOP_BANK_BASIC_AUTH format: Basic MktETXRDZnpfSHZscU...AlcJZWVhZA
[v0] COOP_BANK_BASIC_AUTH starts with "Basic ": true
[v0] COOP_BANK_BASIC_AUTH length: 82
```

**Must have:**
- Starts with `Basic ` (with space after Basic)
- Length around 80-85 characters for valid credentials
- No trailing newlines or extra spaces

**Common Issues:**
- `"Basic" without space` → Invalid format
- Length < 20 or > 100 → Malformed credentials
- Missing "Basic " prefix → Not encoded

### Step 2: Test Token Request Manually
```bash
# Using your COOP_BANK_BASIC_AUTH value
BASIC_AUTH="Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh"

curl -X POST https://openapi.co-opbank.co.ke/token \
  -H "Authorization: $BASIC_AUTH" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials" \
  -v
```

### Step 3: Monitor Console Logs
Token request attempt shows:
```
[v0] Token Request (Attempt 1/2):
[v0]   Token URL: https://openapi.co-opbank.co.ke/token
[v0]   Timeout: 60 seconds

// If successful:
[v0] Token obtained successfully (expires in 3600s)

// If 500 error:
[v0] Token request failed (500): <HTML><HEAD>...
[v0] Retrying in 1000ms...

// If retry succeeds:
[v0] Token Request (Attempt 2/2):
[v0] Token obtained successfully (expires in 3600s)

// If all attempts fail:
[v0] Token request error: Co-op Bank token request failed (500)
```

### Step 4: Check Network/Connectivity
```bash
# Test if Co-op Bank API is reachable
curl -I https://openapi.co-opbank.co.ke/token

# Should return 405 (Method Not Allowed for GET) or similar
# 500 = Server error
# Connection refused = Network issue
```

### Step 5: Verify Credentials in Postman
1. Open your Postman collection: `SANDRA_OTIENO_SCHOLINE.postman_collection.json`
2. Go to Token request → Authorization tab
3. Check the "Basic Auth" credentials match your env var
4. Click "Preview Request Headers"
5. Verify the Authorization header matches COOP_BANK_BASIC_AUTH

## Root Causes of HTTP 500

### Most Common:
1. **Invalid Credentials**
   - Client ID or Secret wrong
   - Credentials expired
   - Not Base64 encoded properly
   - Missing "Basic " prefix

2. **Co-op Bank API Down**
   - Sandbox environment offline
   - Maintenance window
   - API version changed

3. **Wrong Environment**
   - Using sandbox credentials in production
   - Using production credentials in sandbox

### Less Common:
- Malformed request body
- Missing required headers
- Rate limiting (though returns 429)
- Timeout (though code handles with retry)

## What to Check

### Environment Variables
```bash
# SSH into server and check:
echo $COOP_BANK_BASIC_AUTH
# Should print: Basic MktETXRDZnpfSHZscU...

# Check for hidden characters:
echo $COOP_BANK_BASIC_AUTH | od -c
# Should show: B a s i c [space] [base64 chars]
# NOT: B a s i c [space] [base64 chars] [newline]
```

### Database Transaction Records
Check if tokens are cached (debugging):
```javascript
// In MongoDB
db.mpesatransactions.findOne({ status: 'completed' })
// If populated = at least one token request succeeded
```

## Next Steps if Still Failing

1. **Verify Postman Works**
   - Import collection
   - Run Token request
   - If succeeds → Code has bug
   - If fails → Credentials invalid

2. **Check Co-op Bank Status**
   - Contact Co-op Bank support
   - Verify sandbox is accessible
   - Ask if API is in maintenance

3. **Test with Simple Script**
```bash
node -e "
const auth = process.env.COOP_BANK_BASIC_AUTH;
console.log('Auth header:', auth);
console.log('Starts with Basic:', auth.startsWith('Basic'));
console.log('Length:', auth.length);
fetch('https://openapi.co-opbank.co.ke/token', {
  method: 'POST',
  headers: {
    'Authorization': auth,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: 'grant_type=client_credentials',
}).then(r => r.text()).then(console.log).catch(console.error)
"
```

4. **Check Logs for Pattern**
   - HTTP 500 on first attempt but then works? → API recovers on retry (normal)
   - HTTP 401? → Invalid credentials
   - HTTP 400? → Malformed request
   - Timeout? → Network connectivity issue

## Console Log Reference

### Success Flow
```
[v0] Token Request (Attempt 1/2):
[v0] STK Push Request Details:
[v0] STK Push Payload: {...}
[v0] STK Push Response Status: 200
[v0] STK Push Success Response: {...}
[v0] Normalizing STK Push response: MessageCode->ResponseCode
```

### Failure Flow
```
[v0] Token request failed (500): <HTML>...
[v0] Retrying in 1000ms...
[v0] Token Request (Attempt 2/2):
[v0] Token request failed (500): <HTML>...
[v0] Token request error: Co-op Bank token request failed (500)
```

## Related Files
- `app/lib/services/coop-bank.ts` - Token and STK implementation
- `PAYMENT_TIMEOUT_RECOVERY_FIX.md` - Timeout and retry strategy
- `STK_TOKEN_FRESH_STRATEGY.md` - Fresh token strategy details

---

**Last Updated:** After scope and error logging fixes
**Related Issues:** HTTP 500 token endpoint errors, STK Push failures
**Contact:** Check Co-op Bank API documentation and support
