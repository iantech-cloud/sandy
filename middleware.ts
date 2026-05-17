import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Disable browser persistent caching
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  // Prevent caching by proxies
  response.headers.set('Surrogate-Control', 'no-store');
  
  // Security headers that also help with caching
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  
  // Clear persistent cookies - set them to expire immediately
  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    response.headers.set(
      'set-cookie',
      setCookieHeader.replace(/Max-Age=[^;]+/g, 'Max-Age=0').replace(/Expires=[^;]+/g, 'Expires=Thu, 01 Jan 1970 00:00:00 GMT')
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static assets and public files
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|robots.txt|sitemap.xml|site.webmanifest).*)',
  ],
};
