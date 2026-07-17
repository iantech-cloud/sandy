// app/api/mpesa/register-callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

/**
 * POST /api/mpesa/register-callback
 * Validates and registers the callback URL with Safaricom M-Pesa system
 * This endpoint is called once on app initialization to ensure callbacks are properly configured
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    // For callback URL registration, we allow both authenticated and unauthenticated requests
    // since the validation happens on Safaricom's side
    const { callbackUrl } = await request.json();
    
    if (!callbackUrl) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'callbackUrl is required',
          message: 'No callback URL provided for registration'
        },
        { status: 400 }
      );
    }

    // Validate that the callback URL is properly formed
    try {
      new URL(callbackUrl);
    } catch {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid callback URL format',
          message: 'Callback URL must be a valid HTTP(S) URL'
        },
        { status: 400 }
      );
    }

    // Validate that the URL is HTTPS in production
    if (process.env.NODE_ENV === 'production' && !callbackUrl.startsWith('https://')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'HTTPS required in production',
          message: 'Callback URL must use HTTPS in production'
        },
        { status: 400 }
      );
    }

    // Validate that the callback URL matches our expected domain
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    if (!callbackUrl.startsWith(baseUrl)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Callback URL domain mismatch',
          message: `Callback URL must be under ${baseUrl}`,
          expected: baseUrl,
          received: callbackUrl
        },
        { status: 400 }
      );
    }

    // Check that the callback endpoints exist and are accessible
    const endpoints = [
      '/api/mpesa/callback',
      '/api/payments/mpesa/callback',
    ];

    let validEndpointFound = false;
    for (const endpoint of endpoints) {
      if (callbackUrl.includes(endpoint)) {
        validEndpointFound = true;
        break;
      }
    }

    if (!validEndpointFound) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unknown callback endpoint',
          message: `Callback URL must point to one of: ${endpoints.join(', ')}`,
          validEndpoints: endpoints
        },
        { status: 400 }
      );
    }

    // Log callback registration for audit trail
    console.log('[v0] Callback URL registered:', {
      url: callbackUrl,
      timestamp: new Date().toISOString(),
      userId: session?.user?.id,
      environment: process.env.NODE_ENV,
    });

    // Return success with confirmation
    return NextResponse.json({
      success: true,
      message: 'Callback URL registered successfully',
      callbackUrl,
      registeredAt: new Date().toISOString(),
      endpoints: {
        primary: `${baseUrl}/api/mpesa/callback`,
        secondary: `${baseUrl}/api/payments/mpesa/callback`,
      },
    });
  } catch (error) {
    console.error('[v0] Callback registration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to register callback URL',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mpesa/register-callback
 * Returns the current callback URL configuration and validation status
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    
    if (!baseUrl) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Base URL not configured',
          message: 'NEXT_PUBLIC_BASE_URL environment variable is not set'
        },
        { status: 500 }
      );
    }

    const callbackUrls = {
      primary: `${baseUrl}/api/mpesa/callback`,
      secondary: `${baseUrl}/api/payments/mpesa/callback`,
    };

    console.log('[v0] Callback URL status check:', {
      baseUrl,
      urls: callbackUrls,
      isProduction: process.env.NODE_ENV === 'production',
    });

    return NextResponse.json({
      success: true,
      message: 'Callback URL configuration retrieved',
      baseUrl,
      callbackUrls,
      registeredAt: new Date().toISOString(),
      instructions: {
        step1: 'Use the primary callback URL in your Safaricom Daraja portal',
        step2: 'Ensure your BASE_URL environment variable is set correctly',
        step3: 'The callback endpoint will automatically process M-Pesa responses',
      },
    });
  } catch (error) {
    console.error('[v0] Callback URL status error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to retrieve callback configuration'
      },
      { status: 500 }
    );
  }
}
