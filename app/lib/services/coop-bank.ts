/**
 * Co-operative Bank STK Push Service
 *
 * Based on official Postman collection (SANDRA OTIENO SCHOLINE):
 *   Token:  POST https://openapi.co-opbank.co.ke/token
 *           Header: Authorization: Basic <COOP_BANK_BASIC_AUTH>
 *           Body (raw text): grant_type=client_credentials
 *           Returns: Bearer token for subsequent API calls
 *
 *   STK Push: POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0
 *           Header: Authorization: Bearer <token from Token endpoint>
 *           Body (JSON, PascalCase keys)
 *
 *   Status: POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
 *           Header: Authorization: Bearer <token from Token endpoint>
 *           Body: { "MessageReference": "<ref>" }
 *
 * M-Pesa implementation is kept below but commented out as a fallback.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoopBankConfig {
  basicAuth: string; // Pre-encoded Basic auth string (e.g., "Basic MktETXRDZnpfSHZscUYzaFNBemxjUmQx...")
  operatorCode: string;
  baseUrl?: string;
  tokenUrl?: string;
  stkPushUrl?: string;
  stkStatusUrl?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface STKPushResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MessageReference?: string;
  // The Co-op Bank API returns these identifiers on success
  OperatorTxnID?: string;
  ConversationID?: string;
  OriginatorConversationID?: string;
  // Field names differ slightly across environments — keep all variants
  operatorTxnID?: string;
  conversationID?: string;
}

export interface TransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MessageReference?: string;
  Status?: string;
  // Possible status values from the API
  status?: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class CoopBankService {
  private config: CoopBankConfig;
  /** Base URL — read from env or use production default */
  private readonly baseUrl: string;
  /** Token endpoint */
  private readonly tokenUrl: string;
  /** STK Push endpoint */
  private readonly stkPushUrl: string;
  /** STK Status endpoint */
  private readonly stkStatusUrl: string;
  /** In-memory token cache */
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: CoopBankConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://openapi.co-opbank.co.ke';
    
    // Handle both full URLs and path-only formats
    this.tokenUrl = this.normalizeUrl(config.tokenUrl, '/token');
    this.stkPushUrl = this.normalizeUrl(config.stkPushUrl, '/FT/stk/1.0.0');
    this.stkStatusUrl = this.normalizeUrl(config.stkStatusUrl, '/Enquiry/STK/1.0.0/');
  }

  /**
   * Normalize URL to handle both full URLs and path-only formats.
   * If url starts with /, prepend baseUrl. Otherwise use as-is.
   */
  private normalizeUrl(url: string | undefined, defaultPath: string): string {
    if (!url) {
      return `${this.baseUrl}${defaultPath}`;
    }
    if (url.startsWith('/')) {
      return `${this.baseUrl}${url}`;
    }
    return url; // Assume it's a full URL
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Obtain an OAuth2 access token using client-credentials grant.
   * Uses Bearer Token authentication with pre-encoded Basic auth credentials.
   * Caches the token with a 60-second buffer before expiry (as per documentation).
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    console.log('[v0] Co-op Bank Token Request:');
    console.log('[v0]   Token URL:', this.tokenUrl);
    console.log('[v0]   Using Bearer Token auth with Authorization header');

    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        // Pre-encoded Basic auth string from environment
        Authorization: this.config.basicAuth,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Must be sent as raw text — not JSON and not form-encoded key=value object
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[v0] Token request failed:', {
        status: response.status,
        error,
        tokenUrl: this.tokenUrl,
      });
      throw new Error(`Co-op Bank token request failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as TokenResponse;

    if (!data.access_token) {
      throw new Error('Co-op Bank returned a token response with no access_token');
    }

    // Cache with 60-second safety buffer before expiry (as per documentation)
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    console.log('[v0] Token obtained successfully, expires in:', data.expires_in, 'seconds');

    return data.access_token;
  }

  // -------------------------------------------------------------------------
  // STK Push
  // -------------------------------------------------------------------------

  /**
   * Initiate an STK Push prompt on the customer's phone.
   *
   * Payload format matches SANDRA OTIENO SCHOLINE Postman collection exactly:
   * - All keys in PascalCase
   * - OtherDetails as array of {Name, Value} objects
   * - Amount as integer (KES)
   * - MessageDateTime in ISO format
   *
   * @param phoneNumber   Customer phone in any common KE format (07..., 254..., +254...)
   * @param amount        Amount in KES — whole number (fractions are truncated)
   * @param narration     Short description shown on the M-Pesa prompt (max 60 chars)
   * @param callbackUrl   Your server URL that Co-op Bank will POST the result to
   * @param messageReference  Unique idempotency key; auto-generated if omitted
   */
  async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    narration: string,
    callbackUrl: string,
    messageReference?: string
  ): Promise<STKPushResponse> {
    const token = await this.getAccessToken();

    const msgRef =
      messageReference ||
      `SANDY${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const formattedPhone = CoopBankService.normalisePhone(phoneNumber);

    console.log('[v0] STK Push Request Details:');
    console.log('[v0]   Phone:', formattedPhone);
    console.log('[v0]   Amount:', amount, 'KES');
    console.log('[v0]   Message Reference:', msgRef);
    console.log('[v0]   Callback URL:', callbackUrl);

    // PascalCase payload exactly as per Postman collection
    // https://github.com/iantech-cloud/sandy/blob/main/SANDRA_OTIENO_SCHOLINE.postman_collection.json
    const payload = {
      MessageReference: msgRef,
      CallBackUrl: callbackUrl,
      OperatorCode: this.config.operatorCode,
      TransactionCurrency: 'KES',
      MobileNumber: formattedPhone,
      Narration: narration.substring(0, 60),
      Amount: Math.floor(amount), // Must be integer, not float
      MessageDateTime: new Date().toISOString(),
      OtherDetails: [
        {
          Name: 'ReferenceNumber',
          Value: msgRef,
        },
      ],
    };

    console.log('[v0] STK Push Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(this.stkPushUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log('[v0] STK Push Response Status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[v0] STK Push Error Response:', error);
      throw new Error(`Co-op Bank STK Push failed (${response.status}): ${error}`);
    }

    const result = (await response.json()) as STKPushResponse;

    console.log('[v0] STK Push Success Response:', JSON.stringify(result, null, 2));

    // Attach the message reference we sent so callers can always access it
    result.MessageReference = msgRef;

    return result;
  }

  // -------------------------------------------------------------------------
  // Transaction status
  // -------------------------------------------------------------------------

  /**
   * Query the status of a previously initiated STK Push.
   *
   * @param messageReference  The same reference used when initiating the push
   */
  async getTransactionStatus(messageReference: string): Promise<TransactionStatusResponse> {
    const token = await this.getAccessToken();

    console.log('[v0] STK Status Request:');
    console.log('[v0]   Message Reference:', messageReference);
    console.log('[v0]   Status URL:', this.stkStatusUrl);

    const statusPayload = { MessageReference: messageReference };

    const response = await fetch(this.stkStatusUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(statusPayload),
    });

    console.log('[v0] STK Status Response Status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('[v0] STK Status Error Response:', error);
      throw new Error(`Co-op Bank status query failed (${response.status}): ${error}`);
    }

    const result = (await response.json()) as TransactionStatusResponse;

    console.log('[v0] STK Status Result:', JSON.stringify(result, null, 2));

    return result;
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Normalise a Kenyan phone number to the 254XXXXXXXXX format.
   */
  static normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
    if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
    if (digits.startsWith('1') && digits.length === 9) return `254${digits}`;

    // Fallback: strip leading + and return
    return digits.startsWith('+') ? digits.slice(1) : digits;
  }

  /**
   * Map a Co-op Bank ResponseCode to a local payment status.
   * ResponseCode '0' === success; anything else is a failure or still pending.
   */
  static mapResponseCode(
    responseCode: string
  ): 'completed' | 'pending' | 'failed' | 'cancelled' | 'timeout' {
    switch (responseCode) {
      case '0':
        return 'completed';
      case '2002':
        return 'cancelled'; // User cancelled
      case '2001':
        return 'timeout';   // Request timed out
      case '1':             // Still processing (poll again)
        return 'pending';
      default:
        return 'failed';
    }
  }
}

