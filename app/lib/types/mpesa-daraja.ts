/**
 * M-PESA Daraja API Integration Types
 *
 * Based on Safaricom Daraja 3.0 API documentation
 * https://developer.safaricom.co.ke/docs
 */

// ---------------------------------------------------------------------------
// OAuth Token
// ---------------------------------------------------------------------------

export interface DarajaOAuthRequest {
  grant_type: 'client_credentials';
}

export interface DarajaOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ---------------------------------------------------------------------------
// M-PESA Express (STK Push)
// ---------------------------------------------------------------------------

export interface DarajaMPesaExpressRequest {
  BusinessShortCode: string; // Business Short Code
  Password: string; // Encoded password
  Timestamp: string; // Format: YYYYMMDDHHmmss
  TransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: number; // Amount in KES (whole number)
  PartyA: string; // Customer phone number (format: 254XXXXXXXXX)
  PartyB: string; // Business Short Code
  PhoneNumber: string; // Customer phone number
  CallBackURL: string; // Callback URL for transaction updates
  AccountReference: string; // Account/invoice reference
  TransactionDesc: string; // Transaction description
}

export interface DarajaMPesaExpressResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
}

// ---------------------------------------------------------------------------
// Transaction Status Query
// ---------------------------------------------------------------------------

export interface DarajaTransactionStatusRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  CheckoutRequestID: string;
}

export interface DarajaTransactionStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
  Amount?: number;
  MpesaReceiptNumber?: string;
  Balance?: string;
  TransactionDate?: string;
}

// ---------------------------------------------------------------------------
// Callback/Webhook Payload
// ---------------------------------------------------------------------------

export interface DarajaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value: string | number;
        }>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// C2B (Customer to Business) - Spin Wallet / Chat Foreigners
// ---------------------------------------------------------------------------

export interface DarajaC2BRegisterRequest {
  ShortCode: string;
  ResponseType: 'Completed' | 'Cancel';
  ConfirmationURL: string;
  ValidationURL: string;
}

export interface DarajaC2BRegisterResponse {
  ResponseCode: string;
  ResponseDescription: string;
}

export interface DarajaC2BPaymentRequest {
  ShortCode: string;
  CommandID: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: number;
  Msisdn: string;
  BillRefNumber: string;
}

export interface DarajaC2BValidationRequest {
  transactionType: string;
  transactionID: string;
  transactionTimestamp: string;
  transactionAmount: number;
  invoiceNumber?: string;
  organizationAccountBalance?: number;
  thirdPartyTransactionID?: string;
  msisdn: string;
  firstName?: string;
}

export interface DarajaC2BConfirmationRequest {
  transactionType: string;
  transactionID: string;
  transactionTimestamp: string;
  transactionAmount: number;
  organizationAccountBalance: number;
  invoiceNumber?: string;
  thirdPartyTransactionID?: string;
  msisdn: string;
  firstName?: string;
}

// ---------------------------------------------------------------------------
// B2C (Business to Customer) - Spin Wallet Payouts
// ---------------------------------------------------------------------------

export interface DarajaB2CPaymentRequest {
  OriginatorConversationID: string;
  InitiatorName: string;
  SecurityCredential: string;
  CommandID: 'SalaryPayment' | 'BusinessPayment' | 'PromotionPayment';
  Amount: number;
  PartyA: string; // Business Short Code
  PartyB: string; // Customer phone number (format: 254XXXXXXXXX)
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
}

export interface DarajaB2CPaymentResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

export interface DarajaB2CCallbackBody {
  Result: {
    ResultType: number;
    ResultCode: number;
    ResultDesc: string;
    OriginatorConversationID: string;
    ConversationID: string;
    TransactionID: string;
    ResultParameters?: {
      ResultParameter: Array<{
        Key: string;
        Value: string | number;
      }>;
    };
  };
}

// ---------------------------------------------------------------------------
// B2B (Business to Business)
// ---------------------------------------------------------------------------

export interface DarajaB2BPaymentRequest {
  Initiator: string;
  SecurityCredential: string;
  CommandID: 'BusinessPayBill' | 'MerchantToMerchantTransfer' | 'DisburseFundsToBusiness';
  SenderIdentifierType: string;
  RecieverIdentifierType: string;
  Amount: number;
  PartyA: string;
  PartyB: string;
  AccountReference: string;
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
}

export interface DarajaB2BPaymentResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

// ---------------------------------------------------------------------------
// Account Balance Query
// ---------------------------------------------------------------------------

export interface DarajaBalanceRequest {
  Initiator: string;
  SecurityCredential: string;
  CommandID: 'AccountBalance';
  PartyA: string;
  IdentifierType: string;
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
}

export interface DarajaBalanceResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

// ---------------------------------------------------------------------------
// Transaction Reversal
// ---------------------------------------------------------------------------

export interface DarajaReversalRequest {
  Initiator: string;
  SecurityCredential: string;
  CommandID: 'TransactionReversal';
  TransactionID: string;
  Amount: number;
  ReceiverParty: string;
  RecieverIdentifierType: string;
  Remarks: string;
  QueueTimeOutURL: string;
  ResultURL: string;
}

export interface DarajaReversalResponse {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseCode: string;
  ResponseDescription: string;
}

// ---------------------------------------------------------------------------
// Application-level helpers
// ---------------------------------------------------------------------------

export interface DarajaPaymentRequest {
  amount: number;
  phoneNumber: string;
  accountReference: string;
  description?: string;
  transactionType?: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
}

export interface DarajaPaymentResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  message: string;
  error?: string;
}

export interface DarajaTransactionInfo {
  checkoutRequestId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  amount?: number;
  phoneNumber?: string;
  timestamp?: string;
  receiptNumber?: string;
  description?: string;
  error?: string;
}

export interface DarajaConfig {
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  baseUrl?: string;
  oauthUrl?: string;
  stkPushUrl?: string;
  statusCheckUrl?: string;
  partyB?: string; // Override partyB if different from businessShortCode
}

// ---------------------------------------------------------------------------
// Error Response
// ---------------------------------------------------------------------------

export interface DarajaErrorResponse {
  errorCode: string;
  errorMessage: string;
  requestId?: string;
}
