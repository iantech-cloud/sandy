/**
 * Phone Number Formatter Utility
 * Handles formatting Safaricom/Kenyan phone numbers in multiple formats
 */

/**
 * Formats phone number to standard +254XXXXXXXXX format
 * Accepts inputs like:
 * - 791406285 (9 digits)
 * - 0791406285 (10 digits with leading 0)
 * - 254791406285 (12 digits without +)
 * - +254791406285 (12 digits with +)
 * 
 * Also handles malformed inputs like +254254791406285 by stripping duplicate country codes
 */
export function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) return '';

  // Remove all whitespace and hyphens
  let cleaned = phoneNumber.trim().replace(/[\s\-]/g, '');

  // Remove + prefix if present
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // MALFORMED INPUT FIX: Check for duplicate 254 at the start (e.g., 254254791406285)
  if (cleaned.startsWith('254254')) {
    // Remove the first occurrence of 254
    cleaned = cleaned.substring(3);
  }

  // If it's just 9 digits, assume it's 254XXXXXXXXX
  if (cleaned.length === 9 && /^[0-9]{9}$/.test(cleaned)) {
    return `+254${cleaned}`;
  }

  // If it's 10 digits starting with 0, replace 0 with 254
  if (cleaned.length === 10 && cleaned.startsWith('0') && /^0[0-9]{9}$/.test(cleaned)) {
    return `+254${cleaned.substring(1)}`;
  }

  // If it's 12 digits starting with 254, add +
  if (cleaned.length === 12 && cleaned.startsWith('254') && /^254[0-9]{9}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // If it's already in +254XXXXXXXXX format, return as-is
  if (phoneNumber.match(/^\+254[0-9]{9}$/)) {
    return phoneNumber;
  }

  // If it's 254XXXXXXXXX format (without +), add the +
  if (cleaned.match(/^254[0-9]{9}$/)) {
    return `+${cleaned}`;
  }

  // Invalid format
  throw new Error(`Invalid phone number format: ${phoneNumber}. Must be 791406285, 0791406285, 254791406285, or +254791406285`);
}

/**
 * Validates if a phone number is in the correct Kenyan format after formatting
 */
export function isValidPhoneNumber(phoneNumber: string): boolean {
  try {
    const formatted = formatPhoneNumber(phoneNumber);
    return /^\+254[0-9]{9}$/.test(formatted);
  } catch {
    return false;
  }
}

/**
 * Gets the phone number in format expected by M-Pesa API (without + prefix)
 */
export function getMpesaPhoneFormat(phoneNumber: string): string {
  const formatted = formatPhoneNumber(phoneNumber);
  return formatted.substring(1); // Remove the + prefix
}

/**
 * Compares two phone numbers, accounting for different formats
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  try {
    return formatPhoneNumber(phone1) === formatPhoneNumber(phone2);
  } catch {
    return false;
  }
}
