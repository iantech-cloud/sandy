import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * GET /api/payments/daraja/balance?shortCode=600123&callbackUrl=https://...
 * 
 * Query Account Balance
 * Check current M-PESA account balance for your business short code
 * 
 * Query parameters:
 * - shortCode: Your M-PESA business short code (required)
 * - callbackUrl: URL to receive balance query result (required)
 * - identifierType: '4' for short code, '1' for MSISDN (default: '4')
 */
export async function GET(request: NextRequest) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing authentication' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const shortCode = searchParams.get('shortCode');
    const callbackUrl = searchParams.get('callbackUrl');
    const identifierType = (searchParams.get('identifierType') || '4') as '1' | '2' | '4';

    if (!shortCode || !callbackUrl) {
      return NextResponse.json(
        { error: 'Missing required parameters: shortCode, callbackUrl' },
        { status: 400 }
      );
    }

    // Query account balance
    const result = await MpesaDarajaService.queryAccountBalance(
      shortCode,
      identifierType,
      callbackUrl
    );

    if ('success' in result && !result.success) {
      return NextResponse.json(
        { error: result.error || 'Balance query failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: 'Balance query initiated. Result will be sent to callback URL.',
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Balance Query API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to query account balance',
      },
      { status: 500 }
    );
  }
}
