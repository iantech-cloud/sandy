import {
  DarajaOAuthResponse,
  DarajaMPesaExpressRequest,
  DarajaMPesaExpressResponse,
  DarajaTransactionStatusRequest,
  DarajaTransactionStatusResponse,
  DarajaPaymentRequest,
  DarajaPaymentResponse,
  DarajaCallbackBody,
  DarajaConfig,
  DarajaB2CPaymentRequest,
  DarajaB2CPaymentResponse,
  DarajaC2BRegisterRequest,
  DarajaC2BRegisterResponse,
  DarajaB2BPaymentRequest,
  DarajaB2BPaymentResponse,
  DarajaBalanceRequest,
  DarajaBalanceResponse,
  DarajaReversalRequest,
  DarajaReversalResponse,
} from '@/app/lib/types/mpesa-daraja';
import {
  encryptSecurityCredential,
  getMpesaPublicKey,
  validatePhoneNumber,
  generateConversationId,
  generateTransactionReference,
  sanitizeTransactionDescription,
} from '@/app/lib/utils/mpesa-security';

/**
 * M-PESA Daraja API Service
 * Handles all payment processing through Safaricom M-PESA Daraja APIs
 * 
 * Key Features:
 * - OAuth 2.0 token generation with client credentials
 * - STK Push (M-PESA Express) payment initiation
 * - Transaction status queries
 * - Webhook callback handling
 * - Phone number normalization for Kenyan numbers
 */
export class MpesaDarajaService {
  private static config: DarajaConfig = {
    consumerKey: process.env.DARAJA_CONSUMER_KEY || '',
    consumerSecret: process.env.DARAJA_CONSUMER_SECRET || '',
    businessShortCode: process.env.DARAJA_BUSINESS_SHORT_CODE || '',
    passkey: process.env.DARAJA_PASSKEY || '',
    baseUrl: process.env.DARAJA_BASE_URL || 'https://sandbox.safaricom.co.ke',
    oauthUrl: process.env.DARAJA_OAUTH_URL || 'https://sandbox.safaricom.co.ke/oauth/v1/generate',
    stkPushUrl: process.env.DARAJA_STK_PUSH_URL || 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
    statusCheckUrl: process.env.DARAJA_STATUS_CHECK_URL || 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
  };

  private static accessToken: string | null = null;
  private static tokenExpiry: number = 0;

