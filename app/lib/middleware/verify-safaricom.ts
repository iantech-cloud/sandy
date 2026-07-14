import { NextRequest, NextResponse } from 'next/server';
import { isSafaricomIp } from '@/app/lib/utils/mpesa-security';

/**
 * Middleware to verify incoming requests are from Safaricom
 * Used to protect callback endpoints from unauthorized access
 * 
 * Usage:
 * import { verifySafaricomRequest } from '@/app/lib/middleware/verify-safaricom';
 * 
 * export async function POST(request: NextRequest) {
 *   // Verify request is from Safaricom
 *   const verifyResult = await verifySafaricomRequest(request);
 *   if (!verifyResult.valid) {
 *     return NextResponse.json(
 *       { error: verifyResult.error },
 *       { status: verifyResult.status }
 *     );
 *   }
 *   
 *   // Process request
 * }
 */

interface VerifyResult {
  valid: boolean;
  error?: string;
  status?: number;
  clientIp?: string;
  isFromSafaricom?: boolean;
}

/**
 * Verify that request comes from Safaricom API Gateway
 */
export async function verifySafaricomRequest(
  request: NextRequest,
  options: {
    requireSafaricomIp?: boolean;
    requireValidJson?: boolean;
  } = {}
): Promise<VerifyResult> {
  const {
    requireSafaricomIp = true,
    requireValidJson = true,
  } = options;

  try {
    // Get client IP
    const clientIp = getClientIp(request);

    console.log('[verifySafaricomRequest] Request from IP:', clientIp);

    // Verify IP if enabled
    if (requireSafaricomIp) {
      const isSafaricom = isSafaricomIp(clientIp);

      if (!isSafaricom) {
        console.warn('[verifySafaricomRequest] Rejected request from non-Safaricom IP:', clientIp);
        return {
          valid: false,
          error: 'Request from unauthorized IP address',
          status: 403,
          clientIp,
          isFromSafaricom: false,
        };
      }
    }

    // Verify JSON if enabled
    if (requireValidJson) {
      const contentType = request.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        return {
          valid: false,
          error: 'Invalid content-type. Expected application/json',
          status: 400,
          clientIp,
          isFromSafaricom: true,
        };
      }

      // Try to parse JSON
      try {
        await request.json();
      } catch {
        return {
          valid: false,
          error: 'Invalid JSON payload',
          status: 400,
          clientIp,
          isFromSafaricom: true,
        };
      }
    }

    return {
      valid: true,
      clientIp,
      isFromSafaricom: true,
    };
  } catch (error: any) {
    console.error('[verifySafaricomRequest] Verification error:', error);
    return {
      valid: false,
      error: 'Request verification failed',
      status: 500,
    };
  }
}

/**
 * Extract client IP from request
 * Handles various proxy scenarios
 */
function getClientIp(request: NextRequest): string {
  // Check X-Forwarded-For header (most common)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Check X-Real-IP (Nginx proxy)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to socket address
  const socketAddress = request.ip || '0.0.0.0';
  return socketAddress;
}

/**
 * Middleware wrapper for protecting callback endpoints
 */
export function withSafaricomVerification(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options?: Parameters<typeof verifySafaricomRequest>[1]
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const verification = await verifySafaricomRequest(request, options);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error },
        { status: verification.status || 403 }
      );
    }

    // Request is verified, proceed to handler
    return handler(request);
  };
}

/**
 * Get list of safe callback endpoints (no IP verification needed)
 * Use for development/testing only
 */
export function isDevEnvironment(): boolean {
  return process.env.NODE_ENV === 'development' ||
         process.env.DARAJA_BASE_URL?.includes('sandbox') === true;
}
