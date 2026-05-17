// app/auth/login/page.tsx - UPDATED WITH METADATA
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import LoginContent from './LoginContent';
import type { Metadata } from 'next';

// SEO Metadata for Login Page
export const metadata: Metadata = {
  title: 'Login to Your Account',
  description: 'Sign in to your Hustle Hub Africa account to access paid surveys, writing jobs, referral programs, and multiple ways to earn money online in Kenya.',
  keywords: [
    'login hustle hub africa',
    'sign in kenya online jobs',
    'account access kenya',
    'earn money online login',
    'kenya freelance platform login',
    'mpesa withdrawals login'
  ],
  robots: {
    index: false, // Don't index login pages for SEO
    follow: false,
  },
  openGraph: {
    title: 'Login | Hustle Hub Africa',
    description: 'Sign in to your account and start earning money online in Kenya through surveys, writing jobs, and referrals.',
    url: '/auth/login',
    type: 'website',
  },
  twitter: {
    title: 'Login | Hustle Hub Africa',
    description: 'Sign in to your account and start earning money online in Kenya.',
  },
  alternates: {
    canonical: 'https://hustlehubafrica.com/auth/login',
  },
};

function getDashboardRoute(role: string): string {
  switch (role) {
    case 'admin':
    case 'super_admin':
      return '/admin';
    case 'support':
      return '/support';
    default:
      return '/dashboard';
  }
}

async function LoginPageInner() {
  const session = await auth();

  // NOTE: We intentionally do NOT check user activation status on the login page
  // Users should be able to visit the login page freely to:
  // 1. Login with a different account
  // 2. See the login page even when already logged in
  // 3. Manually choose to go to their dashboard
  //
  // Activation status checking happens AFTER they login in LoginContent.tsx
  // via the checkUserStatusAndRedirect() function
  
  if (session && session.user) {
    console.log('[v0] User already logged in on login page:', {
      email: session.user.email,
      authMethod: session.user.authMethod,
    });
  }

  // Always show the login form, even if user is logged in
  return <LoginContent hasExistingSession={!!session} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Loading...</h2>
            <p className="text-gray-600">Please wait while we load the login page.</p>
          </div>
        </div>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
