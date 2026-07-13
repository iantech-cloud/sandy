# 🚀 HashBack Integration - Ready to Build

## One-Minute Overview

**What:** Integrate HashBack as primary payment provider  
**Why:** Faster, simpler, real-time confirmations  
**When:** 3 weeks to production  
**How:** 8 new files + 5 file updates  

---

## Documentation Structure

```
📁 Sandy Project Root
│
├── 📄 HASHBACK_INTEGRATION.md ⭐ PRIMARY
│   └── 453 lines - Complete implementation guide
│   └── Read this first!
│
├── 📄 QUICK_REFERENCE.md
│   └── 153 lines - Code snippets, commands, checklists
│
├── 📄 IMPLEMENTATION_SUMMARY.md
│   └── 161 lines - What changed, why, timeline
│
├── 📄 DELIVERABLES.txt
│   └── Complete checklist of all deliverables
│
└── 📄 README_HASHBACK.md (this file)
    └── Quick navigation guide
```

---

## What's Being Built

### ✅ Withdrawable Wallets (2 ONLY)

**Chat Foreigners Earnings**
```
KES 0.10 per message
├─ Daily limit: KES 100
├─ Withdrawable: YES ✅
├─ Fee: 10%
└─ Min/Max: KES 10 - KES 50,000
```

**Spin Wallet**
```
KES 30 deposits via HashBack
├─ Company gets: 20% (KES 6)
├─ Withdrawable: YES ✅ (free transfer)
├─ Can re-spin
└─ Can transfer to Chat Foreigners
```

### ❌ Non-Withdrawable (Gaming Only)

- **Aviator:** 50% house edge, play-only ❌
- **Casino:** 50% house edge, play-only ❌
- **Referrals:** Locked in main wallet ❌

---

## Files to Create (8)

```
Services:
  └── app/lib/services/hashback.ts

API Routes:
  ├── app/api/hashback/webhook/route.ts
  ├── app/api/hashback/payment/initiate/route.ts
  ├── app/api/hashback/withdrawal/route.ts
  └── app/api/hashback/balance/route.ts

Server Actions:
  └── app/actions/chat-foreigners-wallet.ts

Components:
  ├── app/components/chat-foreigners-earnings.tsx
  └── app/components/withdraw-button.tsx
```

---

## Files to Modify (5)

```
Configuration:
  └── .env.local (add 3 variables)

Database:
  └── app/lib/models.ts

Business Logic:
  ├── app/actions/chat-foreigners/payments.ts
  └── app/actions/activation.ts

UI:
  └── Dashboard components
```

---

## Environment Setup

```bash
# Copy to .env.local
HASHBACK_API_KEY=your-api-key
HASHBACK_ACCOUNT_ID=your-account-id
HASHBACK_WEBHOOK_SECRET=your-webhook-secret
```

Get from: https://hashback.co.ke/ → Settings

---

## Key Metrics

### Revenue (Monthly)
| Source | Amount |
|--------|--------|
| Activation | KES 47,500 |
| Bot Unlocks | KES 20,000 |
| Spin Revenue | KES 30,000 |
| Aviator | KES 5,000,000 |
| Casino | KES 5,000,000 |
| **TOTAL** | **KES 10,097,500+** |

### Fees & Limits
| Item | Value |
|------|-------|
| Withdrawal Fee | 10% |
| Min Withdrawal | KES 10 |
| Max Withdrawal | KES 50,000 |
| Daily Earn Cap | KES 100 |
| House Edge | 50% (gaming) |

---

## Critical Security: Webhook Verification

```typescript
import crypto from 'crypto';

// MUST verify every webhook before processing
function verify(rawBody: string, signature: string): boolean {
  const secret = process.env.HASHBACK_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(expected, signature);
}
```

**DO NOT skip this** - Security-critical!

---

## Testing Checklist

- [ ] Read HASHBACK_INTEGRATION.md
- [ ] Webhook signature verification works
- [ ] Payment flow (HashBack) works
- [ ] Payment flow (Co-op fallback) works
- [ ] Chat earnings accumulate correctly
- [ ] Spin wallet deposits work
- [ ] Withdrawal calculates 10% fee
- [ ] Min/Max limits enforced
- [ ] Rate limiting works
- [ ] Admin dashboard accurate

---

## Timeline

**Week 1:** Build infrastructure  
**Week 2:** Build business logic + UI  
**Week 3:** Test, QA, deploy  

---

## Quick Links

| Resource | Link |
|----------|------|
| HashBack | https://hashback.co.ke/ |
| API Docs | https://api.hashback.co.ke/ |
| Support | hashbacksolutions@gmail.com |
| Implementation | HASHBACK_INTEGRATION.md |
| Reference | QUICK_REFERENCE.md |

---

## FAQ

**Q: Can users withdraw from Aviator?**  
A: No. Aviator is gaming-only with 50% house edge.

**Q: Can users withdraw referral earnings?**  
A: No. Referral earnings are locked in main wallet.

**Q: How fast is withdrawal?**  
A: 10-30 seconds to M-Pesa.

**Q: What if HashBack is down?**  
A: Automatic fallback to Co-op Bank.

**Q: Do I need to read the long document?**  
A: Yes. HASHBACK_INTEGRATION.md has all the details.

---

## Start Here 👇

1. **Read:** `HASHBACK_INTEGRATION.md` (453 lines)
2. **Reference:** `QUICK_REFERENCE.md` (code snippets)
3. **Review:** `IMPLEMENTATION_SUMMARY.md` (what changed)
4. **Build:** 8 new files + modify 5 files
5. **Test:** Use checklist from QUICK_REFERENCE.md
6. **Deploy:** Production ready!

---

**Status:** Ready for development ✅  
**Last Updated:** 2026-07-13  
**Version:** 1.0

