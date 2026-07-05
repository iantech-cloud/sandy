import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Disable browser persistent caching
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  // Prevent caching by proxies
  response.headers.set('Surrogate-Control', 'no-store');
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=(), usb=()');
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  
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
