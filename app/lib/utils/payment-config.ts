/**
 * Payment Configuration Utility
 * M-Pesa Daraja only payments system
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
 * Get M-Pesa Daraja configuration
 * All payments now use M-Pesa STK Push via Safaricom Daraja API
 */
export function getMpesaDarajaConfig() {
  const consumerKey = process.env.NEXT_PUBLIC_MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortCode = process.env.NEXT_PUBLIC_MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASS_KEY;
  
  if (!consumerKey || !consumerSecret || !shortCode || !passkey) {
    console.warn('[v0] M-Pesa configuration incomplete');
  }
  
  return {
    consumerKey,
    consumerSecret,
    shortCode,
    passkey,
    isConfigured: !!(consumerKey && consumerSecret && shortCode && passkey),
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
