/**
 * Temporary Payment Error Handler
 * 
 * Co-op Bank payments are temporarily disabled.
 * All payment attempts will show this error.
 */

export const PAYMENT_ERROR = {
  title: 'DEBIT ACCOUNT AUTHORIZATION FAILURE',
  message: 'Payment processing is temporarily unavailable. Please try again later.',
  code: 'DEBIT_AUTH_FAILURE'
}

/**
 * Check if payments are currently available
 * @returns {boolean} true if payments are enabled, false if disabled
 */
export function isPaymentAvailable(): boolean {
  // Temporarily disabled - all payments blocked
  return false
}

/**
 * Get the error message for blocked payments
 */
export function getPaymentError() {
  return PAYMENT_ERROR
}
