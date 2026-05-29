/**
 * Co-operative Bank M-Pesa Integration Types
 */

export interface CoopBankTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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
  ConversationID?: string;
  OriginatorConversationID?: string;
}

export interface CoopBankStatusRequest {
  MessageReference: string;
}

export interface CoopBankStatusResponse {
  ResponseCode: string;
  ResponseDescription: string;
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResultCode?: string;
  ResultDesc?: string;
  Amount?: number;
  MpesaReceiptNumber?: string;
  TransactionDate?: string;
}

export interface CoopBankCallbackPayload {
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

export interface PaymentInitiationRequest {
  amount: number;
  phoneNumber: string;
  narration?: string;
  metadata?: Record<string, string>;
}

export interface PaymentInitiationResponse {
  success: boolean;
  messageReference?: string;
  error?: string;
  data?: {
    conversationID?: string;
    originatorConversationID?: string;
  };
}

export interface TransactionStatus {
  messageReference: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
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
  callbackUrl: string;
}
