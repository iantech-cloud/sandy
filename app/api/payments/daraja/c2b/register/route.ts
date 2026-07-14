import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * POST /api/payments/daraja/c2b/register
 * 
 * C2B Registration - Spin Wallet / Chat Foreigners Setup
 * Registers your business short code to receive customer payments
 * Required for enabling C2B payment collection
 * 
 * Request body:
 * {
 *   "shortCode": "600123",
 *   "validationUrl": "https://yourdomain.com/api/payments/daraja/c2b/validate",
 *   "confirmationUrl": "https://yourdomain.com/api/payments/daraja/c2b/confirm",
 *   "responseType": "Completed"  // Completed or Cancel
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = request.headers.get('authorization');
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { shortCode, validationUrl, confirmationUrl, responseType = 'Completed' } = body;

    // Validate required fields
    if (!shortCode || !validationUrl || !confirmationUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: shortCode, validationUrl, confirmationUrl' },
        { status: 400 }
      );
    }

    // Validate URLs
    try {
      new URL(validationUrl);
      new URL(confirmationUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URLs provided' },
        { status: 400 }
      );
    }

    // Register C2B
    const result = await MpesaDarajaService.registerC2B(
      shortCode,
      validationUrl,
      confirmationUrl,
      responseType
    );

    if ('success' in result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'C2B registration failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'C2B registration completed successfully',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[C2B Register API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to register C2B',
      },
      { status: 500 }
    );
  }
}
