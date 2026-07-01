// app/auth/login/LoginContent.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, signOut, getSession } from 'next-auth/react';
import Link from 'next/link';

// ── Alert ──────────────────────────────────────────────────────────────────
interface AlertProps {
  type: 'success' | 'error' | 'info';
  message: string;
  onClose: () => void;
}

const Alert: React.FC<AlertProps> = ({ type, message, onClose }) => {
  const typeClasses = {
    success: 'bg-green-100 border border-green-400 text-green-700',
    error:   'bg-red-100 border border-red-400 text-red-700',
    info:    'bg-blue-100 border border-blue-400 text-blue-700',
  };
  return (
    <div className={`p-4 mb-4 rounded-xl shadow-md flex justify-between items-center ${typeClasses[type]}`} role="alert">
      <p className="font-medium text-sm">{message}</p>
      <button onClick={onClose} className="ml-4 text-lg font-bold leading-none hover:opacity-70">&times;</button>
    </div>
  );
};

// ── Error message mapping ──────────────────────────────────────────────────
const handleNextAuthError = (errorParam: string | null): { message: string } => {
  if (!errorParam) return { message: '' };

  if (errorParam.includes('Banned:'))     return { message: errorParam.replace('Banned:', 'Your account has been banned:') };
  if (errorParam.includes('Suspended:'))  return { message: errorParam.replace('Suspended:', 'Your account is suspended:') };
  if (errorParam.includes('TwoFactorRequired'))   return { message: 'Please enter your 2FA verification code to continue.' };
  if (errorParam.includes('InvalidTwoFactorCode')) return { message: 'Invalid 2FA verification code. Please try again.' };

  switch (errorParam) {
    case 'CredentialsSignin':
    case 'Configuration':
    case 'CallbackRouteError':
      return { message: 'Invalid email or password. Please check your credentials and try again.' };
    default:
      return { message: decodeURIComponent(errorParam).replace(/_+/g, ' ') };
  }
};

