/**
 * Co-operative Bank STK Push Service
 *
 * Based on official Postman collection (SANDRA OTIENO SCHOLINE):
 *   Token:  POST https://openapi.co-opbank.co.ke/token
 *           Header: Authorization: Basic <base64(clientId:clientSecret)>
 *           Body (raw text): grant_type=client_credentials
 *
 *   STK Push: POST https://openapi.co-opbank.co.ke/FT/stk/1.0.0
 *           Header: Authorization: Bearer <token>
 *           Body (JSON, PascalCase keys)
 *
 *   Status: POST https://openapi.co-opbank.co.ke/Enquiry/STK/1.0.0/
 *           Header: Authorization: Bearer <token>
 *           Body: { "MessageReference": "<ref>" }
 *
 * M-Pesa implementation is kept below but commented out as a fallback.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoopBankConfig {
  clientId: string;
  clientSecret: string;
  operatorCode: string;
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
  /** Production base URL — Co-op Bank only exposes one endpoint set */
  private readonly baseUrl = 'https://openapi.co-opbank.co.ke';
  /** In-memory token cache */
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: CoopBankConfig) {
    this.config = config;
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Obtain an OAuth2 access token using client-credentials grant.
   * Caches the token with a 5-minute buffer before expiry.
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      return this.tokenCache.token;
    }

    const credentials = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`
    ).toString('base64');

    const response = await fetch(`${this.baseUrl}/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Must be sent as raw text — not JSON and not form-encoded key=value object
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Co-op Bank token request failed (${response.status}): ${error}`);
    }

    const data = (await response.json()) as TokenResponse;

    if (!data.access_token) {
      throw new Error('Co-op Bank returned a token response with no access_token');
    }

    // Cache with 5-minute safety buffer
    this.tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 300) * 1000,
    };

    return data.access_token;
  }

  // -------------------------------------------------------------------------
  // STK Push
  // -------------------------------------------------------------------------

  /**
   * Initiate an STK Push prompt on the customer's phone.
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

    // PascalCase keys as required by the Co-op Bank API (from Postman collection)
    const payload = {
      MessageReference: msgRef,
      CallBackUrl: callbackUrl,
      OperatorCode: this.config.operatorCode,
      TransactionCurrency: 'KES',
      MobileNumber: formattedPhone,
      Narration: narration.substring(0, 60),
      Amount: Math.floor(amount),
      MessageDateTime: new Date().toISOString(),
      OtherDetails: [
        {
          Name: 'ReferenceNumber',
          Value: msgRef,
        },
      ],
    };

    const response = await fetch(`${this.baseUrl}/FT/stk/1.0.0`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Co-op Bank STK Push failed (${response.status}): ${error}`);
    }

    const result = (await response.json()) as STKPushResponse;

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

    const response = await fetch(`${this.baseUrl}/Enquiry/STK/1.0.0/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ MessageReference: messageReference }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Co-op Bank status query failed (${response.status}): ${error}`);
    }

    return (await response.json()) as TransactionStatusResponse;
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
  const clientId = process.env.COOP_BANK_CLIENT_ID;
  const clientSecret = process.env.COOP_BANK_CLIENT_SECRET;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;

  if (!clientId) throw new Error('Missing env var: COOP_BANK_CLIENT_ID');
  if (!clientSecret) throw new Error('Missing env var: COOP_BANK_CLIENT_SECRET');
  if (!operatorCode) throw new Error('Missing env var: COOP_BANK_OPERATOR_CODE');

  return new CoopBankService({ clientId, clientSecret, operatorCode });
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
