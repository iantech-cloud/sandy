/**
 * Safaricom M-Pesa Daraja 3.0 STK Push Service
 * 
 * Production API Endpoints:
 *   OAuth Token: POST https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
 *                Headers: Authorization: Basic <base64(Consumer Key:Consumer Secret)>
 *
 *   STK Push: POST https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
 *             Headers: Authorization: Bearer <access_token>
 *             Body: JSON with transaction details
 *
 *   Query Status: POST https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query
 *                 Headers: Authorization: Bearer <access_token>
 *                 Body: { "BusinessShortCode", "Password", "Timestamp", "CheckoutRequestID" }
 */

import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MpesaDarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  shortCode: string; // Business Short Code (e.g., "174379")
  passkey: string; // M-Pesa Online Passkey (from Daraja portal)
  baseUrl?: string;
  tokenUrl?: string;
  stkPushUrl?: string;
  queryUrl?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

export interface STKPushResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  
  // Alternative field names from API
  Body?: {
    stkPopupResponse?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResponseCode: string;
      ResponseDescription: string;
      CustomerMessage: string;
    };
  };
  
  errorCode?: string;
  errorMessage?: string;
}

export interface QueryStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
  
  // Nested response from Daraja
  Body?: {
    stkPopupResponse?: {
      ResponseCode: string;
      ResponseDescription: string;
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode?: string;
      ResultDesc?: string;
      Amount?: number;
      MpesaReceiptNumber?: string;
      Balance?: number;
      TransactionDate?: string;
    };
  };
  
  errorCode?: string;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