// ── Forgot Password Modal ──────────────────────────────────────────────────
interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep]                         = useState<'email' | 'verification' | 'success'>('email');
  const [email, setEmail]                       = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading]                   = useState(false);
  const [message, setMessage]                   = useState<string | null>(null);
  const [messageType, setMessageType]           = useState<'success' | 'error' | 'info'>('info');
  const [verificationMethod, setVerificationMethod] = useState<'email' | '2fa'>('email');

  const resetForm = () => {
    setStep('email');
    setEmail('');
    setNewPassword('');
    setVerificationCode('');
    setMessage(null);
    setVerificationMethod('email');
  };

  const handleClose = () => { resetForm(); onClose(); };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res  = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, type: 'forgot' }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.needsVerification) {
          setVerificationMethod(data.verificationMethod);
          setStep('verification');
          setMessage(data.message);
          setMessageType('info');
        } else {
          setMessage(data.message || 'Password reset instructions sent to your email.');
          setMessageType('success');
        }
      } else {
        setMessage(data.error || 'Failed to process password reset request.');
        setMessageType('error');
      }
    } catch {
      setMessage('An error occurred. Please try again.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res  = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, verificationCode, verificationMethod, type: 'forgot' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('success');
        setMessage(data.message || 'Password reset successfully!');
        setMessageType('success');
      } else {
        setMessage(data.error || 'Failed to verify code.');
        setMessageType('error');
      }
    } catch {
      setMessage('An error occurred during verification.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const inputClass = 'mt-1 block w-full px-4 py-2 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors';
  const btnPrimary = 'flex-1 flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnSecondary = 'flex-1 py-3 px-4 border border-gray-300 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {step === 'email'        && 'Reset Password'}
              {step === 'verification' && 'Enter Verification Code'}
              {step === 'success'      && 'Password Reset Successful'}
            </h3>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">&times;</button>
          </div>

          {message && <Alert type={messageType} message={message} onClose={() => setMessage(null)} />}

          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700">Email Address</label>
                <input id="forgot-email" type="email" required value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="Enter your email address"
                  className={inputClass} disabled={loading} />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">New Password</label>
                <input id="new-password" type="password" required value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} placeholder="Enter your new password"
                  className={inputClass} disabled={loading} minLength={8} />
                <p className="mt-1 text-xs text-gray-500">Password must be at least 8 characters long</p>
              </div>
              <div className="flex space-x-3 pt-2">
                <button type="button" onClick={handleClose} disabled={loading} className={btnSecondary}>Cancel</button>
                <button type="submit" disabled={loading || !email || !newPassword || newPassword.length < 8} className={btnPrimary}>
                  {loading ? 'Processing...' : 'Reset Password'}
                </button>
              </div>
            </form>
          )}

          {step === 'verification' && (
            <form onSubmit={handleVerificationSubmit} className="space-y-4">
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700">
                  {verificationMethod === '2fa' ? '6-Digit Google Authenticator Code' : '6-Digit Email Verification Code'}
                </label>
                <input id="verification-code" type="text" inputMode="numeric" required maxLength={6} pattern="[0-9]{6}"
                  value={verificationCode} onChange={e => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="123456"
                  className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-center text-xl font-mono tracking-widest"
                  disabled={loading} autoFocus />
                <p className="mt-2 text-xs text-gray-500 text-center">
                  {verificationMethod === '2fa' ? 'Open your Google Authenticator app and enter the 6-digit code' : 'Check your email for the verification code'}
                </p>
              </div>
              <div className="flex space-x-3">
                <button type="button" onClick={() => setStep('email')} disabled={loading} className={btnSecondary}>Back</button>
                <button type="submit" disabled={loading || verificationCode.length !== 6} className={btnPrimary}>
                  {loading ? 'Verifying...' : 'Verify & Reset'}
                </button>
              </div>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-700">Your password has been reset successfully! You can now log in with your new password.</p>
              <button onClick={handleClose}
                className="w-full py-3 px-4 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors font-bold">
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────
interface LoginContentProps {
  hasExistingSession?: boolean;
}

export default function LoginContent({ hasExistingSession = false }: LoginContentProps) {
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [token2FA, setToken2FA]       = useState('');
  const [message, setMessage]         = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [loading, setLoading]         = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession]   = useState(true);

  const router       = useRouter();
  const searchParams = useSearchParams();
  const isTimeout    = searchParams.get('timeout') === 'true';
  const callbackUrl  = searchParams.get('callbackUrl') || '/dashboard';

  useEffect(() => {
    if (hasExistingSession) {
      setMessage('You are already logged in. You can continue to your dashboard or log in with a different account.');
      setMessageType('info');
    }
    setIsCheckingSession(false);
  }, [hasExistingSession]);

  useEffect(() => {
    if (isCheckingSession) return;
    const errorParam   = searchParams.get('error');
    const successParam = searchParams.get('success');

    if (successParam === 'registered') {
      setMessage('Registration successful! Please log in to continue.');
      setMessageType('success');
    }
    if (successParam === 'verified') {
      setMessage('Email verified successfully! You can now log in.');
      setMessageType('success');
    }
    if (errorParam && errorParam !== 'SignOut') {
      setMessage(handleNextAuthError(errorParam).message);
      setMessageType('error');
    }
  }, [searchParams, isCheckingSession]);

  // After successful sign-in, route the user to the right next step
  const checkUserStatusAndRedirect = async (redirectUrl: string) => {
    try {
      const res         = await fetch('/api/auth/session');
      const sessionData = await res.json();

      if (!sessionData?.user) {
        setMessage('Session error. Please try again.');
        setMessageType('error');
        setLoading(false);
        return;
      }

      const user = sessionData.user;

      // Activation check
      if (!user.isActivationPaid && !user.activation_paid_at) {
        // Include phone number in URL (remove + prefix if present)
        const phone = (user.phone_number || user.phone || '')?.replace(/^\+/, '');
        const activateUrl = phone ? `/auth/activate?phone=${encodeURIComponent(phone)}` : '/auth/activate';
        router.push(activateUrl);
        return;
      }
      // Approval / active check
      if (!user.is_approved || user.approval_status === 'pending') {
        router.push('/auth/pending-approval');
        return;
      }
      if (!user.is_active || user.status !== 'active') {
        router.push('/auth/pending-approval');
        return;
      }
      // All good
      router.push(redirectUrl);
    } catch {
      setMessage('Error checking user status. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // If switching accounts, sign out first
      if (hasExistingSession) {
        const currentSession = await getSession();
        if (currentSession?.user?.email && currentSession.user.email !== email) {
          await signOut({ redirect: false });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        token2FA: requires2FA ? token2FA : undefined,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes('TwoFactorRequired')) {
          setRequires2FA(true);
          setMessage('Please enter your 6-digit verification code from Google Authenticator.');
          setMessageType('info');
          setLoading(false);
          return;
        }
        setMessage(handleNextAuthError(result.error).message);
        setMessageType('error');
        setLoading(false);
        return;
      }

      if (result?.ok) {
        setMessage('Login successful! Checking account status...');
        setMessageType('success');
        await checkUserStatusAndRedirect(callbackUrl);
      } else {
        setMessage('An unexpected login response occurred.');
        setMessageType('error');
        setLoading(false);
      }
    } catch {
      setMessage('An unexpected network error occurred. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (hasExistingSession) {
        const currentSession = await getSession();
        if (currentSession?.user?.email && currentSession.user.email !== email) {
          await signOut({ redirect: false });
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        token2FA,
        redirect: false,
      });

      if (result?.error) {
        setMessage(handleNextAuthError(result.error).message);
        setMessageType('error');
        setToken2FA('');
        setLoading(false);
        return;
      }

      if (result?.ok) {
        setMessage('2FA verification successful! Checking account status...');
        setMessageType('success');
        await checkUserStatusAndRedirect(callbackUrl);
      }
    } catch {
      setMessage('An error occurred during 2FA verification. Please try again.');
      setMessageType('error');
      setLoading(false);
    }
  };

  const clearMessage  = () => setMessage(null);
  const backToPassword = () => { setRequires2FA(false); setToken2FA(''); setMessage(null); setLoading(false); };

  // Loading state while checking existing session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Preparing login page...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              HustleHub Africa
            </h1>
            <p className="text-gray-600 mt-2">
              {hasExistingSession ? 'Welcome back! You are already logged in.' : 'Welcome back! Sign in to continue'}
            </p>
          </div>

          {/* Dashboard shortcut for already-logged-in users */}
          {hasExistingSession && (
            <div className="mb-6 text-center">
              <Link href="/dashboard"
                className="inline-flex items-center px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-lg">
                Go to Dashboard
              </Link>
              <p className="text-sm text-gray-600 mt-2">or continue below to log in with a different account</p>
            </div>
          )}

          {/* Session-timeout notice */}
          {isTimeout && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                Your session expired due to inactivity. Please sign in again.
              </p>
            </div>
          )}

          {/* Main Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Sign In</h2>

            {message && <Alert type={messageType} message={message} onClose={clearMessage} />}

            {/* Credentials form */}
            <form onSubmit={requires2FA ? handle2FASubmit : handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  disabled={loading || requires2FA}
                />
              </div>

              {!requires2FA && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
              )}

              {requires2FA && (
                <div>
                  <label htmlFor="token2FA" className="block text-sm font-medium text-gray-700 mb-1">
                    2FA Verification Code
                  </label>
                  <input
                    id="token2FA"
                    type="text"
                    value={token2FA}
                    onChange={e => setToken2FA(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-xl font-mono tracking-widest"
                    disabled={loading}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={backToPassword}
                    className="text-sm text-indigo-600 hover:text-indigo-700 mt-2"
                    disabled={loading}
                  >
                    Back to password
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {requires2FA ? 'Verifying...' : 'Signing in...'}
                  </span>
                ) : requires2FA ? 'Verify & Sign In' : 'Sign In'}
              </button>
            </form>

            {/* Footer links */}
            <div className="mt-6 text-center space-y-2">
              <button
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-indigo-600 hover:text-indigo-700 block w-full"
              >
                Forgot your password?
              </button>
              <p className="text-sm text-gray-600 text-center">
                Don&apos;t have an account?{' '}
                <Link href="/auth/sign-up" className="text-indigo-600 font-semibold hover:text-indigo-700">
                  Create Account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      <ForgotPasswordModal isOpen={showForgotPassword} onClose={() => setShowForgotPassword(false)} />
    </>
  );
}
