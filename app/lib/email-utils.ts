/**
 * Mask email address for privacy
 * @param email - Full email address
 * @param showChars - Number of characters to show at start
 * @returns Masked email (e.g., "jo****@example.com")
 */
export function maskEmail(email: string, showChars: number = 2): string {
  if (!email || !email.includes('@')) {
    return email;
  }

  const [localPart, domain] = email.split('@');

  if (localPart.length <= showChars) {
    return `${localPart}***@${domain}`;
  }

  const visible = localPart.substring(0, showChars);
  const hidden = '*'.repeat(Math.max(1, localPart.length - showChars));

  return `${visible}${hidden}@${domain}`;
}

/**
 * Get masked email with hover title
 * @param email - Full email address
 * @returns Object with masked email and full email for title
 */
export function getMaskedEmailInfo(email: string): { masked: string; full: string } {
  return {
    masked: maskEmail(email),
    full: email
  };
}
