# Co-operative Bank Authentication - Quick Reference

## ⚡ Quick Setup (5 minutes)

### 1️⃣ Get Bearer Token from Postman Collection

Open: `SANDRA OTIENO SCHOLINE.postman_collection.json`
Find: "Token" request → "Authorization" header
Copy: The entire value starting with `Basic`

Example:
```
Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
```

### 2️⃣ Update `.env.local` (or `.env.production.local`)

**Remove (old format):**
```bash
COOP_CLIENT_ID=...
COOP_CLIENT_SECRET=...
COOP_BASE_URL=...
COOP_TOKEN_URL=...
COOP_STK_PUSH_URL=...
COOP_STK_STATUS_URL=...
```

**Add (new format):**
```bash
# OAuth2 Bearer Token Authentication
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQxTFdVYTpVVkM3ZGM0NDhKZWxtZXBIb3ZuZnpWMFZBbGNh
COOP_BANK_OPERATOR_CODE=SANDRA

# Optional (defaults shown)
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0/
```

### 3️⃣ Verify Setup

```bash
# Check environment variables
node scripts/validate-env.js

# Test Bearer token request
node scripts/test-coop-token.js
```

✅ Done! Your Co-operative Bank integration is ready.

---

## 📋 Environment Variables

| Variable | Required | Example | Description |
|----------|----------|---------|-------------|
| `COOP_BANK_BASIC_AUTH` | ✅ Yes | `Basic MktETXRDZnp...` | Pre-encoded Bearer token (from Postman) |
| `COOP_BANK_OPERATOR_CODE` | ✅ Yes | `SANDRA` | Your operator code |
| `COOP_BANK_BASE_URL` | ❌ No | `https://openapi.co-opbank.co.ke` | API base URL (default: production) |
| `COOP_BANK_TOKEN_ENDPOINT` | ❌ No | `/token` | Token endpoint path |
| `COOP_BANK_STK_PUSH_ENDPOINT` | ❌ No | `/FT/stk/1.0.0` | STK push endpoint path |
| `COOP_BANK_STK_STATUS_ENDPOINT` | ❌ No | `/Enquiry/STK/1.0.0/` | Status check endpoint path |

---

## 🔧 Common Tasks

### Test Token Endpoint
```bash
node scripts/test-coop-token.js
```

### Validate All Config
```bash
node scripts/validate-env.js
```

### Initiate STK Push (API)
```bash
POST /api/payments/coop-bank/stk-push
{
  "amount": 100,
  "phoneNumber": "254707919065",
  "narration": "Payment for order",
  "depositType": "wallet"
}
```

### Check Transaction Status (API)
```bash
POST /api/payments/coop-bank/status
{
  "messageReference": "SANDY{timestamp}{random}"
}
```

---

## ❌ Common Mistakes

| Mistake | Fix |
|---------|-----|
| Missing `Basic ` prefix | Copy entire value from Postman including "Basic " |
| Using old `COOP_CLIENT_ID` | Switch to `COOP_BANK_BASIC_AUTH` |
| Spaces in bearer token | Ensure no leading/trailing spaces |
| Wrong endpoint paths | Use paths: `/token`, `/FT/stk/1.0.0`, `/Enquiry/STK/1.0.0/` |
| Sandbox credentials | Ensure using production credentials |

---

## 🔐 Security Notes

✅ **DO:**
- Store `COOP_BANK_BASIC_AUTH` in environment variables only
- Add `.env.local` and `.env.production.local` to `.gitignore`
- Rotate credentials periodically with Co-operative Bank
- Use HTTPS for all payment endpoints

❌ **DON'T:**
- Commit `COOP_BANK_BASIC_AUTH` to version control
- Log the Bearer token value
- Share credentials in plain text
- Use sandbox credentials in production

---

## 📚 Database Integration

**No schema changes needed!** Your MongoDB `MpesaTransaction` collection continues to work:

```javascript
{
  _id: ObjectId,
  user_id: String,
  amount_cents: Number,
  phone_number: String,        // e.g., "254707919065"
  status: String,              // "initiated", "pending", "completed", "failed"
  source: String,              // "coop_bank"
  checkout_request_id: String, // messageReference from Co-op Bank
  is_activation_payment: Boolean,
  metadata: {
    deposit_type: String,      // "wallet", "spin_wallet", "activation"
    message_reference: String,
    payment_method: String,    // "coop_bank_stk_push"
    revenue_target: String,    // "user" or "company"
    initiated_at: ISODate
  },
  created_at: ISODate,
  updated_at: ISODate,
  completed_at: ISODate        // Set when payment completes
}
```

---

## 🆘 Troubleshooting

### "Missing env var: COOP_BANK_BASIC_AUTH"
Add the Bearer token to your `.env.local` file (see Quick Setup above)

### "HTTP 401: Unauthorized"
1. Copy exact value from Postman (including "Basic " prefix)
2. Check for extra spaces
3. Verify production credentials (not sandbox)

### "Token request failed"
1. Run `node scripts/test-coop-token.js` for detailed diagnostics
2. Check internet connectivity
3. Verify Co-operative Bank API is accessible

### STK Push not showing on phone
1. Verify phone number format: `254XXXXXXXXX`
2. Check amount: minimum 1 KES
3. Check narration: max 60 characters
4. Ensure payment method is not restricted on M-Pesa account

### Transaction status shows "PROCESSING" forever
1. Check polling is running (see logs)
2. Verify token doesn't expire during polling (rare)
3. Check Co-operative Bank API logs for errors

---

## 📞 Support

For issues:
1. **Run diagnostics**: `node scripts/test-coop-token.js`
2. **Check config**: `node scripts/validate-env.js`
3. **Review logs**: Look for `[v0]` prefixed messages
4. **Read docs**: See `COOP_BANK_AUTH_MIGRATION.md` for detailed info
5. **Contact Co-op Bank**: If credentials are invalid

---

## 🎉 You're All Set!

Your Co-operative Bank integration now uses:
- ✅ OAuth2 Bearer token authentication
- ✅ Pre-encoded credentials from Postman
- ✅ Automatic token refresh during polling
- ✅ MongoDB persistence (no schema changes)
- ✅ Complete error handling & logging

Happy payments! 💳
