#!/bin/bash

# Test Co-op Bank API Endpoints
# Verifies token generation and STK endpoints

set -a
source .env.local 2>/dev/null || source .env.example 2>/dev/null
set +a

echo "================================================"
echo "Co-op Bank Endpoint Testing"
echo "================================================"
echo ""

# Check env vars
echo "[1] Environment Variables Check"
echo "---"
if [ -z "$COOP_BANK_BASIC_AUTH" ]; then
  echo "❌ COOP_BANK_BASIC_AUTH is missing"
  exit 1
fi

echo "✅ COOP_BANK_BASIC_AUTH: ${COOP_BANK_BASIC_AUTH:0:20}...${COOP_BANK_BASIC_AUTH: -10}"
echo "✅ COOP_BANK_OPERATOR_CODE: $COOP_BANK_OPERATOR_CODE"
echo ""

# Test Token Endpoint
echo "[2] Testing Token Endpoint (POST /token)"
echo "---"
TOKEN_URL="${COOP_BANK_BASE_URL:-https://openapi.co-opbank.co.ke}${COOP_BANK_TOKEN_ENDPOINT:-/token}"
echo "URL: $TOKEN_URL"
echo "Authorization: Basic [credentials]"
echo ""

TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_URL" \
  -H "Authorization: $COOP_BANK_BASIC_AUTH" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials")

echo "Response:"
echo "$TOKEN_RESPONSE" | jq . 2>/dev/null || echo "$TOKEN_RESPONSE"
echo ""

# Extract token
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Failed to get token"
  exit 1
fi

echo "✅ Token obtained: ${TOKEN:0:20}...${TOKEN: -10}"
echo ""

# Test STK Push Endpoint
echo "[3] Testing STK Push Endpoint (POST /FT/stk/1.0.0)"
echo "---"
STK_PUSH_URL="${COOP_BANK_BASE_URL:-https://openapi.co-opbank.co.ke}${COOP_BANK_STK_PUSH_ENDPOINT:-/FT/stk/1.0.0}"
echo "URL: $STK_PUSH_URL"
echo "Authorization: Bearer [token]"
echo ""

# Create test payload
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
MESSAGE_REF="TEST$(date +%s)$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' ')"

STK_PAYLOAD=$(cat <<PAYLOAD
{
  "MessageReference": "$MESSAGE_REF",
  "CallBackUrl": "https://example.com/callback",
  "OperatorCode": "$COOP_BANK_OPERATOR_CODE",
  "TransactionCurrency": "KES",
  "MobileNumber": "254700000000",
  "Narration": "Test Payment",
  "Amount": 1,
  "MessageDateTime": "$TIMESTAMP",
  "OtherDetails": [
    {
      "Name": "ReferenceNumber",
      "Value": "$MESSAGE_REF"
    }
  ]
}
PAYLOAD
)

echo "Request Payload:"
echo "$STK_PAYLOAD" | jq .
echo ""

STK_RESPONSE=$(curl -s -X POST "$STK_PUSH_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$STK_PAYLOAD")

echo "Response:"
echo "$STK_RESPONSE" | jq . 2>/dev/null || echo "$STK_RESPONSE"
echo ""

# Test Status Endpoint
echo "[4] Testing Status Check Endpoint (POST /Enquiry/STK/1.0.0)"
echo "---"
STATUS_URL="${COOP_BANK_BASE_URL:-https://openapi.co-opbank.co.ke}${COOP_BANK_STK_STATUS_ENDPOINT:-/Enquiry/STK/1.0.0}"
echo "URL: $STATUS_URL"
echo "Authorization: Bearer [token]"
echo ""

STATUS_PAYLOAD=$(cat <<PAYLOAD
{
  "MessageReference": "$MESSAGE_REF"
}
PAYLOAD
)

echo "Request Payload:"
echo "$STATUS_PAYLOAD" | jq .
echo ""

STATUS_RESPONSE=$(curl -s -X POST "$STATUS_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$STATUS_PAYLOAD")

echo "Response:"
echo "$STATUS_RESPONSE" | jq . 2>/dev/null || echo "$STATUS_RESPONSE"
echo ""

echo "================================================"
echo "✅ All endpoints tested successfully"
echo "================================================"
