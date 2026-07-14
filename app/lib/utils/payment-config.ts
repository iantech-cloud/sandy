/**
 * Payment Configuration Utility
 * Manages environment-based payment method availability
 */

/**
 * Check if running on localhost/development environment
 */
export function isLocalhostDevelopment(): boolean {
  // Check both NODE_ENV and hostname
  if (typeof window === 'undefined') {
    // Server-side check
    return process.env.NODE_ENV === 'development';
  }
  
  // Client-side check
  return (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      process.env.NODE_ENV === 'development')
  );
}

/**
 * Check if HashBack payment is enabled
 * - Localhost: Fully enabled (true)
 * - Production: Disabled but show as "coming soon" ("coming_soon")
 */
export function getHashBackStatus(): 'enabled' | 'coming_soon' {
  return isLocalhostDevelopment() ? 'enabled' : 'coming_soon';
}

/**
 * Check if HashBack button should be functional
 */
export function isHashBackFunctional(): boolean {
  return getHashBackStatus() === 'enabled';
}

/**
 * Get HashBack environment configuration
 */
export function getHashBackConfig() {
  const accountId = process.env.NEXT_PUBLIC_HASHBACK_ACCOUNT_ID;
  const webhookSecret = process.env.HASHBACK_WEBHOOK_SECRET;
  
  if (!accountId) {
    console.warn('[v0] NEXT_PUBLIC_HASHBACK_ACCOUNT_ID not configured');
  }
  
  return {
    accountId,
    webhookSecret,
    isEnabled: isHashBackFunctional(),
    status: getHashBackStatus(),
    scriptUrl: 'https://pay.hashback.co.ke/hashpay.js',
  };
}

/**
 * Get Co-op Bank configuration
 */
export function getCoopBankConfig() {
  const basicAuth = process.env.COOP_BANK_BASIC_AUTH;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
  const baseUrl = process.env.COOP_BANK_BASE_URL || 'https://openapi.co-opbank.co.ke';
  
  return {
    basicAuth,
    operatorCode,
    baseUrl,
    isEnabled: true, // Always enabled
  };
}

/**
 * Helper to format payment status message
 */
export function getPaymentStatusMessage(status: 'enabled' | 'coming_soon'): string {
  return status === 'enabled' 
    ? 'Available'
    : 'Coming Soon';
}