export class MpesaDarajaService {
  private config: MpesaDarajaConfig;
  private readonly baseUrl: string;
  private readonly tokenUrl: string;
  private readonly stkPushUrl: string;
  private readonly queryUrl: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: MpesaDarajaConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.safaricom.co.ke';
    this.tokenUrl = config.tokenUrl || `${this.baseUrl}/oauth/v1/generate`;
    this.stkPushUrl = config.stkPushUrl || `${this.baseUrl}/mpesa/stkpush/v1/processrequest`;
    this.queryUrl = config.queryUrl || `${this.baseUrl}/mpesa/stkpushquery/v1/query`;
  }

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  /**
   * Obtain OAuth 2.0 access token using client credentials grant.
   * Tokens are cached until ~60 seconds before expiry.
   */
  async getAccessToken(attempt: number = 1, forceRefresh: boolean = false): Promise<string> {
    const maxAttempts = 2;

    if (!forceRefresh && this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      console.log('[v0] Using cached M-Pesa access token');
      return this.tokenCache.token;
    }

    console.log(`[v0] Fetching M-Pesa access token (Attempt ${attempt}/${maxAttempts})`);

    try {
      const credentials = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`
      ).toString('base64');

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 10000);

      const response = await fetch(`${this.tokenUrl}?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        signal: abortController.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[v0] M-Pesa token request failed (${response.status}):`, errorText);

        if (attempt < maxAttempts && response.status >= 500) {
          const backoffMs = attempt * 1000;
          console.log(`[v0] Retrying M-Pesa token in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          return this.getAccessToken(attempt + 1, forceRefresh);
        }

        throw new Error(`M-Pesa token request failed (${response.status})`);
      }

      const data = (await response.json()) as TokenResponse;

      if (!data.access_token) {
        throw new Error('M-Pesa returned invalid token response');
      }

      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 60) * 1000,
      };

      console.log(`[v0] M-Pesa token obtained (valid for ~${data.expires_in - 60}s)`);

      return data.access_token;
    } catch (error) {
      this.tokenCache = null;

      if (error instanceof Error && error.message.includes('AbortError')) {
        console.error('[v0] M-Pesa token request timeout');
      } else {
        console.error('[v0] M-Pesa token error:', error instanceof Error ? error.message : String(error));
      }

      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // STK Push
  // -------------------------------------------------------------------------

  /**
   * Initiate STK Push prompt on customer's phone.
   * @param phoneNumber    Customer phone (07... or 254...)
   * @param amount         Amount in KES
   * @param narration      Transaction description
   * @param callbackUrl    Server URL to receive result
   * @param accountReference Transaction reference/ID
   */
  async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    narration: string,
    callbackUrl: string,
    accountReference: string
  ): Promise<STKPushResponse> {
    const token = await this.getAccessToken();
    const formattedPhone = MpesaDarajaService.normalisePhone(phoneNumber);

    // Generate timestamp and password for Daraja API
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    console.log('[v0] M-Pesa STK Push Request:');
    console.log('[v0]   Phone:', formattedPhone);
    console.log('[v0]   Amount:', amount, 'KES');
    console.log('[v0]   Account Reference:', accountReference);

    const payload = {
      BusinessShortCode: this.config.shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(amount),
      PartyA: formattedPhone,
      PartyB: this.config.shortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: narration.substring(0, 60),
    };

    console.log('[v0] M-Pesa STK Push Payload:', JSON.stringify(payload, null, 2));

    try {
      const abortController = new AbortController();
      const timeoutMs = parseInt(process.env.STK_PUSH_TIMEOUT_MS || '15000', 10);
      const timeout = setTimeout(() => abortController.abort(), timeoutMs);

      const response = await fetch(this.stkPushUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      clearTimeout(timeout);

      console.log('[v0] M-Pesa STK Push response received (HTTP', response.status + ')');

      const result = (await response.json()) as STKPushResponse;

      // Extract nested response if present
      if (result.Body?.stkPopupResponse) {
        const nested = result.Body.stkPopupResponse;
        return {
          ResponseCode: nested.ResponseCode,
          ResponseDescription: nested.ResponseDescription,
          MerchantRequestID: nested.MerchantRequestID,
          CheckoutRequestID: nested.CheckoutRequestID,
        };
      }

      // Check for error response
      if (result.errorCode) {
        throw new Error(result.errorMessage || `M-Pesa STK Push failed (${result.errorCode})`);
      }

      console.log('[v0] M-Pesa STK Push Success:', {
        ResponseCode: result.ResponseCode,
        MerchantRequestID: result.MerchantRequestID,
        CheckoutRequestID: result.CheckoutRequestID,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('[v0] M-Pesa STK Push timeout');
        throw new Error('M-Pesa STK Push timed out. Please try again.');
      }
      console.error('[v0] M-Pesa STK Push error:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Query Status
  // -------------------------------------------------------------------------

  /**
   * Query the status of a previously initiated STK Push.
   * @param checkoutRequestID  The CheckoutRequestID returned from STK Push
   */
  async queryTransactionStatus(checkoutRequestID: string): Promise<QueryStatusResponse> {
    const token = await this.getAccessToken();
    const timestamp = this.getTimestamp();
    const password = this.generatePassword(timestamp);

    console.log('[v0] M-Pesa Query Status Request:');
    console.log('[v0]   CheckoutRequestID:', checkoutRequestID);

    const payload = {
      BusinessShortCode: this.config.shortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestID,
    };

    console.log('[v0] M-Pesa Query Payload:', JSON.stringify(payload, null, 2));

    try {
      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 60000);

      const response = await fetch(this.queryUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      clearTimeout(timeout);

      console.log('[v0] M-Pesa Query response received (HTTP', response.status + ')');

      const result = (await response.json()) as QueryStatusResponse;

      // Extract nested response if present
      if (result.Body?.stkPopupResponse) {
        const nested = result.Body.stkPopupResponse;
        return {
          ResponseCode: nested.ResponseCode,
          ResponseDescription: nested.ResponseDescription,
          ResultCode: nested.ResultCode,
          ResultDesc: nested.ResultDesc,
          MerchantRequestID: nested.MerchantRequestID,
          CheckoutRequestID: nested.CheckoutRequestID,
        };
      }

      // Check for error response
      if (result.errorCode) {
        throw new Error(result.errorMessage || `M-Pesa query failed (${result.errorCode})`);
      }

      console.log('[v0] M-Pesa Query Status Result:', {
        ResponseCode: result.ResponseCode,
        ResultCode: result.ResultCode,
      });

      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('AbortError')) {
        console.error('[v0] M-Pesa query timeout');
      }
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Normalize Kenyan phone number to 254XXXXXXXXX format.
   */
  static normalisePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');

    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
    if (digits.startsWith('7') && digits.length === 9) return `254${digits}`;
    if (digits.startsWith('1') && digits.length === 9) return `254${digits}`;

    return digits.startsWith('+') ? digits.slice(1) : digits;
  }

  /**
   * Get current timestamp in YYYYMMDDHHmmss format (required by M-Pesa).
   */
  private getTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Generate M-Pesa password: Base64(BusinessShortCode + Passkey + Timestamp)
   */
  private generatePassword(timestamp: string): string {
    const combined = this.config.shortCode + this.config.passkey + timestamp;
    return Buffer.from(combined).toString('base64');
  }

  /**
   * Map M-Pesa result code to local payment status.
   * 
   * 0 = Success (completed transaction)
   * 1 = Insufficient funds
   * Other = Various errors → Failed
   * 
   * No explicit "pending" code from M-Pesa; if query returns ResponseCode 0 but
   * no ResultCode, transaction is likely still processing.
   */
  static mapResultCode(
    resultCode: string | undefined,
    responseCode: string
  ): 'completed' | 'pending' | 'failed' | 'cancelled' | 'timeout' {
    // If ResponseCode is 0, transaction succeeded
    if (responseCode === '0' && (resultCode === '0' || resultCode === undefined)) {
      return 'completed';
    }

    // User-initiated cancellations or timeouts
    if (responseCode === '1032' || resultCode === '1032') {
      return 'cancelled'; // User cancelled
    }

    if (responseCode === '1001' || resultCode === '1001') {
      return 'timeout'; // Request timeout
    }

    // No ResultCode yet means still pending
    if (!resultCode && responseCode === '0') {
      return 'pending';
    }

    // Any other code is a failure
    return 'failed';
  }
}

// ---------------------------------------------------------------------------
// Factory — singleton-per-request using env vars
// ---------------------------------------------------------------------------

export function createMpesaDarajaService(): MpesaDarajaService {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!consumerKey || !consumerSecret || !shortCode || !passkey) {
    throw new Error(
      'Missing M-Pesa credentials: MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORT_CODE, MPESA_PASSKEY'
    );
  }

  return new MpesaDarajaService({
    consumerKey,
    consumerSecret,
    shortCode,
    passkey,
  });
}
