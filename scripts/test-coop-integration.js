#!/usr/bin/env node

/**
 * Comprehensive Co-operative Bank OAuth2 Integration Test
 * 
 * This script validates the complete OAuth2 Bearer token integration
 * 
 * Usage:
 *   node scripts/test-coop-integration.js
 * 
 * What it tests:
 * 1. Environment variables are set correctly
 * 2. Bearer token format is valid
 * 3. Token endpoint is reachable
 * 4. OAuth2 token can be obtained
 * 5. Bearer token can be used for API calls
 */

const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.production.local') });

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(symbol, message, color = 'reset') {
  console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

function section(title) {
  console.log(`\n${colors.bright}${colors.blue}${'─'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}${'─'.repeat(60)}${colors.reset}\n`);
}

async function testCoopIntegration() {
  let testsPassed = 0;
  let testsFailed = 0;

  console.log(`\n${colors.bright}${colors.blue}🔍 Co-operative Bank OAuth2 Integration Test${colors.reset}\n`);

  // =========================================================================
  // Test 1: Environment Variables
  // =========================================================================
  section('TEST 1: Environment Variables');

  const basicAuth = process.env.COOP_BANK_BASIC_AUTH;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
  const baseUrl = process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke';
  const tokenEndpoint = process.env.COOP_BANK_TOKEN_ENDPOINT || '/token';

  if (basicAuth) {
    log('✓', `COOP_BANK_BASIC_AUTH is set (${basicAuth.substring(0, 30)}...)`, 'green');
    testsPassed++;
  } else {
    log('✗', 'COOP_BANK_BASIC_AUTH is NOT set', 'red');
    testsFailed++;
  }

  if (operatorCode) {
    log('✓', `COOP_BANK_OPERATOR_CODE is set (${operatorCode})`, 'green');
    testsPassed++;
  } else {
    log('✗', 'COOP_BANK_OPERATOR_CODE is NOT set', 'red');
    testsFailed++;
  }

  if (baseUrl) {
    log('✓', `Base URL configured: ${baseUrl}`, 'green');
    testsPassed++;
  } else {
    log('✗', 'Base URL not configured', 'red');
    testsFailed++;
  }

  // =========================================================================
  // Test 2: Bearer Token Format
  // =========================================================================
  section('TEST 2: Bearer Token Format Validation');

  if (!basicAuth) {
    log('⊘', 'Skipping format test (token not set)', 'yellow');
  } else {
    if (basicAuth.startsWith('Basic ')) {
      log('✓', 'Token starts with "Basic " prefix', 'green');
      testsPassed++;
    } else {
      log('✗', 'Token does NOT start with "Basic " prefix', 'red');
      testsFailed++;
    }

    const tokenPart = basicAuth.substring(6); // Skip "Basic "
    if (tokenPart.length > 20) {
      log('✓', `Token has sufficient length (${tokenPart.length} chars)`, 'green');
      testsPassed++;
    } else {
      log('✗', 'Token appears too short (may be invalid)', 'red');
      testsFailed++;
    }

    // Try to detect if it looks like base64
    try {
      const decoded = Buffer.from(tokenPart, 'base64').toString('utf-8');
      if (decoded.includes(':')) {
        log('✓', 'Token decodes successfully (contains colon separator)', 'green');
        testsPassed++;
      } else {
        log('⊘', 'Token decodes but may not be valid credentials format', 'yellow');
      }
    } catch (e) {
      log('✗', 'Token does not appear to be valid Base64', 'red');
      testsFailed++;
    }
  }

  // =========================================================================
  // Test 3: Token Endpoint Connectivity
  // =========================================================================
  section('TEST 3: Token Endpoint Connectivity');

  if (!basicAuth) {
    log('⊘', 'Skipping connectivity test (token not set)', 'yellow');
  } else {
    const tokenUrl = basicAuth.startsWith('http') ? baseUrl : `${baseUrl}${tokenEndpoint}`;
    log('ℹ', `Token endpoint: ${tokenUrl}`, 'blue');

    try {
      log('⏱', 'Testing connection to token endpoint...', 'yellow');

      const startTime = Date.now();
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Authorization': basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        timeout: 10000,
      });

      const duration = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.access_token) {
          log('✓', `Token obtained successfully (${duration}ms)`, 'green');
          log('✓', `Token type: ${data.token_type}`, 'green');
          log('✓', `Expires in: ${data.expires_in} seconds`, 'green');
          testsPassed += 3;

          // ===================================================================
          // Test 4: Bearer Token Usage (if token obtained)
          // ===================================================================
          section('TEST 4: Bearer Token Usage');

          const bearerToken = data.access_token;
          const statusUrl = `${baseUrl}/Enquiry/STK/1.0.0/`;

          log('ℹ', `Testing Bearer token with status endpoint`, 'blue');
          log('ℹ', `Status endpoint: ${statusUrl}`, 'blue');

          try {
            // Test with dummy message reference (won't exist, but tests auth)
            const statusResponse = await fetch(statusUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${bearerToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                MessageReference: 'TEST_DUMMY_REFERENCE',
              }),
              timeout: 10000,
            });

            if (statusResponse.status === 401) {
              log('✗', 'Bearer token rejected (HTTP 401)', 'red');
              testsFailed++;
            } else if (statusResponse.status >= 500) {
              log('⊘', `Server error (HTTP ${statusResponse.status}) - API may be down`, 'yellow');
            } else {
              log('✓', `Bearer token accepted by API (HTTP ${statusResponse.status})`, 'green');
              testsPassed++;
            }
          } catch (e) {
            log('⊘', `Could not test Bearer token: ${e.message}`, 'yellow');
          }
        } else {
          log('✗', 'Token response missing access_token', 'red');
          testsFailed++;
        }
      } else {
        const error = await response.text();
        log('✗', `Token request failed (HTTP ${response.status})`, 'red');
        log('ℹ', `Response: ${error.substring(0, 100)}...`, 'blue');
        testsFailed++;
      }
    } catch (error) {
      log('✗', `Network error: ${error.message}`, 'red');
      testsFailed++;
    }
  }

  // =========================================================================
  // Test 5: MongoDB Connection Check
  // =========================================================================
  section('TEST 5: MongoDB Connection');

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    if (mongoUri.startsWith('mongodb')) {
      log('✓', 'MongoDB URI is configured', 'green');
      log('ℹ', `URI format: ${mongoUri.substring(0, 30)}...`, 'blue');
      testsPassed++;
    } else {
      log('✗', 'MongoDB URI format appears invalid', 'red');
      testsFailed++;
    }
  } else {
    log('✗', 'MongoDB URI is NOT set', 'red');
    testsFailed++;
  }

  // =========================================================================
  // Summary
  // =========================================================================
  section('SUMMARY');

  const totalTests = testsPassed + testsFailed;
  const percentage = totalTests > 0 ? Math.round((testsPassed / totalTests) * 100) : 0;

  log('ℹ', `Tests passed: ${colors.green}${testsPassed}${colors.reset}`, 'reset');
  log('ℹ', `Tests failed: ${colors.red}${testsFailed}${colors.reset}`, 'reset');
  log('ℹ', `Success rate: ${percentage}%`, 'reset');

  console.log();

  if (testsFailed === 0) {
    log('✓', 'All tests passed! Integration is ready.', 'green');
    console.log(`\n${colors.green}${colors.bright}🎉 Your Co-operative Bank integration is fully configured!${colors.reset}\n`);
    process.exit(0);
  } else if (testsFailed <= 2) {
    log('⚠', 'Some tests failed. Check the errors above and fix them.', 'yellow');
    console.log(`\n${colors.yellow}Please fix the ${testsFailed} error(s) before deploying.${colors.reset}\n`);
    process.exit(1);
  } else {
    log('✗', 'Multiple tests failed. Integration setup is incomplete.', 'red');
    console.log(`\n${colors.red}Please address the ${testsFailed} errors before proceeding.${colors.reset}\n`);
    process.exit(1);
  }
}

// Run the test
testCoopIntegration().catch(error => {
  console.error('\n🚨 Unexpected error:', error);
  process.exit(1);
});
