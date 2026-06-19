import { CoopBankPayment } from '@/app/lib/models';

interface CoopBankPaymentRequest {
  amount: number; // In KES
  phone_number: string; // e.g., +254791406285 or 0791406285
  reference: string; // Transaction reference
  description?: string;
  callbackURL?: string;
}

interface CoopBankPaymentResponse {
  success: boolean;
  transactionId?: string;
  message: string;
  data?: any;
}

/**
 * Coop Bank Payment Service
 * Handles all payment processing through Coop Bank API
 */
export class CoopBankService {
  private static apiUrl = process.env.COOP_BANK_API_URL || 'https://api.sandbox.kopokopo.com';
  private static apiKey = process.env.COOP_BANK_API_KEY;
  private static apiSecret = process.env.COOP_BANK_API_SECRET;

  /**
   * Initialize payment with Coop Bank
   */
  static async initiatePayment(
    userId: string,
    paymentRequest: CoopBankPaymentRequest,
    referenceType: string,
    referenceId: string
  ): Promise<CoopBankPaymentResponse> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Coop Bank credentials not configured');
      }

      // Normalize phone number
      const normalizedPhone = this.normalizePhoneNumber(paymentRequest.phone_number);

      // Create payment record in database
      const paymentDoc = new CoopBankPayment({
        user_id: userId,
        amount_cents: paymentRequest.amount * 100, // Convert to cents
        currency: 'KES',
        payment_type: 'subscription', // Default - can be overridden
        reference_id: referenceId,
        reference_type: referenceType,
        phone_number: normalizedPhone,
        status: 'pending'
      });

      await paymentDoc.save();

      // Call Coop Bank API
      const payload = {
        amount: paymentRequest.amount,
        phone_number: normalizedPhone,
        description: paymentRequest.description || 'HustleHub Africa Payment',
        reference: paymentRequest.reference,
        callback_url: paymentRequest.callbackURL || `${process.env.BASE_URL}/api/webhook/coop-bank`
      };

      const headers = this.getAuthHeaders();
      
      const response = await fetch(`${this.apiUrl}/payments/send-money`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // Update payment record with Coop Bank transaction ID
        paymentDoc.coop_transaction_id = result.data?.transaction_id;
        paymentDoc.coop_response = result;
        await paymentDoc.save();

        return {
          success: true,
          transactionId: paymentDoc._id.toString(),
          message: 'Payment initiated successfully',
          data: result
        };
      } else {
        paymentDoc.status = 'failed';
        paymentDoc.failed_reason = result.message || 'Payment initiation failed';
        await paymentDoc.save();

        return {
          success: false,
          message: result.message || 'Payment initiation failed'
        };
      }
    } catch (error: any) {
      console.error('[CoopBankService] Error initiating payment:', error);
      return {
        success: false,
        message: error.message || 'Payment service error'
      };
    }
  }

  /**
   * Handle payment webhook callback from Coop Bank
   */
  static async handleWebhookCallback(data: any): Promise<void> {
    try {
      const { transaction_id, status, amount, reference } = data;

      // Find payment record
      const payment = await CoopBankPayment.findOne({ 
        coop_transaction_id: transaction_id 
      });

      if (!payment) {
        console.warn('[CoopBankService] Payment not found for transaction:', transaction_id);
        return;
      }

      // Update payment status
      if (status === 'completed' || status === 'success') {
        payment.status = 'completed';
        payment.completed_at = new Date();
        
        // Trigger earnings update based on reference type
        await this.creditUserEarnings(payment);
      } else if (status === 'failed') {
        payment.status = 'failed';
        payment.failed_reason = data.error_message || 'Payment failed';
      } else if (status === 'cancelled') {
        payment.status = 'cancelled';
      }

      payment.coop_response = data;
      await payment.save();
    } catch (error: any) {
      console.error('[CoopBankService] Error handling webhook:', error);
    }
  }

  /**
   * Process refund
   */
  static async processRefund(paymentId: string, reason: string): Promise<CoopBankPaymentResponse> {
    try {
      const payment = await CoopBankPayment.findById(paymentId);

      if (!payment || payment.status !== 'completed') {
        return {
          success: false,
          message: 'Payment not found or not in completed status'
        };
      }

      const headers = this.getAuthHeaders();

      const response = await fetch(`${this.apiUrl}/refunds`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          transaction_id: payment.coop_transaction_id,
          amount: payment.amount_cents / 100,
          reason
        })
      });

      const result = await response.json();

      if (response.ok) {
        payment.status = 'refunded';
        payment.coop_response = result;
        await payment.save();

        return {
          success: true,
          message: 'Refund processed successfully',
          data: result
        };
      }

      return {
        success: false,
        message: 'Refund processing failed'
      };
    } catch (error: any) {
      console.error('[CoopBankService] Error processing refund:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Get payment status
   */
  static async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      const payment = await CoopBankPayment.findById(paymentId);
      return payment;
    } catch (error: any) {
      console.error('[CoopBankService] Error getting payment status:', error);
      return null;
    }
  }

  /**
   * Helper: Normalize phone number to E.164 format
   */
  private static normalizePhoneNumber(phone: string): string {
    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // If starts with 07, convert to 254
    if (cleaned.startsWith('07')) {
      return `+254${cleaned.substring(1)}`;
    }

    // If starts with 254, add +
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    }

    // If just has 10-11 digits, assume Kenya
    if (cleaned.length === 9 || cleaned.length === 10) {
      return `+254${cleaned.slice(-9)}`;
    }

    return `+${cleaned}`;
  }

  /**
   * Helper: Get auth headers for Coop Bank API
   */
  private static getAuthHeaders(): HeadersInit {
    const authString = Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authString}`,
      'Accept': 'application/json'
    };
  }

  /**
   * Credit user earnings after payment
   */
  private static async creditUserEarnings(payment: any): Promise<void> {
    // This will be implemented based on reference_type
    // - freelance_job: Credit freelancer
    // - digital_product_sale: Credit seller
    // - tutoring_session: Credit tutor
    // - ai_task: Credit worker
    // - local_gig: Credit provider
    console.log('[CoopBankService] Crediting earnings for payment:', payment.reference_id);
  }
}
