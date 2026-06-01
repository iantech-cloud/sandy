import { NextResponse } from 'next/server';

/**
 * This endpoint previously registered Safaricom C2B URLs and is no longer used.
 * The application now uses Co-op Bank STK Push exclusively, which does not
 * require C2B URL registration.
 *
 * Returns 410 Gone so any stale clients or bookmarks get a clear signal.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message:
        'This endpoint has been decommissioned. The application uses Co-op Bank STK Push, which does not require C2B URL registration.',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message:
        'This endpoint has been decommissioned. The application uses Co-op Bank STK Push, which does not require C2B URL registration.',
    },
    { status: 410 }
  );
}
