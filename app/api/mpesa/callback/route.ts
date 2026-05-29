// app/api/mpesa/callback/route.ts
// ADAPTER: Routes M-Pesa callbacks to Co-operative Bank callback handler
// This maintains backward compatibility for existing integrations

import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/mpesa/callback
 * Adapter that routes M-Pesa-format callbacks to Co-op Bank callback handler
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('[M-Pesa Adapter] Callback received, forwarding to Co-op Bank handler');
    
    // Forward to Co-op Bank callback handler
    const coopBankResponse = await fetch(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/payments/coop-bank/callback`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      }
    );
    
    const result = await coopBankResponse.json();
    
    return NextResponse.json(result, { status: coopBankResponse.status });
    
  } catch (error) {
    console.error('[M-Pesa Adapter] Error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process callback'
      },
      { status: 500 }
    );
  }
}
