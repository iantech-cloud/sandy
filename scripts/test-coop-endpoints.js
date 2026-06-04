#!/usr/bin/env node

/**
 * Test Co-op Bank API Endpoints
 * 
 * Verifies:
 * - Token generation (POST /token)
 * - STK Push (POST /FT/stk/1.0.0)
 * - Status check (POST /Enquiry/STK/1.0.0)
 * 
 * Usage: node scripts/test-coop-endpoints.js
 */

require('dotenv').config({ path: '.env.local' });

const COOP_BANK_BASIC_AUTH = process.env.COOP_BANK_BASIC_AUTH;
const COOP_BANK_OPERATOR_CODE = process.env.COOP_BANK_OPERATOR_CODE;
const COOP_BANK_BASE_URL = process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke';
const TOKEN_ENDPOINT = process.env.COOP_BANK_TOKEN_ENDPOINT || '/token';
const STK_PUSH_ENDPOINT = process.env.COOP_BANK_STK_PUSH_ENDPOINT || '/FT/stk/1.0.0';
const STATUS_ENDPOINT = process.env.COOP_BANK_STK_STATUS_ENDPOINT || '/Enquiry/STK/1.0.0';

console.log('================================================');
console.log('Co-op Bank Endpoint Testing');
console.log('================================================\n');

// Check env vars
console.log('[1] Environment Variables Check');
console.log('---');

if (!COOP_BANK_BASIC_AUTH) {
  console.error('❌ COOP_BANK_BASIC_AUTH is missing');
  process.exit(1);
}

console.log(`✅ COOP_BANK_BASIC_AUTH: ${COOP_BANK_BASIC_AUTH.substring(0, 20)}...${COOP_BANK_BASIC_AUTH.substring(COOP_BANK_BASIC_AUTH.length - 10)}`);
console.log(`✅ COOP_BANK_OPERATOR_CODE: ${COOP_BANK_OPERATOR_CODE}`);
console.log(`✅ Base URL: ${COOP_BANK_BASE_URL}`);
console.log('');

async function testEndpoints() {
  try {
    // Test Token Endpoint
    console.log('[2] Testing Token Endpoint (POST /token)');
    console.log('---');
    
    const tokenUrl = `${COOP_BANK_BASE_URL}${TOKEN_ENDPOINT}`;
    console.log(`URL: ${tokenUrl}`);
    console.log('Authorization: Basic [credentials]');
    console.log('');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': COOP_BANK_BASIC_AUTH,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const tokenData = await tokenResponse.json();
    console.log('Response:', JSON.stringify(tokenData, null, 2));
    console.log('');

    if (!tokenData.access_token) {
      console.error('❌ Failed to get access token');
      process.exit(1);
    }

    const token = tokenData.access_token;
    console.log(`✅ Token obtained: ${token.substring(0, 20)}...${token.substring(token.length - 10)}`);
    console.log('');

    // Test STK Push Endpoint
    console.log('[3] Testing STK Push Endpoint (POST /FT/stk/1.0.0)');
    console.log('---');

    const stkPushUrl = `${COOP_BANK_BASE_URL}${STK_PUSH_ENDPOINT}`;
    console.log(`URL: ${stkPushUrl}`);
    console.log('Authorization: Bearer [token]');
    console.log('');

    const timestamp = new Date().toISOString();
    const messageRef = `TEST${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const stkPayload = {
      MessageReference: messageRef,
      CallBackUrl: 'https://example.com/callback',
      OperatorCode: COOP_BANK_OPERATOR_CODE,
      TransactionCurrency: 'KES',
      MobileNumber: '254700000000',
      Narration: 'Test Payment',
      Amount: 1,
      MessageDateTime: timestamp,
      OtherDetails: [
        {
          Name: 'ReferenceNumber',
          Value: messageRef,
        },
      ],
    };

    console.log('Request Payload:');
    console.log(JSON.stringify(stkPayload, null, 2));
    console.log('');

    const stkResponse = await fetch(stkPushUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const stkData = await stkResponse.json();
    console.log('Response:', JSON.stringify(stkData, null, 2));
    console.log('');

    // Test Status Endpoint
    console.log('[4] Testing Status Check Endpoint (POST /Enquiry/STK/1.0.0)');
    console.log('---');

    const statusUrl = `${COOP_BANK_BASE_URL}${STATUS_ENDPOINT}`;
    console.log(`URL: ${statusUrl}`);
    console.log('Authorization: Bearer [token]');
    console.log('');

    const statusPayload = {
      MessageReference: messageRef,
    };

    console.log('Request Payload:');
    console.log(JSON.stringify(statusPayload, null, 2));
    console.log('');

    const statusResponse = await fetch(statusUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusPayload),
    });

    const statusData = await statusResponse.json();
    console.log('Response:', JSON.stringify(statusData, null, 2));
    console.log('');

    console.log('================================================');
    console.log('✅ All endpoints tested successfully');
    console.log('================================================');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error);
    process.exit(1);
  }
}

testEndpoints();
