import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import AdminLoginContent from './AdminLoginContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin Login | Hustle Hub Africa',
  description: 'Admin portal for Hustle Hub Africa management.',
  robots: {
    index: false,
    follow: false,
  },
};

async function AdminLoginPageInner() {
  const session = await auth();

  // If already logged in and is admin, redirect to admin dashboard
  if (session?.user && (session.user.role === 'admin' || session.user.role === 'super_admin')) {
    redirect('/admin');
  }

  // If logged in but not admin, redirect to logout
  if (session?.user) {
    redirect('/auth/login');
  }

  return <AdminLoginContent />;
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-white mb-2">Loading...</h2>
              <p className="text-slate-400">Initializing admin portal.</p>
            </div>
          </div>
        </div>
      }
    >
      <AdminLoginPageInner />
    </Suspense>
  );
}

export const dynamic = 'force-dynamic';
