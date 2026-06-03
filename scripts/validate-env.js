#!/usr/bin/env node

/**
 * Environment Variable Validation Script
 * Run this before deployment to ensure all critical variables are set correctly
 * 
 * Usage:
 *   node scripts/validate-env.js
 *   NODE_ENV=production node scripts/validate-env.js
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.production.local') });

const REQUIRED_VARS = {
  // Core application
  NODE_ENV: { type: 'string', options: ['production', 'development', 'staging'] },
  NEXTAUTH_SECRET: { type: 'string', minLength: 32 },
  NEXTAUTH_URL: { type: 'url' },
  MONGODB_URI: { type: 'mongodb-uri' },

  // Co-operative Bank OAuth2 Bearer Token (PRIMARY PAYMENT GATEWAY) - ⚠️ CRITICAL NAMES
  COOP_BANK_BASIC_AUTH: { type: 'string', minLength: 50 }, // "Basic <base64...>"
  COOP_BANK_OPERATOR_CODE: { type: 'string', minLength: 3 },

  // Public URLs
  NEXT_PUBLIC_BASE_URL: { type: 'url' },
};

const OPTIONAL_VARS = {
  PORT: { type: 'number', default: 5000 },
  HOSTNAME: { type: 'string', default: '0.0.0.0' },
  COOP_BANK_BASE_URL: { type: 'url', default: 'https://openapi.co-opbank.co.ke' },
  COOP_BANK_TOKEN_ENDPOINT: { type: 'string', default: '/token' },
  COOP_BANK_STK_PUSH_ENDPOINT: { type: 'string', default: '/FT/stk/1.0.0' },
  COOP_BANK_STK_STATUS_ENDPOINT: { type: 'string', default: '/Enquiry/STK/1.0.0/' },
  RESEND_API_KEY: { type: 'string', minLength: 10 },
  EMAIL_FROM_ADDRESS: { type: 'email' },
  API_BASE_URL: { type: 'url' },
};

const COMMON_MISTAKES = {
  COOP_CLIENT_ID: 'Old format - use COOP_BANK_BASIC_AUTH instead',
  COOP_CLIENT_SECRET: 'Old format - use COOP_BANK_BASIC_AUTH instead',
  COOP_OPERATOR_CODE: 'Should be COOP_BANK_OPERATOR_CODE (with _BANK_)',
  COOP_BASE_URL: 'Should be COOP_BANK_BASE_URL (with _BANK_)',
  COOP_TOKEN_URL: 'Should be COOP_BANK_TOKEN_ENDPOINT (with _BANK_)',
  COOP_STK_PUSH_URL: 'Should be COOP_BANK_STK_PUSH_ENDPOINT (with _BANK_)',
  COOP_STK_STATUS_URL: 'Should be COOP_BANK_STK_STATUS_ENDPOINT (with _BANK_)',
};

// ============================================================================
// Validation Functions
// ============================================================================

function isValidUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

function isValidMongoUri(str) {
  return /^mongodb(\+srv)?:\/\//.test(str);
}

function isValidEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

function validateVariable(name, value, rules) {
  if (value === undefined || value === '') {
    return { valid: false, error: 'Missing or empty' };
  }

  if (rules.minLength && value.length < rules.minLength) {
    return { valid: false, error: `Too short (min ${rules.minLength} chars)` };
  }

  if (rules.type === 'url' && !isValidUrl(value)) {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (rules.type === 'mongodb-uri' && !isValidMongoUri(value)) {
    return { valid: false, error: 'Invalid MongoDB URI' };
  }

  if (rules.type === 'email' && !isValidEmail(value)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (rules.type === 'number' && isNaN(Number(value))) {
    return { valid: false, error: 'Must be a number' };
  }

  if (rules.options && !rules.options.includes(value)) {
    return { valid: false, error: `Must be one of: ${rules.options.join(', ')}` };
  }

  return { valid: true };
}

// ============================================================================
// Main Validation Logic
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('ENVIRONMENT VARIABLE VALIDATION');
console.log('='.repeat(70) + '\n');

let allValid = true;
let errorCount = 0;
let warningCount = 0;

// Check for common mistakes
console.log('🔍 Checking for common mistakes...\n');
for (const [incorrectName, suggestion] of Object.entries(COMMON_MISTAKES)) {
  if (process.env[incorrectName]) {
    console.log(`  ⚠️  ${incorrectName} found - ${suggestion}`);
    warningCount++;
    allValid = false;
  }
}
if (warningCount === 0) {
  console.log('  ✓ No common mistakes found\n');
} else {
  console.log();
}

// Check required variables
console.log('✅ Required Variables:\n');
for (const [name, rules] of Object.entries(REQUIRED_VARS)) {
  const value = process.env[name];
  const validation = validateVariable(name, value, rules);

  if (validation.valid) {
    const displayValue = name.includes('SECRET') || name.includes('KEY')
      ? '***' + value.substring(value.length - 4)
      : value;
    console.log(`  ✓ ${name.padEnd(30)} = ${displayValue}`);
  } else {
    console.log(`  ✗ ${name.padEnd(30)} - ${validation.error}`);
    allValid = false;
    errorCount++;
  }
}

// Check optional variables
console.log('\n⚙️  Optional Variables:\n');
for (const [name, rules] of Object.entries(OPTIONAL_VARS)) {
  const value = process.env[name];

  if (!value) {
    console.log(`  - ${name.padEnd(30)} (using default: ${rules.default || 'N/A'})`);
    continue;
  }

  const validation = validateVariable(name, value, rules);
  if (validation.valid) {
    const displayValue = name.includes('KEY')
      ? '***' + value.substring(value.length - 4)
      : value;
    console.log(`  ✓ ${name.padEnd(30)} = ${displayValue}`);
  } else {
    console.log(`  ⚠️  ${name.padEnd(30)} - ${validation.error}`);
    warningCount++;
  }
}

// ============================================================================
// Co-operative Bank Specific Checks
// ============================================================================

console.log('\n💳 Co-operative Bank OAuth2 Configuration:\n');

const coopVars = ['COOP_BANK_BASIC_AUTH', 'COOP_BANK_OPERATOR_CODE'];
const coopReady = coopVars.every(v => process.env[v]);

if (coopReady) {
  console.log('  ✓ All Co-op Bank OAuth2 credentials are configured');
  console.log(`  ✓ Basic Auth: ${process.env.COOP_BANK_BASIC_AUTH?.substring(0, 20)}...`);
  console.log(`  ✓ Operator Code: ${process.env.COOP_BANK_OPERATOR_CODE}`);
  console.log(`  ✓ Base URL: ${process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke'}`);
  console.log(`  ✓ Token endpoint: ${process.env.COOP_BANK_TOKEN_ENDPOINT || '/token'}`);
  console.log(`  ✓ STK Push endpoint: ${process.env.COOP_BANK_STK_PUSH_ENDPOINT || '/FT/stk/1.0.0'}`);
  console.log(`  ✓ Status endpoint: ${process.env.COOP_BANK_STK_STATUS_ENDPOINT || '/Enquiry/STK/1.0.0/'}`);
} else {
  console.log('  ✗ Co-op Bank credentials incomplete - payments will FAIL');
  allValid = false;
  const missing = coopVars.filter(v => !process.env[v]);
  missing.forEach(v => console.log(`    Missing: ${v}`));
}

// ============================================================================
// Connectivity Tests
// ============================================================================

console.log('\n🌐 Connectivity Checks:\n');

// Check NEXT_PUBLIC_BASE_URL
if (process.env.NEXT_PUBLIC_BASE_URL) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  console.log(`  ✓ Base URL: ${baseUrl}`);
  console.log(`    → Callback URL would be: ${baseUrl}/api/payments/coop-bank/callback`);

  if (!baseUrl.startsWith('https')) {
    console.log('    ⚠️  WARNING: URL should use HTTPS in production');
    warningCount++;
  }
}

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

if (allValid && errorCount === 0) {
  console.log('✅ All critical variables are configured correctly\n');
  console.log('✨ You are ready to deploy!\n');
  process.exit(0);
} else {
  console.log(`\n❌ Validation failed:\n`);
  console.log(`   Errors: ${errorCount}`);
  console.log(`   Warnings: ${warningCount}\n`);
  console.log('Fix the errors above before deploying.\n');
  process.exit(1);
}
