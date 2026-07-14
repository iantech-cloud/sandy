/**
 * Generate a dynamic payment amount within a specified range
 * Used to prevent hardcoding and gaming of payment amounts
 * 
 * @param min Minimum amount in KES
 * @param max Maximum amount in KES
 * @returns Random amount in cents (multiply KES by 100)
 */
export function getDynamicPaymentAmount(min: number, max: number): number {
  // Generate random amount in KES between min and max (inclusive)
  const amountInKes = Math.floor(Math.random() * (max - min + 1)) + min;
  // Convert to cents
  return amountInKes * 100;
}

/**
 * Generate dynamic activation amount (95-100 KES)
 */
export function getActivationAmount(): number {
  return getDynamicPaymentAmount(95, 100);
}

/**
 * Generate dynamic bot unlock amount (95-100 KES)
 */
export function getBotUnlockAmount(): number {
  return getDynamicPaymentAmount(95, 100);
}

/**
 * Convert cents to KES display format
 */
export function centsToKes(cents: number): number {
  return cents / 100;
}
