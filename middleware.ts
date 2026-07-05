import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Disable browser persistent caching
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  // Prevent caching by proxies
  response.headers.set('Surrogate-Control', 'no-store');
  
  // ========================================================================
  // SECURITY HEADERS - Independent middleware control (not Vercel config)
  // ========================================================================
  
  // Strict-Transport-Security: Enforce HTTPS and prevent protocol downgrade
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  );
  
  // Content-Security-Policy: Prevent XSS by whitelisting trusted sources
  // Default: restrict everything to self, then selectively allow specific sources
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      // Scripts: self, unsafe-inline (for Next.js), unsafe-eval (for dev), trusted CDNs
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdn.socket.io https://cdn.trustpilot.net https://tr.trustpilot.com",
      // Styles: self, unsafe-inline, Google Fonts
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
      // Images: self, data URIs, and https
      "img-src 'self' data: https:",
      // Fonts: self, data, Google Fonts
      "font-src 'self' data: https://fonts.gstatic.com",
      // WebSocket and HTTPS connections
      "connect-src 'self' https: wss:",
      // Frames: only allow Trustpilot
      "frame-src 'self' https://tr.trustpilot.com",
      // No plugins
      "object-src 'none'",
      // Base URI must be same-origin
      "base-uri 'self'",
      // Form submissions only to same-origin
      "form-action 'self'",
      // Prevent framing this site (X-Frame-Options alternative)
      "frame-ancestors 'none'",
    ].join('; ')
  );
  
  // Referrer-Policy: Control referrer information leakage
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions-Policy: Disable dangerous features by default
  response.headers.set(
    'Permissions-Policy',
    [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'hid=()',
      'idle-detection=()',
      'interest-cohort=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'sync-xhr=()',
      'usb=()',
      'vr=()',
      'xr-spatial-tracking=()',
    ].join(', ')
  );
  
  // X-Content-Type-Options: Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  // X-Frame-Options: Prevent clickjacking (older alternative to frame-ancestors CSP)
  response.headers.set('X-Frame-Options', 'DENY');
  
  // X-XSS-Protection: Legacy browser XSS protection (most browsers use CSP now)
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Cross-Origin-Embedder-Policy: Prevent unauthorized cross-origin embedding
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Cross-Origin-Opener-Policy: Isolate browsing context from cross-origin windows
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  
  // Cross-Origin-Resource-Policy: Prevent Spectre-like attacks
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
  // ========================================================================
  // END SECURITY HEADERS
  // ========================================================================
  
  // Referral tracking: persist referral code from ?ref= parameter into hh_ref cookie
  const url = request.nextUrl;
  const refParam = url.searchParams.get('ref');
  
  if (refParam) {
    // Sanitize referral code (alphanumeric, underscores, hyphens only)
    const sanitizedRef = refParam.replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedRef) {
      // Set cookie to expire in 30 days
      const expiresAt = new Date();
      expiresAt.setTime(expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
      response.cookies.set('hh_ref', sanitizedRef, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresAt,
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static assets and public files
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|site.webmanifest).*)',
  ],
};
