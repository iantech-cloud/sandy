/**
 * Utility functions for cookie operations
 * Used for referral tracking and other client-side cookie management
 */

/**
 * Get a cookie value by name
 * @param name - The name of the cookie
 * @returns The cookie value or null if not found
 */
export function getCookie(name: string): string | null {
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return decodeURIComponent(parts[1].split(';')[0]);
    }
  } catch (error) {
    console.error(`[v0] Error reading cookie "${name}":`, error);
  }
  return null;
}

/**
 * Set a cookie value
 * @param name - The name of the cookie
 * @param value - The value to store
 * @param days - Number of days until expiration (default: 30)
 */
export function setCookie(name: string, value: string, days: number = 30): void {
  try {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  } catch (error) {
    console.error(`[v0] Error setting cookie "${name}":`, error);
  }
}

/**
 * Delete a cookie by name
 * @param name - The name of the cookie to delete
 */
export function deleteCookie(name: string): void {
  try {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  } catch (error) {
    console.error(`[v0] Error deleting cookie "${name}":`, error);
  }
}

/**
 * Get the referral code with fallback logic
 * Resolution order: URL param → Cookie → Default
 * @param urlParam - The referral code from URL parameter
 * @returns The resolved referral code
 */
export function resolveReferralCode(urlParam: string | null): string {
  // Priority 1: URL parameter (freshest signal)
  if (urlParam) {
    const sanitized = urlParam.toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (sanitized) {
      return sanitized;
    }
  }

  // Priority 2: hh_ref cookie (persisted from earlier visit)
  const cookieRef = getCookie('hh_ref');
  if (cookieRef) {
    return cookieRef;
  }

  // Priority 3: Default referral code from env
  return process.env.NEXT_PUBLIC_DEFAULT_REFERRAL_ID || 'SANDY001';
}
