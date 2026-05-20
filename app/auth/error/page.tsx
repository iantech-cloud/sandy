'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Custom error page for Auth.js errors
 * Displays specific error messages from the authorize callback
 */
export default function ErrorPage() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get('error');
  
  // Map error codes to specific messages
  const getErrorMessage = (error: string | null) => {
    if (!error) return 'An error occurred during authentication. Please try again.';
    
    // Try to decode if it's URL-encoded
    let decodedError = '';
    try {
      decodedError = decodeURIComponent(error);
    } catch {
      decodedError = error;
    }

    // Check for custom error messages that contain the actual error text
    if (decodedError.includes('Password is incorrect')) {
      return decodedError;
    }
    
    if (decodedError.includes('Email address not found')) {
      return decodedError;
    }

    if (decodedError.includes('This account was registered with')) {
      return decodedError;
    }

    if (decodedError.includes('User account data is invalid')) {
      return decodedError;
    }

    if (decodedError.includes('2FA code is required')) {
      return decodedError;
    }

    if (decodedError.includes('Invalid 2FA code')) {
      return decodedError;
    }

    // Handle standard Auth.js error codes
    switch (error) {
      case 'CredentialsSignin':
        return 'Invalid email or password. Please check your credentials and try again.';
      case 'OAuthSignin':
        return 'Error signing in with an OAuth provider. Please try again.';
      case 'OAuthCallback':
        return 'An error occurred while processing the login callback. Please try again.';
      case 'EmailSignin':
        return 'Error sending the email magic link. Please try again.';
      case 'Configuration':
        return 'There is a problem with the server configuration. Please contact support.';
      case 'AccessDenied':
        return 'You do not have permission to access this resource.';
      case 'Verification':
        return 'The verification token has expired or is invalid.';
      default:
        return decodedError || 'An authentication error occurred. Please try again.';
    }
  };

  const errorMessage = getErrorMessage(errorParam);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
          
          <p className="text-gray-700 text-sm mb-6 leading-relaxed">
            {errorMessage}
          </p>

          <div className="space-y-3">
            <Link
              href="/auth/login"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Back to Login
            </Link>
            
            <Link
              href="/auth/register"
              className="block w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition-colors"
            >
              Create New Account
            </Link>
          </div>

          {errorParam && (
            <p className="text-xs text-gray-500 mt-6 pt-6 border-t border-gray-200">
              Error code: {errorParam}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
