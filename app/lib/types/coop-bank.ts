/**
 * Co-operative Bank integration types
 *
 * Based on the official Postman collection (SANDRA OTIENO SCHOLINE).
 * All API request/response fields use PascalCase as the bank's API demands.
 */

// ---------------------------------------------------------------------------
// Token
// ---------------------------------------------------------------------------

export interface CoopBankTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// ---------------------------------------------------------------------------
// STK Push  (POST /FT/stk/1.0.0)
// ---------------------------------------------------------------------------

export interface CoopBankSTKPushRequest {
  MessageReference: string;
  CallBackUrl: string;
  OperatorCode: string;
  TransactionCurrency: string;
  MobileNumber: string;
  Narration: string;
  Amount: number;
  MessageDateTime: string;
  OtherDetails?: Array<{
    Name: string;
    Value: string;
  }>;
}

export interface CoopBankSTKPushResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MessageReference?: string;
  OperatorTxnID?: string;
  ConversationID?: string;
  OriginatorConversationID?: string;
}

// ---------------------------------------------------------------------------
// Transaction Status  (POST /Enquiry/STK/1.0.0/)
// ---------------------------------------------------------------------------

export interface CoopBankStatusRequest {
  MessageReference: string;
}

export interface CoopBankStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MessageReference?: string;
  Status?: string;
  Amount?: number;
  TransactionDate?: string;
  // Receipt / reference from the bank on success
  ReceiptNumber?: string;
  OperatorTxnID?: string;
}

// ---------------------------------------------------------------------------
// Callback (POST to your CallBackUrl)
// Co-op Bank posts a JSON body with these fields when the transaction settles.
// ---------------------------------------------------------------------------

export interface CoopBankCallbackPayload {
  MessageReference: string;
  OperatorTxnID?: string;
  ConversationID?: string;
  ResponseCode: string;
  ResponseDescription: string;
  ResultCode?: number;
  ResultDesc?: string;
  Amount?: number;
  PhoneNumber?: string;
  TransactionDate?: string;
  ReceiptNumber?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Application-level helpers
// ---------------------------------------------------------------------------

export interface PaymentInitiationRequest {
  amount: number;
  phoneNumber: string;
  narration?: string;
  depositType?: 'wallet' | 'spin_wallet' | 'activation';
}

export interface PaymentInitiationResponse {
  success: boolean;
  messageReference?: string;
  transactionId?: string;
  message?: string;
  error?: string;
}

export interface TransactionStatus {
  messageReference: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  amount?: number;
  timestamp?: string;
  receiptNumber?: string;
  description?: string;
  error?: string;
}

export interface CoopBankConfig {
  clientId: string;
  clientSecret: string;
  operatorCode: string;
  environment: 'sandbox' | 'production';
}
