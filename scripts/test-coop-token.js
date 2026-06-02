#!/usr/bin/env node

/**
 * Diagnostic script to test Co-operative Bank token request
 * 
 * Usage:
 *   node scripts/test-coop-token.js
 * 
 * This script:
 * 1. Verifies environment variables are loaded
 * 2. Tests the token request with proper base64 encoding
 * 3. Provides detailed error messages
 */

const path = require('path');

// Load environment variables from .env.local or .env.production.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.production.local') });

async function testCoopBankToken() {
  console.log('🔍 Co-operative Bank Token Request Diagnostic\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking Environment Variables');
  console.log('─'.repeat(50));

  const clientId = process.env.COOP_CLIENT_ID;
  const clientSecret = process.env.COOP_CLIENT_SECRET;
  const operatorCode = process.env.COOP_OPERATOR_CODE;
  const tokenUrl = process.env.COOP_TOKEN_URL || 'https://openapi.co-opbank.co.ke/token';

  console.log(`COOP_CLIENT_ID: ${clientId ? '✅ SET' : '❌ MISSING'} (length: ${clientId?.length || 0})`);
  console.log(`COOP_CLIENT_SECRET: ${clientSecret ? '✅ SET' : '❌ MISSING'} (length: ${clientSecret?.length || 0})`);
  console.log(`COOP_OPERATOR_CODE: ${operatorCode ? '✅ SET' : '❌ MISSING'}`);
  console.log(`Token URL: ${tokenUrl}`);

  if (!clientId || !clientSecret || !operatorCode) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Make sure .env.local or .env.production.local has:');
    console.error('   - COOP_CLIENT_ID');
    console.error('   - COOP_CLIENT_SECRET');
    console.error('   - COOP_OPERATOR_CODE');
    process.exit(1);
  }

  console.log('\n✅ All environment variables are set\n');

  // Step 2: Test Base64 encoding
  console.log('📋 Step 2: Testing Base64 Encoding');
  console.log('─'.repeat(50));

  const authString = `${clientId}:${clientSecret}`;
  const credentials = Buffer.from(authString).toString('base64');

  console.log(`Auth String: ${clientId}:${clientSecret}`);
  console.log(`Base64 Encoded: ${credentials}`);
  console.log(`Length: ${credentials.length} characters\n`);

  // Step 3: Attempt token request
  console.log('📋 Step 3: Attempting Token Request');
  console.log('─'.repeat(50));

  try {
    console.log(`POST ${tokenUrl}`);
    console.log(`Authorization: Basic ${credentials}`);
    console.log(`Content-Type: application/x-www-form-urlencoded`);
    console.log(`Body: grant_type=client_credentials\n`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    console.log(`Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();
    let responseData;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    console.log(`Response Body:`, JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log('\n✅ SUCCESS! Token request succeeded');
      if (responseData.access_token) {
        console.log(`✅ Received access token (expires in ${responseData.expires_in}s)`);
      }
    } else {
      console.log('\n❌ FAILED! Token request rejected\n');

      // Provide specific error guidance
      if (response.status === 401) {
        console.log('🔴 HTTP 401: Unauthorized');
        if (responseData.error === 'invalid_client') {
          console.log('   Error: invalid_client');
          console.log('   This means the client credentials are not recognized.');
          console.log('\n   Troubleshooting:');
          console.log('   1. Verify your credentials with Co-operative Bank');
          console.log('   2. Check that COOP_CLIENT_ID and COOP_CLIENT_SECRET match exactly');
          console.log('   3. Ensure credentials are for the Production environment (not Sandbox)');
          console.log('   4. Check for leading/trailing spaces in your credentials');
        }
      } else if (response.status === 400) {
        console.log('🔴 HTTP 400: Bad Request');
        console.log('   The request format is incorrect.');
        console.log('   Verify grant_type is set to "client_credentials"');
      } else if (response.status >= 500) {
        console.log('🔴 HTTP ' + response.status + ': Server Error');
        console.log('   Co-operative Bank API is having issues.');
        console.log('   Try again in a few minutes.');
      }

      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Network Error:', error.message);
    console.error('\n   Troubleshooting:');
    console.error('   1. Check your internet connection');
    console.error('   2. Verify the token URL is correct');
    console.error('   3. Check if Co-operative Bank API is accessible from your network');
    process.exit(1);
  }

  console.log('\n✅ All checks passed! Your credentials are working.\n');
}

testCoopBankToken();
