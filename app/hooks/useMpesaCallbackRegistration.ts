'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook to register M-Pesa callback URL once on app initialization
 * This ensures Safaricom knows where to send transaction responses
 */
export function useMpesaCallbackRegistration() {
  const registrationAttempted = useRef(false);

  useEffect(() => {
    // Only run once per app session
    if (registrationAttempted.current) {
      return;
    }

    registrationAttempted.current = true;

    const registerCallbackUrl = async () => {
      try {
        // Get the primary callback URL
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const callbackUrl = `${baseUrl}/api/mpesa/callback`;

        console.log('[v0] Registering M-Pesa callback URL:', callbackUrl);

        // First, get the current configuration
        const statusResponse = await fetch('/api/mpesa/register-callback');
        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          console.warn('[v0] Failed to get callback status:', statusData);
          return;
        }

        console.log('[v0] Callback URL configuration:', statusData);

        // Register the callback URL
        const registerResponse = await fetch('/api/mpesa/register-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callbackUrl,
          }),
        });

        const registerData = await registerResponse.json();

        if (!registerResponse.ok) {
          console.warn('[v0] Callback URL registration warning:', registerData);
          // Don't fail the app if registration fails - it might already be registered
          return;
        }

        console.log('[v0] M-Pesa callback URL registered successfully:', {
          url: callbackUrl,
          registeredAt: registerData.registeredAt,
          endpoints: registerData.endpoints,
        });

        // Store registration info in localStorage for debugging
        try {
          const registrationInfo = {
            callbackUrl,
            registeredAt: new Date().toISOString(),
            endpoints: registerData.endpoints,
          };
          localStorage.setItem(
            'mpesa_callback_registration',
            JSON.stringify(registrationInfo)
          );
        } catch (e) {
          // localStorage might not be available in some contexts
          console.warn('[v0] Failed to store registration info in localStorage:', e);
        }
      } catch (error) {
        console.error('[v0] Error during M-Pesa callback registration:', error);
        // Don't throw - this is a background task
      }
    };

    // Call the registration function
    registerCallbackUrl();
  }, []);
}

/**
 * Get the registered callback URL information from localStorage
 */
export function getMpesaCallbackInfo() {
  try {
    const info = localStorage.getItem('mpesa_callback_registration');
    if (info) {
      return JSON.parse(info);
    }
  } catch (error) {
    console.error('[v0] Failed to retrieve callback registration info:', error);
  }
  return null;
}
