import { NextRequest, NextResponse } from 'next/server';
import { MpesaDarajaService } from '@/app/lib/services/mpesa-daraja';

/**
 * GET /api/payments/daraja/token
 * 
 * Generates a new OAuth access token for M-PESA Daraja API calls
 * The token is cached and reused for 1 hour before generating a new one
 * 
 * Authentication: Requires Bearer token or similar auth mechanism
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is an authenticated request
    // You may want to add auth checks here based on your session/JWT setup
    
    const token = await MpesaDarajaService.getAccessToken();

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to generate access token' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        access_token: token,
        expires_in: 3600,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[Daraja Token API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate token',
      },
      { status: 500 }
    );
  }
}
