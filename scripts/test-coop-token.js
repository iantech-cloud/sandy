#!/usr/bin/env node

/**
 * Diagnostic script to test Co-operative Bank OAuth2 token request
 * 
 * Usage:
 *   node scripts/test-coop-token.js
 * 
 * This script:
 * 1. Verifies environment variables are loaded (COOP_BANK_BASIC_AUTH, etc.)
 * 2. Tests the Bearer token request with pre-encoded Basic auth credentials
 * 3. Provides detailed error messages and troubleshooting guidance
 */

const path = require('path');

// Load environment variables from .env.local or .env.production.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.production.local') });

async function testCoopBankToken() {
  console.log('🔍 Co-operative Bank OAuth2 Bearer Token Request Diagnostic\n');

  // Step 1: Check environment variables
  console.log('📋 Step 1: Checking Environment Variables');
  console.log('─'.repeat(50));

  const basicAuth = process.env.COOP_BANK_BASIC_AUTH;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
  const baseUrl = process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke';
  const tokenEndpoint = process.env.COOP_BANK_TOKEN_ENDPOINT || '/token';
  const tokenUrl = baseUrl + tokenEndpoint;

  console.log(`COOP_BANK_BASIC_AUTH: ${basicAuth ? '✅ SET' : '❌ MISSING'} (length: ${basicAuth?.length || 0})`);
  console.log(`  Format: ${basicAuth?.substring(0, 30)}...`);
  console.log(`COOP_BANK_OPERATOR_CODE: ${operatorCode ? '✅ SET' : '❌ MISSING'} (value: ${operatorCode || 'N/A'})`);
  console.log(`Token URL: ${tokenUrl}`);

  if (!basicAuth || !operatorCode) {
    console.error('\n❌ Missing required environment variables!');
    console.error('   Make sure .env.local or .env.production.local has:');
    console.error('   - COOP_BANK_BASIC_AUTH (format: "Basic <base64...>")');
    console.error('   - COOP_BANK_OPERATOR_CODE');
    process.exit(1);
  }

  console.log('\n✅ All environment variables are set\n');

  // Step 2: Verify Bearer Token format
  console.log('📋 Step 2: Verifying Bearer Token Format');
  console.log('─'.repeat(50));

  if (!basicAuth.startsWith('Basic ')) {
    console.error('❌ ERROR: COOP_BANK_BASIC_AUTH must start with "Basic " prefix');
    console.error(`   Got: ${basicAuth?.substring(0, 20)}...`);
    process.exit(1);
  }

  console.log(`✓ Bearer Token format is correct: ${basicAuth.substring(0, 50)}...`);
  console.log(`Length: ${basicAuth.length} characters\n`);

  // Step 3: Attempt token request
  console.log('📋 Step 3: Attempting OAuth2 Token Request');
  console.log('─'.repeat(50));

  try {
    console.log(`POST ${tokenUrl}`);
    console.log(`Authorization: ${basicAuth.substring(0, 50)}...`);
    console.log(`Content-Type: application/x-www-form-urlencoded`);
    console.log(`Body: grant_type=client_credentials\n`);

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': basicAuth,  // Use pre-encoded Basic auth string
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
          console.log('   This means the Bearer token (Basic auth) is not recognized.');
          console.log('\n   Troubleshooting:');
          console.log('   1. Verify your COOP_BANK_BASIC_AUTH value with Co-operative Bank');
          console.log('   2. Ensure it starts with "Basic " (with space)');
          console.log('   3. Check that the base64-encoded credentials inside are correct');
          console.log('   4. Verify it matches the value from your Postman collection');
          console.log('   5. Check for leading/trailing spaces in the variable');
        }
      } else if (response.status === 400) {
        console.log('🔴 HTTP 400: Bad Request');
        console.log('   The request format is incorrect.');
        console.log('   Verify:');
        console.log('   - grant_type is set to "client_credentials"');
        console.log('   - Authorization header format: "Basic <base64...>"');
        console.log('   - Content-Type is "application/x-www-form-urlencoded"');
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
    console.error('   2. Verify the token URL is correct: ' + tokenUrl);
    console.error('   3. Check if Co-operative Bank API is accessible from your network');
    console.error('   4. Try using a curl command manually to test connectivity');
    process.exit(1);
  }

  console.log('\n✅ OAuth2 Bearer token obtained successfully!');
  console.log('✅ Your COOP_BANK_BASIC_AUTH and COOP_BANK_OPERATOR_CODE are correct.\n');
}

testCoopBankToken();
