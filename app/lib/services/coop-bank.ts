/**
 * Co-operative Bank M-Pesa STK Push Service
 * Handles authentication, STK push initiation, and transaction status checks
 */

interface CoopBankConfig {
  clientId: string;
  clientSecret: string;
  operatorCode: string;
  environment: 'sandbox' | 'production';
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface STKPushRequest {
  messageReference: string;
  callBackUrl: string;
  operatorCode: string;
  transactionCurrency: string;
  mobileNumber: string;
  narration: string;
  amount: number;
  messageDateTime: string;
  otherDetails?: Array<{ name: string; value: string }>;
}

interface STKPushResponse {
  responseCode: string;
  responseDescription: string;
  operatorTxnID: string;
  conversationID: string;
  originalConversationID?: string;
}

interface TransactionStatusResponse {
  responseCode: string;
  responseDescription: string;
  status: string;
  originalConversationID?: string;
  operatorTxnID?: string;
}

export class CoopBankService {
  private config: CoopBankConfig;
  private baseUrl: string;
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(config: CoopBankConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? 'https://openapi.co-opbank.co.ke'
        : 'https://sandbox.co-opbank.co.ke'; // Update with actual sandbox URL if different
  }

  /**
   * Get access token using Client Credentials flow
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now()) {
      console.log('[CoopBank] Using cached access token');
      return this.tokenCache.token;
    }

    try {
      console.log('[CoopBank] Fetching new access token...');

      const credentials = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString('base64');

      const response = await fetch(`${this.baseUrl}/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get token: ${error}`);
      }

      const data = (await response.json()) as TokenResponse;

      // Cache token with 5-minute buffer before expiry
      this.tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in - 300) * 1000,
      };

      console.log('[CoopBank] Access token obtained and cached');
      return data.access_token;
    } catch (error) {
      console.error('[CoopBank] Token retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Initiate STK Push for M-Pesa payment
   */
  async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    narration: string,
    callbackUrl: string,
    messageReference?: string
  ): Promise<STKPushResponse> {
    try {
      const token = await this.getAccessToken();

      // Generate message reference if not provided
      const msgRef =
        messageReference || `MSG${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

      // Format phone number (remove +, ensure 254 format)
      let formattedPhone = phoneNumber;
      if (formattedPhone.startsWith('+254')) {
        formattedPhone = formattedPhone.substring(1);
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = `254${formattedPhone.substring(1)}`;
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = `254${formattedPhone}`;
      }

      const payload: STKPushRequest = {
        messageReference: msgRef,
        callBackUrl: callbackUrl,
        operatorCode: this.config.operatorCode,
        transactionCurrency: 'KES',
        mobileNumber: formattedPhone,
        narration: narration.substring(0, 60), // Limit narration to 60 chars
        amount: Math.floor(amount), // Whole KES amount
        messageDateTime: new Date().toISOString(),
        otherDetails: [
          {
            name: 'ReferenceNumber',
            value: msgRef,
          },
        ],
      };

      console.log('[CoopBank] Initiating STK Push with:', {
        messageReference: msgRef,
        amount,
        mobileNumber: formattedPhone,
        narration,
      });

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
        throw new Error(`STK Push failed: ${error}`);
      }

      const result = (await response.json()) as STKPushResponse;

      console.log('[CoopBank] STK Push initiated successfully:', {
        responseCode: result.responseCode,
        operatorTxnID: result.operatorTxnID,
      });

      return result;
    } catch (error) {
      console.error('[CoopBank] STK Push initiation failed:', error);
      throw error;
    }
  }

  /**
   * Check transaction status
   */
  async getTransactionStatus(messageReference: string): Promise<TransactionStatusResponse> {
    try {
      const token = await this.getAccessToken();

      const payload = {
        messageReference: messageReference,
      };

      console.log('[CoopBank] Checking transaction status for:', messageReference);

      const response = await fetch(`${this.baseUrl}/Enquiry/STK/1.0.0/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Status check failed: ${error}`);
      }

      const result = (await response.json()) as TransactionStatusResponse;

      console.log('[CoopBank] Transaction status retrieved:', {
        messageReference,
        status: result.status,
        responseCode: result.responseCode,
      });

      return result;
    } catch (error) {
      console.error('[CoopBank] Transaction status check failed:', error);
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  static validateConfig(config: Partial<CoopBankConfig>): string | null {
    if (!config.clientId) return 'Missing clientId';
    if (!config.clientSecret) return 'Missing clientSecret';
    if (!config.operatorCode) return 'Missing operatorCode';
    if (!config.environment) return 'Missing environment';
    return null;
  }
}

/**
 * Factory function to create CoopBankService from environment variables
 */
export function createCoopBankService(): CoopBankService {
  const clientId = process.env.COOP_BANK_CLIENT_ID;
  const clientSecret = process.env.COOP_BANK_CLIENT_SECRET;
  const operatorCode = process.env.COOP_BANK_OPERATOR_CODE;
  const environment = (process.env.COOP_BANK_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

  const validationError = CoopBankService.validateConfig({
    clientId,
    clientSecret,
    operatorCode,
    environment,
  });

  if (validationError) {
    throw new Error(`CoopBank Configuration Error: ${validationError}`);
  }

  return new CoopBankService({
    clientId: clientId!,
    clientSecret: clientSecret!,
    operatorCode: operatorCode!,
    environment,
  });
}