  /**
   * Generate OAuth access token
   * Token expires after 3600 seconds (1 hour)
   */
  static async getAccessToken(): Promise<string> {
    try {
      // Check if token is still valid
      if (this.accessToken && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      if (!this.config.consumerKey || !this.config.consumerSecret) {
        throw new Error('Daraja credentials not configured');
      }

      // Encode credentials in base64
      const encodedCredentials = Buffer.from(
        `${this.config.consumerKey}:${this.config.consumerSecret}`
      ).toString('base64');

      const response = await fetch(this.config.oauthUrl!, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${encodedCredentials}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OAuth token generation failed: ${error}`);
      }

      const data: DarajaOAuthResponse = await response.json();

      // Cache token with 5 minutes buffer before expiry
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      console.error('[MpesaDarajaService] Error getting access token:', error);
      throw error;
    }
  }

  /**
   * Initiate M-PESA Express (STK Push) payment
   * Sends a prompt to customer's phone to enter M-PESA PIN
   */
  static async initiatePayment(
    paymentRequest: DarajaPaymentRequest,
    callbackUrl: string
  ): Promise<DarajaPaymentResponse> {
    try {
      if (!this.config.businessShortCode || !this.config.passkey) {
        throw new Error('Daraja business credentials not configured');
      }

      // Get access token
      const accessToken = await this.getAccessToken();

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(paymentRequest.phoneNumber);

      // Generate timestamp in required format: YYYYMMDDHHmmss
      const timestamp = this.generateTimestamp();

      // Generate password: Base64(ShortCode + Passkey + Timestamp)
      const password = this.generatePassword(
        this.config.businessShortCode,
        this.config.passkey,
        timestamp
      );

      // Prepare STK Push request
      const stkPushRequest: DarajaMPesaExpressRequest = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: paymentRequest.transactionType || 'CustomerPayBillOnline',
        Amount: Math.ceil(paymentRequest.amount), // Amount must be a whole number
        PartyA: normalizedPhone,
        PartyB: this.config.partyB || this.config.businessShortCode,
        PhoneNumber: normalizedPhone,
        CallBackURL: callbackUrl,
        AccountReference: paymentRequest.accountReference,
        TransactionDesc: paymentRequest.description || 'HustleHub Africa Payment',
      };

      // Make STK Push request
      const response = await fetch(this.config.stkPushUrl!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPushRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return {
          success: false,
          message: error.errorMessage || 'STK Push initiation failed',
          error: JSON.stringify(error),
        };
      }

      const data: DarajaMPesaExpressResponse = await response.json();

      if (data.ResponseCode === '0') {
        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          merchantRequestId: data.MerchantRequestID,
          message: 'Payment initiated successfully',
        };
      } else {
        return {
          success: false,
          message: data.ResponseDescription || 'Payment initiation failed',
          error: data.ResponseCode,
        };
      }
    } catch (error: any) {
      console.error('[MpesaDarajaService] Error initiating payment:', error);
      return {
        success: false,
        message: error.message || 'Payment service error',
        error: error.message,
      };
    }
  }

  /**
   * Check payment transaction status
   */
  static async checkTransactionStatus(
    checkoutRequestId: string
  ): Promise<DarajaTransactionStatusResponse> {
    try {
      if (!this.config.businessShortCode || !this.config.passkey) {
        throw new Error('Daraja business credentials not configured');
      }

      const accessToken = await this.getAccessToken();
      const timestamp = this.generateTimestamp();
      const password = this.generatePassword(
        this.config.businessShortCode,
        this.config.passkey,
        timestamp
      );

      const statusRequest: DarajaTransactionStatusRequest = {
        BusinessShortCode: this.config.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      };

      const response = await fetch(this.config.statusCheckUrl!, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(statusRequest),
      });

      if (!response.ok) {
        throw new Error(`Status check failed: ${response.statusText}`);
      }

      const data: DarajaTransactionStatusResponse = await response.json();
      return data;
    } catch (error: any) {
      console.error('[MpesaDarajaService] Error checking transaction status:', error);
      throw error;
    }
  }

  /**
   * Handle webhook callback from M-PESA
   * Called when user completes or cancels the M-PESA payment
   */
  static async handleWebhookCallback(body: DarajaCallbackBody): Promise<{
    success: boolean;
    resultCode: number;
    description: string;
  }> {
    try {
      const stkCallback = body.Body?.stkCallback;

      if (!stkCallback) {
        throw new Error('Invalid callback payload');
      }

      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const merchantRequestId = stkCallback.MerchantRequestID;

      // Parse callback metadata
      let amount: number | undefined;
      let receiptNumber: string | undefined;
      let phoneNumber: string | undefined;

      if (stkCallback.CallbackMetadata?.Item) {
        for (const item of stkCallback.CallbackMetadata.Item) {
          switch (item.Name) {
            case 'Amount':
              amount = typeof item.Value === 'number' ? item.Value : parseFloat(String(item.Value));
              break;
            case 'MpesaReceiptNumber':
              receiptNumber = String(item.Value);
              break;
            case 'PhoneNumber':
              phoneNumber = String(item.Value);
              break;
          }
        }
      }

      // Result Code 0 = Success, 1 = User cancelled, other = various errors
      const success = resultCode === 0;

      console.log('[MpesaDarajaService] Webhook callback processed:', {
        checkoutRequestId,
        merchantRequestId,
        resultCode,
        resultDesc,
        success,
      });

      return {
        success,
        resultCode,
        description: resultDesc,
      };
    } catch (error: any) {
      console.error('[MpesaDarajaService] Error handling webhook:', error);
      return {
        success: false,
        resultCode: -1,
        description: error.message,
      };
    }
  }

  /**
   * Normalize phone number to E.164 format (254XXXXXXXXX)
   */
  private static normalizePhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // If starts with 0 (local Kenya format), replace with 254
    if (cleaned.startsWith('0')) {
      return `254${cleaned.substring(1)}`;
    }

    // If already has country code 254, just return
    if (cleaned.startsWith('254')) {
      return cleaned;
    }

    // If just has 9 digits (Kenyan mobile), add country code
    if (cleaned.length === 9) {
      return `254${cleaned}`;
    }

    // If has 10 digits starting with 7, add country code
    if (cleaned.length === 10 && cleaned.startsWith('7')) {
      return `254${cleaned.substring(1)}`;
    }

    // Fallback: assume it's a Kenya number and prepend 254
    return `254${cleaned.slice(-9)}`;
  }

  /**
   * Generate timestamp in required format: YYYYMMDDHHmmss
   */
  private static generateTimestamp(): string {
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
   * Generate password: Base64(ShortCode + Passkey + Timestamp)
   */
  private static generatePassword(
    shortCode: string,
    passkey: string,
    timestamp: string
  ): string {
    const passwordString = `${shortCode}${passkey}${timestamp}`;
    return Buffer.from(passwordString).toString('base64');
  }

  /**
   * Get auth headers for API requests
   */
  static getAuthHeaders(accessToken: string): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
  }

  /**
   * B2C Payment - Spin Wallet Payout (Business to Customer)
   * Sends money to customer's M-PESA wallet
   * Used for: Salaries, Promotions, Business payments, Wallet credits
   * 
   * Command IDs:
   * - SalaryPayment: Regular salary disbursement
   * - BusinessPayment: Payment to registered customers
   * - PromotionPayment: Promotional funds with message
   */
  static async initiateB2CPayment(
    phoneNumber: string,
    amount: number,
    commandId: 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment' = 'BusinessPayment',
    remarks: string = 'HustleHub Africa Payment',
    callbackUrl: string
  ): Promise<DarajaB2CPaymentResponse | { success: false; error: string }> {
    try {
      if (!this.config.businessShortCode) {
        throw new Error('Business short code not configured');
      }

      const accessToken = await this.getAccessToken();
      const normalizedPhone = validatePhoneNumber(phoneNumber);
      const conversationId = generateConversationId();
      const initiatorName = process.env.DARAJA_INITIATOR_NAME || 'api_operator';
      const initiatorPassword = process.env.DARAJA_INITIATOR_PASSWORD || '';

      if (!initiatorPassword) {
        throw new Error('Initiator password not configured for B2C');
      }

      // Encrypt security credentials
      const publicKey = getMpesaPublicKey(this.config.baseUrl?.includes('sandbox') ? 'sandbox' : 'production');
      const securityCredential = encryptSecurityCredential(initiatorPassword, publicKey);

      const b2cRequest: DarajaB2CPaymentRequest = {
        OriginatorConversationID: conversationId,
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: commandId,
        Amount: Math.ceil(amount),
        PartyA: this.config.businessShortCode,
        PartyB: normalizedPhone,
        Remarks: sanitizeTransactionDescription(remarks),
        QueueTimeOutURL: callbackUrl,
        ResultURL: callbackUrl,
      };

      const b2cUrl = this.config.baseUrl?.includes('sandbox')
        ? 'https://sandbox.safaricom.co.ke/mpesa/b2c/v3/paymentrequest'
        : 'https://api.safaricom.co.ke/mpesa/b2c/v3/paymentrequest';

      const response = await fetch(b2cUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(accessToken),
        body: JSON.stringify(b2cRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: JSON.stringify(error) };
      }

      return await response.json();
    } catch (error: any) {
      console.error('[MpesaDarajaService] B2C Payment Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * C2B Register - Spin Wallet / Chat Foreigners Setup
   * Registers your business short code for receiving customer payments
   * Enables C2B validation and confirmation URLs for real-time processing
   */
  static async registerC2B(
    shortCode: string,
    validationUrl: string,
    confirmationUrl: string,
    responseType: 'Completed' | 'Cancel' = 'Completed'
  ): Promise<DarajaC2BRegisterResponse | { success: false; error: string }> {
    try {
      const accessToken = await this.getAccessToken();

      const c2bRegisterRequest: DarajaC2BRegisterRequest = {
        ShortCode: shortCode,
        ResponseType: responseType,
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl,
      };

      const c2bRegisterUrl = this.config.baseUrl?.includes('sandbox')
        ? 'https://sandbox.safaricom.co.ke/mpesa/c2b/v1/registerurl'
        : 'https://api.safaricom.co.ke/mpesa/c2b/v1/registerurl';

      const response = await fetch(c2bRegisterUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(accessToken),
        body: JSON.stringify(c2bRegisterRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: JSON.stringify(error) };
      }

      return await response.json();
    } catch (error: any) {
      console.error('[MpesaDarajaService] C2B Register Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * B2B Payment - Business to Business Transfer
   * Used for: Inter-business payments, payroll to business accounts, fund transfers
   * 
   * Command IDs:
   * - BusinessPayBill: Pay bill to another business
   * - MerchantToMerchantTransfer: Transfer between merchants
   * - DisburseFundsToBusiness: Disburse funds to business account
   */
  static async initiateB2BPayment(
    amount: number,
    partyA: string, // Sender short code
    partyB: string, // Receiver short code or identifier
    accountReference: string,
    remarks: string = 'B2B Transfer',
    commandId: 'BusinessPayBill' | 'MerchantToMerchantTransfer' | 'DisburseFundsToBusiness' = 'BusinessPayBill',
    callbackUrl: string
  ): Promise<DarajaB2BPaymentResponse | { success: false; error: string }> {
    return this._executeB2BPayment(
      amount,
      partyA,
      partyB,
      accountReference,
      remarks,
      commandId,
      callbackUrl
    );
  }

  /**
   * Internal B2B payment execution
   */
  private static async _executeB2BPayment(
    amount: number,
    partyA: string,
    partyB: string,
    accountReference: string,
    remarks: string,
    commandId: string,
    callbackUrl: string
  ): Promise<DarajaB2BPaymentResponse | { success: false; error: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const initiatorName = process.env.DARAJA_INITIATOR_NAME || 'api_operator';
      const initiatorPassword = process.env.DARAJA_INITIATOR_PASSWORD || '';

      if (!initiatorPassword) {
        throw new Error('Initiator password not configured for B2B');
      }

      const publicKey = getMpesaPublicKey(this.config.baseUrl?.includes('sandbox') ? 'sandbox' : 'production');
      const securityCredential = encryptSecurityCredential(initiatorPassword, publicKey);

      const b2bRequest: DarajaB2BPaymentRequest = {
        Initiator: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: commandId,
        SenderIdentifierType: '4', // Short code
        RecieverIdentifierType: '4', // Short code
        Amount: Math.ceil(amount),
        PartyA: partyA,
        PartyB: partyB,
        AccountReference: sanitizeTransactionDescription(accountReference),
        Remarks: sanitizeTransactionDescription(remarks),
        QueueTimeOutURL: callbackUrl,
        ResultURL: callbackUrl,
      };

      const b2bUrl = this.config.baseUrl?.includes('sandbox')
        ? 'https://sandbox.safaricom.co.ke/mpesa/b2b/v1/paymentrequest'
        : 'https://api.safaricom.co.ke/mpesa/b2b/v1/paymentrequest';

      const response = await fetch(b2bUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(accessToken),
        body: JSON.stringify(b2bRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: JSON.stringify(error) };
      }

      return await response.json();
    } catch (error: any) {
      console.error('[MpesaDarajaService] B2B Payment Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Account Balance Query
   * Check current M-PESA account balance
   */
  static async queryAccountBalance(
    shortCode: string,
    identifierType: '1' | '2' | '4' = '4', // 4 = Short Code
    callbackUrl: string
  ): Promise<DarajaBalanceResponse | { success: false; error: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const initiatorName = process.env.DARAJA_INITIATOR_NAME || 'api_operator';
      const initiatorPassword = process.env.DARAJA_INITIATOR_PASSWORD || '';

      if (!initiatorPassword) {
        throw new Error('Initiator password not configured');
      }

      const publicKey = getMpesaPublicKey(this.config.baseUrl?.includes('sandbox') ? 'sandbox' : 'production');
      const securityCredential = encryptSecurityCredential(initiatorPassword, publicKey);

      const balanceRequest: DarajaBalanceRequest = {
        Initiator: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'AccountBalance',
        PartyA: shortCode,
        IdentifierType: identifierType,
        Remarks: 'Account balance query',
        QueueTimeOutURL: callbackUrl,
        ResultURL: callbackUrl,
      };

      const balanceUrl = this.config.baseUrl?.includes('sandbox')
        ? 'https://sandbox.safaricom.co.ke/mpesa/accountbalance/v1/query'
        : 'https://api.safaricom.co.ke/mpesa/accountbalance/v1/query';

      const response = await fetch(balanceUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(accessToken),
        body: JSON.stringify(balanceRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: JSON.stringify(error) };
      }

      return await response.json();
    } catch (error: any) {
      console.error('[MpesaDarajaService] Balance Query Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Transaction Reversal
   * Reverse a previously completed transaction
   */
  static async reverseTransaction(
    transactionId: string,
    amount: number,
    receiverParty: string,
    remarks: string = 'Transaction reversal',
    callbackUrl: string
  ): Promise<DarajaReversalResponse | { success: false; error: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const initiatorName = process.env.DARAJA_INITIATOR_NAME || 'api_operator';
      const initiatorPassword = process.env.DARAJA_INITIATOR_PASSWORD || '';

      if (!initiatorPassword) {
        throw new Error('Initiator password not configured');
      }

      const publicKey = getMpesaPublicKey(this.config.baseUrl?.includes('sandbox') ? 'sandbox' : 'production');
      const securityCredential = encryptSecurityCredential(initiatorPassword, publicKey);

      const reversalRequest: DarajaReversalRequest = {
        Initiator: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'TransactionReversal',
        TransactionID: transactionId,
        Amount: Math.ceil(amount),
        ReceiverParty: receiverParty,
        RecieverIdentifierType: '4',
        Remarks: sanitizeTransactionDescription(remarks),
        QueueTimeOutURL: callbackUrl,
        ResultURL: callbackUrl,
      };

      const reversalUrl = this.config.baseUrl?.includes('sandbox')
        ? 'https://sandbox.safaricom.co.ke/mpesa/reversal/v1/request'
        : 'https://api.safaricom.co.ke/mpesa/reversal/v1/request';

      const response = await fetch(reversalUrl, {
        method: 'POST',
        headers: this.getAuthHeaders(accessToken),
        body: JSON.stringify(reversalRequest),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return { success: false, error: JSON.stringify(error) };
      }

      return await response.json();
    } catch (error: any) {
      console.error('[MpesaDarajaService] Transaction Reversal Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update service configuration
   * Useful for testing or dynamic configuration
   */
  static setConfig(config: Partial<DarajaConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  static getConfig(): DarajaConfig {
    return this.config;
  }
}
