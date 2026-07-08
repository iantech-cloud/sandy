'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import Link from 'next/link';

interface AlertProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const typeClasses = {
    success: 'bg-green-900 border border-green-700 text-green-100',
    error: 'bg-red-900 border border-red-700 text-red-100',
    info: 'bg-blue-900 border border-blue-700 text-blue-100',
  };
  return (
    <div className={`p-4 mb-4 rounded-xl shadow-md flex justify-between items-center ${typeClasses[type]}`} role="alert">
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-4 text-lg font-bold leading-none hover:opacity-70">
        &times;
      </button>
    </div>
  );
};

const handleNextAuthError = (errorParam: string | null): { message: string } => {
  if (!errorParam) return { message: '' };

  if (errorParam.includes('Banned:')) return { message: errorParam.replace('Banned:', 'Admin account banned:') };
  if (errorParam.includes('Suspended:')) return { message: errorParam.replace('Suspended:', 'Admin account suspended:') };

  switch (errorParam) {
    case 'CredentialsSignin':
      return { message: 'Invalid admin credentials. Access denied.' };
    default:
      return { message: decodeURIComponent(errorParam).replace(/_+/g, ' ') };
  }
};

export default function AdminLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam && errorParam !== 'SignOut') {
      setMessage(handleNextAuthError(errorParam).message);
      setMessageType('error');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email.trim() || !password.trim()) {
      setMessage('Please enter both email and password.');
      setMessageType('error');
      setLoading(false);
      return;
    }

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (result?.error) {
        setMessage(handleNextAuthError(result.error).message);
        setMessageType('error');
        setLoading(false);
        return;
      }

      if (result?.ok) {
        // Get session to verify admin status
        const session = await getSession();
        if (session?.user && (session.user.role === 'admin' || session.user.role === 'super_admin')) {
          setMessage('Welcome back, Admin!');
          setMessageType('success');
          setTimeout(() => {
            router.push('/admin');
          }, 500);
        } else {
          setMessage('Admin access denied. This account does not have admin privileges.');
          setMessageType('error');
          setLoading(false);
        }
      }
    } catch (error) {
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Admin Portal Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-xl mb-4 shadow-lg">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-slate-400">Hustle Hub Africa Management</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 border border-slate-700">
          {message && (
            <Alert
              type={messageType}
              message={message}
              onClose={() => setMessage(null)}
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
                Admin Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hustlehubafrica.com"
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                disabled={loading}
                required
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-200 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-300"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                      <path d="M15.171 13.576l1.477-1.477A10.014 10.014 0 0019.542 10 10.014 10.014 0 0010 3c-4.478 0-8.268 2.943-9.542 7a9.928 9.928 0 001.7 3.24m2.02-2.02l2.585 2.586c.23.23.554.356.884.356a1.25 1.25 0 100-2.5 1.252 1.252 0 00-.884.356z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition duration-200 flex items-center justify-center gap-2"
            >
              {loading && <span className="animate-spin">⏳</span>}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-600"></div>
            <span className="text-xs text-slate-400 uppercase">or</span>
            <div className="flex-1 h-px bg-slate-600"></div>
          </div>

          {/* Regular Login Link */}
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              Not an admin?{' '}
              <Link
                href="/auth/login"
                className="text-blue-400 hover:text-blue-300 font-semibold transition"
              >
                User Login
              </Link>
            </p>
          </div>

          {/* Admin Only Warning */}
          <div className="mt-6 p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <p className="text-xs text-amber-200 text-center">
              ⚠️ This portal is for authorized administrators only. Unauthorized access attempts are logged.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Admin Portal v1.0 • All access monitored
        </p>
      </div>
    </div>
  );
}