// ---------------------------------------------------------------------------
// Factory — singleton-per-request using env vars
// ---------------------------------------------------------------------------

export function createCoopBankService(): CoopBankService {
  const basicAuth = process.env.COOP_BANK_BASIC_AUTH;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
  const baseUrl = process.env.COOP_BANK_BASE_URL;
  const tokenUrl = process.env.COOP_BANK_TOKEN_ENDPOINT;
  const stkPushUrl = process.env.COOP_BANK_STK_PUSH_ENDPOINT;
  const stkStatusUrl = process.env.COOP_BANK_STK_STATUS_ENDPOINT;

  console.log('[v0] createCoopBankService - Environment vars:');
  console.log('[v0]   COOP_BANK_BASIC_AUTH exists:', !!basicAuth, 'starts with Basic:', basicAuth?.startsWith('Basic'));
  console.log('[v0]   COOP_BANK_OPERATOR_CODE:', operatorCode);
  console.log('[v0]   Token URL:', tokenUrl);
  console.log('[v0]   STK Push URL:', stkPushUrl);
  console.log('[v0]   STK Status URL:', stkStatusUrl);

  if (!basicAuth) throw new Error('Missing env var: COOP_BANK_BASIC_AUTH (must be "Basic <base64...>")');
  if (!operatorCode) throw new Error('Missing env var: COOP_BANK_OPERATOR_CODE');

  return new CoopBankService({
    basicAuth,
    operatorCode,
    baseUrl,
    tokenUrl,
    stkPushUrl,
    stkStatusUrl,
  });
}

/*
 * ---------------------------------------------------------------------------
 * FALLBACK: M-Pesa implementation (commented out — kept for quick rollback)
 * ---------------------------------------------------------------------------
 *
 * To switch back to M-Pesa, uncomment this block and update callers to import
 * `initiateMpesaSTKPush` / `queryMpesaStatus` instead of CoopBankService.
 *
 * import crypto from 'crypto';
 *
 * const MPESA_CONFIG = {
 *   businessShortCode: process.env.MPESA_SHORTCODE!,
 *   passKey: process.env.MPESA_PASSKEY!,
 *   consumerKey: process.env.MPESA_CONSUMER_KEY!,
 *   consumerSecret: process.env.MPESA_CONSUMER_SECRET!,
 *   callbackUrl: process.env.MPESA_CALLBACK_URL!,
 *   environment: process.env.MPESA_ENVIRONMENT || 'sandbox',
 * };
 *
 * export async function getMpesaAccessToken() { ... }
 * export async function initiateMpesaSTKPush({ amount, phoneNumber, accountReference, transactionDesc }) { ... }
 * export async function queryMpesaStatus(checkoutRequestId) { ... }
 *
 * ---------------------------------------------------------------------------
 */
