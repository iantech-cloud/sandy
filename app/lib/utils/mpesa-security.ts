import crypto from 'crypto';

/**
 * M-PESA Security Utilities
 * Handles encryption of security credentials for B2C, B2B, Account Balance, and Reversal APIs
 * 
 * These APIs require encrypted security credentials using Safaricom's public key certificate
 * Reference: https://developer.safaricom.co.ke/docs
 */

/**
 * Encrypt security credential using RSA and PKCS#1.5 padding
 * Used for: B2C, B2B, Account Balance Query, Transaction Reversal
 * 
 * @param initiatorPassword - The unencrypted initiator password
 * @param publicKeyPem - The M-PESA public key certificate (PEM format)
 * @returns Base64-encoded encrypted credential
 * 
 * Algorithm:
 * 1. Write the unencrypted password into a byte array
 * 2. Encrypt using RSA with PKCS#1.5 padding
 * 3. Convert to Base64 string
 */
export function encryptSecurityCredential(
  initiatorPassword: string,
  publicKeyPem: string
): string {
  try {
    // Encrypt using public key with PKCS#1.5 padding
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(initiatorPassword)
    );

    // Convert to base64
    return encrypted.toString('base64');
  } catch (error: any) {
    throw new Error(`Failed to encrypt security credential: ${error.message}`);
  }
}

/**
 * Load M-PESA public key certificate from environment or file
 * 
 * For Sandbox: Use sandbox certificate
 * For Production: Use production certificate
 * 
 * @param environment - 'sandbox' or 'production'
 * @returns PEM formatted public key certificate
 */
export function getMpesaPublicKey(environment: 'sandbox' | 'production' = 'sandbox'): string {
  // In production, load from environment variable or secure storage
  const envKey = environment === 'production'
    ? process.env.MPESA_PUBLIC_KEY_PRODUCTION
    : process.env.MPESA_PUBLIC_KEY_SANDBOX;

  if (!envKey) {
    throw new Error(
      `M-PESA public key not configured for ${environment}. ` +
      `Set ${environment === 'production' ? 'MPESA_PUBLIC_KEY_PRODUCTION' : 'MPESA_PUBLIC_KEY_SANDBOX'} environment variable`
    );
  }

  return envKey;
}

/**
 * Validate phone number format for M-PESA transactions
 * Supports: 254XXXXXXXXX (international), 07XXXXXXXXX (local Kenya), 01XXXXXXXXX (local Kenya)
 * 
 * @param phoneNumber - Phone number to validate
 * @returns Validated phone number in 254XXXXXXXXX format
 */
export function validatePhoneNumber(phoneNumber: string): string {
  // Remove all non-digits
  const cleaned = phoneNumber.replace(/\D/g, '');

  // If starts with 0 (local Kenya format), replace with 254
  if (cleaned.startsWith('0')) {
    return `254${cleaned.substring(1)}`;
  }

  // If already has country code 254
  if (cleaned.startsWith('254')) {
    if (cleaned.length === 12) {
      return cleaned;
    }
    throw new Error('Invalid phone number length');
  }

  // If just has 9 digits (Kenyan mobile)
  if (cleaned.length === 9) {
    return `254${cleaned}`;
  }

  throw new Error('Invalid phone number format. Expected 254XXXXXXXXX or local Kenya format');
}

/**
 * Generate unique transaction reference ID
 * Format: timestamp + random hex
 * 
 * @returns Unique transaction reference
 */
export function generateTransactionReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${timestamp}${random}`;
}

/**
 * Generate unique conversation ID for B2C, B2B, and other async operations
 * 
 * @returns Unique conversation ID
 */
export function generateConversationId(): string {
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Validate Safaricom callback signature (if provided)
 * Used to ensure callbacks come from legitimate Safaricom servers
 * 
 * @param payload - Callback payload
 * @param signature - Provided signature (if any)
 * @param secret - Shared secret between app and Safaricom
 * @returns True if signature is valid
 */
export function validateCallbackSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Get Safaricom API gateway IPs for whitelisting
 * These IPs should be whitelisted in your firewall/network for callback notifications
 * 
 * Reference: https://developer.safaricom.co.ke/docs
 */
export function getSafaricomGatewayIps(): string[] {
  return [
    '196.201.214.200',
    '196.201.214.206',
    '196.201.213.114',
    '196.201.214.207',
    '196.201.214.208',
    '196.201.213.44',
    '196.201.212.127',
    '196.201.212.138',
    '196.201.212.129',
    '196.201.212.136',
    '196.201.212.74',
    '196.201.212.69',
  ];
}

/**
 * Validate that request comes from whitelisted Safaricom IP
 * 
 * @param clientIp - Client IP address from request
 * @returns True if IP is from Safaricom
 */
export function isSafaricomIp(clientIp: string): boolean {
  const safaricomIps = getSafaricomGatewayIps();
  // Handle X-Forwarded-For for proxy setups
  const ipToCheck = clientIp.split(',')[0].trim();
  return safaricomIps.includes(ipToCheck);
}

/**
 * Sanitize transaction description to remove special characters
 * M-PESA has limits on allowed characters
 * 
 * @param description - Original description
 * @returns Sanitized description
 */
export function sanitizeTransactionDescription(description: string): string {
  return description
    .replace(/[^a-zA-Z0-9\s\-./]/g, '')
    .substring(0, 255); // Max 255 characters
}
