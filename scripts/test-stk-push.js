/**
 * Test STK Push Initiation
 * 
 * This script simulates the complete STK Push flow without going through
 * the web UI. Useful for debugging the payment integration.
 * 
 * Usage:
 *   node scripts/test-stk-push.js --phone 254707919065 --amount 1
 * 
 * Environment vars required:
 *   - COOP_BANK_BASIC_AUTH
 *   - COOP_BANK_OPERATOR_CODE
 *   - NEXT_PUBLIC_BASE_URL (for callback URL)
 *   - MONGODB_URI (to store transaction record)
 *   - NEXTAUTH_SECRET (for session - use test user)
 */

require('dotenv').config();

const baseUrl = process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke';
const basicAuth = process.env.COOP_BANK_BASIC_AUTH;
const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
const nextPublicBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

// Parse command-line arguments
const args = process.argv.slice(2);
let phoneNumber = '254707919065';
let amount = 1;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--phone' && args[i + 1]) phoneNumber = args[++i];
  if (args[i] === '--amount' && args[i + 1]) amount = parseFloat(args[++i]);
}

console.log('\n🔍 Co-operative Bank STK Push Test\n');
console.log('─'.repeat(60));

// ============================================================================
// STEP 1: Validate Environment Variables
// ============================================================================

console.log('\n📋 Step 1: Validating Environment Variables');
console.log('─'.repeat(60));

if (!basicAuth) {
  console.error('❌ Missing COOP_BANK_BASIC_AUTH');
  process.exit(1);
}

if (!operatorCode) {
  console.error('❌ Missing COOP_BANK_OPERATOR_CODE');
  process.exit(1);
}

if (!nextPublicBaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_BASE_URL');
  process.exit(1);
}

console.log('✓ COOP_BANK_BASIC_AUTH: Set');
console.log('✓ COOP_BANK_OPERATOR_CODE:', operatorCode);
console.log('✓ Base URL:', baseUrl);
console.log('✓ Callback Base URL:', nextPublicBaseUrl);

// ============================================================================
// STEP 2: Get Bearer Token
// ============================================================================

async function getToken() {
  console.log('\n📋 Step 2: Obtaining Bearer Token');
  console.log('─'.repeat(60));

  const tokenUrl = `${baseUrl}/token`;
  console.log(`POST ${tokenUrl}`);
  console.log(`Authorization: ${basicAuth.substring(0, 30)}...`);

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Token request failed (${response.status}):`, error);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✓ Token obtained successfully');
    console.log(`✓ Expires in: ${data.expires_in} seconds`);

    return data.access_token;
  } catch (error) {
    console.error('❌ Token request error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// STEP 3: Initiate STK Push
// ============================================================================

async function initiateSTKPush(token) {
  console.log('\n📋 Step 3: Initiating STK Push');
  console.log('─'.repeat(60));

  const messageReference = `TEST${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const callbackUrl = `${nextPublicBaseUrl}/api/payments/coop-bank/callback`;

  // Normalize phone
  const digits = phoneNumber.replace(/\D/g, '');
  let normalizedPhone = digits;
  if (digits.startsWith('0') && digits.length === 10) {
    normalizedPhone = `254${digits.slice(1)}`;
  } else if (digits.startsWith('7') && digits.length === 9) {
    normalizedPhone = `254${digits}`;
  }

  console.log('Phone:', normalizedPhone);
  console.log('Amount:', amount, 'KES');
  console.log('Message Reference:', messageReference);
  console.log('Callback URL:', callbackUrl);

  const payload = {
    MessageReference: messageReference,
    CallBackUrl: callbackUrl,
    OperatorCode: operatorCode,
    TransactionCurrency: 'KES',
    MobileNumber: normalizedPhone,
    Narration: 'Test Payment',
    Amount: Math.floor(amount),
    MessageDateTime: new Date().toISOString(),
    OtherDetails: [
      {
        Name: 'ReferenceNumber',
        Value: messageReference,
      },
    ],
  };

  console.log('\nPayload:');
  console.log(JSON.stringify(payload, null, 2));

  const stkUrl = `${baseUrl}/FT/stk/1.0.0`;

  try {
    const response = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`\nPOST ${stkUrl}`);
    console.log(`Status: ${response.status}`);

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ STK Push failed:');
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }

    console.log('\n✓ STK Push initiated successfully');
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));

    return { messageReference, result };
  } catch (error) {
    console.error('❌ STK Push request error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// STEP 4: Query Transaction Status
// ============================================================================

async function queryStatus(token, messageReference) {
  console.log('\n📋 Step 4: Querying Transaction Status');
  console.log('─'.repeat(60));

  const statusUrl = `${baseUrl}/Enquiry/STK/1.0.0/`;

  const payload = { MessageReference: messageReference };

  console.log(`POST ${statusUrl}`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`Status: ${response.status}`);

    const result = await response.json();

    console.log('\n✓ Status query successful');
    console.log('Response:');
    console.log(JSON.stringify(result, null, 2));

    // Map response code
    let status = 'unknown';
    switch (result.ResponseCode) {
      case '0':
        status = 'Completed';
        break;
      case '1':
        status = 'Pending (user being prompted)';
        break;
      case '2001':
        status = 'Timeout';
        break;
      case '2002':
        status = 'User Cancelled';
        break;
      default:
        status = 'Failed';
    }

    console.log(`\nPayment Status: ${status}`);

    return result;
  } catch (error) {
    console.error('❌ Status query error:', error.message);
    process.exit(1);
  }
}

// ============================================================================
// MAIN
// ============================================================================

(async () => {
  try {
    const token = await getToken();
    const { messageReference, result } = await initiateSTKPush(token);

    console.log('\n📋 Step 5: Next Steps');
    console.log('─'.repeat(60));

    if (result.ResponseCode === '0') {
      console.log('✓ STK Push was accepted by the bank');
      console.log('  - User should see M-Pesa prompt on their phone');
      console.log('  - Message Reference:', messageReference);
      console.log('  - Check status command:');
      console.log(`    node scripts/test-stk-push.js --check ${messageReference}`);
    } else {
      console.log('⚠ STK Push was not successful');
      console.log('  Response Code:', result.ResponseCode);
      console.log('  Description:', result.ResponseDescription);
    }

    console.log('\n✓ Test Complete\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
})();
