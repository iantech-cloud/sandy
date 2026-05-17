// app/auth/confirm/ConfirmContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ConfirmContent() {
  const router = useRouter();

  useEffect(() => {
    // Email verification is no longer required
    // Redirect users directly to login
    const timer = setTimeout(() => {
      router.push('/auth/login');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registration Successful!</h2>
          <p className="text-gray-600 mb-4">Your account has been created successfully.</p>
          
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 mb-4">
            <p className="text-sm text-green-700 mb-2">
              You're all set to proceed!
            </p>
            <p className="text-sm text-green-600">
              Log in to your account to start the activation process.
            </p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 mb-4">
            <p className="text-sm text-blue-700 font-medium mb-1">Next Steps:</p>
            <ul className="text-sm text-blue-600 text-left space-y-1">
              <li>• Log in with your email and password</li>
              <li>• Complete the activation payment of KES 90</li>
              <li>• Start earning immediately after activation</li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 mb-4">Redirecting to login page...</p>
          
          <Link
            href="/auth/login"
            className="inline-block w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            Go to Login Now
          </Link>
        </div>
      </div>
    </div>
  );
}
