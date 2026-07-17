'use client';

import { useMpesaCallbackRegistration } from '@/app/hooks/useMpesaCallbackRegistration';

/**
 * Client component that initializes M-Pesa callback URL registration
 * This runs once on app load to ensure Safaricom can reach our endpoints
 */
export function MpesaCallbackInitializer() {
  // Register callback URL on app initialization
  useMpesaCallbackRegistration();

  // This component doesn't render anything visible
  return null;
}
