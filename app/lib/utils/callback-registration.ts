/**
 * M-PESA Callback URL Registration Helper
 * 
 * This utility helps register callback URLs with M-PESA Daraja
 * Callback URLs are where M-PESA sends transaction notifications
 */

/**
 * Get all configured callback URLs for this application
 * These should be registered with Safaricom Daraja portal
 */
export function getCallbackUrls() {
  const baseUrl = process.env.DARAJA_CALLBACK_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://hustlehubafrica.com';

  return {
    // STK Push / M-PESA Express callbacks
    stkPushCallback: process.env.DARAJA_CALLBACK_URL || `${baseUrl}/api/payments/daraja/callback`,

    // C2B Callbacks (Customer to Business)
    c2bValidation: process.env.DARAJA_C2B_VALIDATION_URL || `${baseUrl}/api/payments/daraja/c2b/validate`,
    c2bConfirmation: process.env.DARAJA_C2B_CONFIRMATION_URL || `${baseUrl}/api/payments/daraja/c2b/confirm`,

    // B2C Callbacks (Business to Customer)
    b2cResult: process.env.DARAJA_B2C_RESULT_URL || `${baseUrl}/api/payments/daraja/callback`,

    // B2B Callbacks
    b2bResult: process.env.DARAJA_B2B_RESULT_URL || `${baseUrl}/api/payments/daraja/callback`,

    // Account Balance Callbacks
    balanceResult: process.env.DARAJA_BALANCE_RESULT_URL || `${baseUrl}/api/payments/daraja/callback`,

    // Transaction Reversal Callbacks
    reversalResult: process.env.DARAJA_REVERSAL_RESULT_URL || `${baseUrl}/api/payments/daraja/callback`,
  };
}

/**
 * Format callback registration instructions for developers
 * This is what needs to be configured in the Daraja portal
 */
export function getCallbackRegistrationInstructions() {
  const urls = getCallbackUrls();

  return `
=============================================================================
M-PESA CALLBACK URL REGISTRATION
=============================================================================

The following callback URLs must be registered in your Daraja portal:
https://developer.safaricom.co.ke/

1. STK PUSH / M-PESA EXPRESS
   URL: ${urls.stkPushCallback}
   Usage: Payment completion/failure notifications
   
2. C2B VALIDATION (Optional)
   URL: ${urls.c2bValidation}
   Usage: Validate incoming customer payments before processing
   
3. C2B CONFIRMATION (Optional)
   URL: ${urls.c2bConfirmation}
   Usage: Confirm customer payments after processing
   
4. B2C RESULT (For Payouts)
   URL: ${urls.b2cResult}
   Usage: Business to customer payment results
   
5. B2B RESULT (For B2B Transfers)
   URL: ${urls.b2bResult}
   Usage: Business to business transfer results
   
6. ACCOUNT BALANCE RESULT (Optional)
   URL: ${urls.balanceResult}
   Usage: Account balance query results
   
7. REVERSAL RESULT (Optional)
   URL: ${urls.reversalResult}
   Usage: Transaction reversal results

=============================================================================
STEPS TO REGISTER:
=============================================================================

1. Log in to https://developer.safaricom.co.ke/
2. Go to your app settings
3. Go to API CONFIGURATION section
4. For each callback type, paste the corresponding URL above
5. Save changes
6. Daraja will test each callback URL - ensure they're accessible
7. When ready, switch from Sandbox to Production and repeat

=============================================================================
TESTING CALLBACKS LOCALLY:
=============================================================================

For local testing before deployment, use ngrok:
\`\`\`bash
# Install ngrok from https://ngrok.com/
ngrok http 3000  # or your app port

# Your URL will be something like: https://abc123.ngrok.io
# Use: https://abc123.ngrok.io/api/payments/daraja/callback
# Copy this temporary URL to Daraja portal for testing
\`\`\`

=============================================================================
IP WHITELISTING:
=============================================================================

Whitelist these Safaricom gateway IPs to receive callbacks:
196.201.214.200
196.201.214.206
196.201.213.114
196.201.214.207
196.201.214.208
196.201.213.44
196.201.212.127
196.201.212.138
196.201.212.129
196.201.212.136
196.201.212.74
196.201.212.69

=============================================================================
`;
}

/**
 * Validate that callback URLs are properly configured
 */
export function validateCallbackConfiguration(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if at least base URL is configured
  const baseUrl = process.env.DARAJA_CALLBACK_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    errors.push('No base URL configured. Set DARAJA_CALLBACK_URL or NEXT_PUBLIC_BASE_URL');
  }

  // Check if callback URL is HTTPS (required for production)
  if (baseUrl && !baseUrl.startsWith('https://')) {
    if (!baseUrl.includes('localhost') && !baseUrl.includes('127.0.0.1')) {
      errors.push('Callback URL must use HTTPS for production (not HTTP)');
    }
  }

  // Check if URLs are accessible (warning only)
  if (baseUrl && baseUrl.includes('localhost')) {
    errors.push('WARNING: Localhost URLs cannot receive callbacks from Safaricom. Use ngrok or deploy to production.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create environment variables string for .env file
 */
export function generateEnvFileContent(baseUrl: string = 'https://your-domain.com'): string {
  return `# ============================================
# MPESA DARAJA CALLBACK URLS
# ============================================
# Update your-domain.com with your actual domain

DARAJA_CALLBACK_URL=${baseUrl}/api/payments/daraja/callback
DARAJA_C2B_VALIDATION_URL=${baseUrl}/api/payments/daraja/c2b/validate
DARAJA_C2B_CONFIRMATION_URL=${baseUrl}/api/payments/daraja/c2b/confirm
DARAJA_B2C_RESULT_URL=${baseUrl}/api/payments/daraja/callback
DARAJA_B2B_RESULT_URL=${baseUrl}/api/payments/daraja/callback
DARAJA_BALANCE_RESULT_URL=${baseUrl}/api/payments/daraja/callback
DARAJA_REVERSAL_RESULT_URL=${baseUrl}/api/payments/daraja/callback
`;
}
