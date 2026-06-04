# Co-operative Bank Response Codes & Polling Strategy

## Problem: Response Code 1037 Not Recognized

When user cancels STK prompt, Co-op Bank returns:
```json
{
  "MessageCode": "1037",
  "MessageDescription": "No response from user."
}
```

The system was treating this as intermediate (continue polling), but it's actually a terminal state (user cancelled/timeout).

Result: System kept querying indefinitely even after user cancelled payment.

## Solution: Proper Response Code Mapping

### Terminal States (STOP POLLING)

| Code | Status | Description | Action |
|------|--------|-------------|--------|
| `'0'` | `completed` | Payment successful | ✅ Credit balance |
| `'2001'` | `timeout` | User timeout | ❌ Stop polling |
| `'2002'` | `cancelled` | User cancelled STK | ❌ Stop polling |
| `'1037'` | `timeout` | No response from user | ❌ Stop polling |
| Other | `failed` | Error/unknown code | ❌ Stop polling |

### Processing States (CONTINUE POLLING)

| Code | Status | Description | Action |
|------|--------|-------------|--------|
| `'1'` | `pending` | Processing (legacy) | ⏳ Poll again |
| `'S_001'` | `pending` | Processing (standard) | ⏳ Poll again |
| `'S_*'` | `pending` | Intermediate state | ⏳ Poll again |

## Endpoints Used (from Postman collection)

### 1. Token Request
```
POST https://openapi.co-opbank.co.ke/token
Authorization: Basic <COOP_BANK_BASIC_AUTH>
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

**Response:** Bearer token (expires 3600s)

### 2. STK Push
```
POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "MessageReference": "ACT1780555885209NR08A0",
  "CallBackUrl": "https://yourdomain.com/ftresponse",
  "OperatorCode": "SANDRA",
  "TransactionCurrency": "KES",
  "MobileNumber": "254707919065",
  "Narration": "Activation fee - ians~2026-06-04",
  "Amount": 90,
  "MessageDateTime": "2026-06-04T09:22:25.420Z",
  "OtherDetails": [
    {
      "Name": "ReferenceNumber",
      "Value": "ACT1780555885209NR08A0"
    }
  ]
}
```

**Response:** Metadata with status code

### 3. Status Check
```
POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "MessageReference": "ACT1780555885209NR08A0"
}
```

**Response:** Transaction status with MessageCode

## Transaction Flow

### Successful Payment Flow
```
1. Initiate STK Push
   → POST /FT/stk/1.0.0 with Bearer token
   → Response: MessageCode: "0" (success)
   
2. Poll Status
   → First poll: MessageCode: "S_001" (PROCESSING)
   → Mapped to status: 'pending'
   → Continue polling
   
3. User Enters PIN
   → Bank processes payment
   
4. Next Poll
   → MessageCode: "0" (success)
   → Mapped to status: 'completed'
   → Stop polling, credit balance
```

### User Cancels Flow
```
1. Initiate STK Push
   → POST /FT/stk/1.0.0 with Bearer token
   → Response: MessageCode: "0" (accepted)
   
2. Poll Status
   → First poll: MessageCode: "S_001" (PROCESSING)
   → Mapped to status: 'pending'
   → Continue polling
   
3. User Cancels STK
   → Bank stops waiting
   
4. Next Poll
   → MessageCode: "1037" (NO RESPONSE)
   → Mapped to status: 'timeout'
   → Stop polling, mark as failed
```

## Console Logs to Verify

### Successful Polling
```
[v0] STK Status Request:
[v0]   Message Reference: ACT1780555885209NR08A0
[v0]   Status Endpoint URL: https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0
[v0]   Bearer Token: Basic MktETXRDZnpfSH...pWMFZBbGNh

[v0] STK Status Request Payload: {
  "MessageReference": "ACT1780555885209NR08A0"
}

[v0] STK Status Response Status: 200
[v0] STK Status Endpoint URL used: https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0

[v0] STK Status Result: {
  "MessageCode": "1037",
  "MessageDescription": "No response from user."
}

[v0] Terminal error code: 1037 - stopping polling
```

## Fixed Behavior

### Before Fix
- User cancels STK → Response code 1037
- System treats as intermediate → keeps polling
- Result: Infinite queries ❌

### After Fix
- User cancels STK → Response code 1037
- System maps 1037 to 'timeout' (terminal)
- Polling stops immediately ✅
- User shown "Payment Cancelled" ✅

## Environment Variables

```
COOP_BANK_BASIC_AUTH=Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx...
COOP_BANK_OPERATOR_CODE=SANDRA
COOP_BANK_BASE_URL=https://openapi.co-opbank.co.ke
COOP_BANK_TOKEN_ENDPOINT=/token
COOP_BANK_STK_PUSH_ENDPOINT=/FT/stk/1.0.0
COOP_BANK_STK_STATUS_ENDPOINT=/Enquiry/STK/1.0.0
```

## Testing Checklist

- [ ] Initiate activation payment (STK shows on phone)
- [ ] Check logs show correct endpoint URLs
- [ ] Check logs show Bearer token is included
- [ ] Check logs show request payload is correct
- [ ] User enters PIN: verify status becomes 'completed'
- [ ] User cancels STK: verify MessageCode '1037' returned
- [ ] Verify status mapped to 'timeout' (terminal)
- [ ] Verify polling stops (no more queries)
- [ ] Verify UI shows correct status (not "Processing" forever)

## Response Code Reference (Complete)

All known Co-op Bank response codes:

| Code | Meaning | Maps To | Terminal? |
|------|---------|---------|-----------|
| 0 | Success | completed | Yes |
| 1 | Processing | pending | No |
| 1037 | No response from user | timeout | Yes |
| 2001 | Request timeout | timeout | Yes |
| 2002 | User cancelled | cancelled | Yes |
| S_001 | Transaction processing | pending | No |
| S_* (other) | Intermediate state | pending | No |
| Other | Error/Unknown | failed | Yes |

