'use client'; 

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

// Google Sign In Button Component
const GoogleSignInButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('google', { callbackUrl: '/auth/verify-login' });
    } catch (error) {
      console.error('Google sign in error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-600"></div>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      Continue with Google
    </button>
  );
};

export default function SignUpContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    referralId: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [registrationData, setRegistrationData] = useState<any>(null);
  const [referrerUsername, setReferrerUsername] = useState<string | null>(null);
  const [hasValidReferral, setHasValidReferral] = useState(false);
  const router = useRouter();

  // Check for referral code in URL and fetch referrer info
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      const formattedRef = refParam.toUpperCase().replace(/[^A-Z0-9]/g, '');
      setFormData(prev => ({ ...prev, referralId: formattedRef }));
      
      // Fetch referrer info to display who referred the user
      const fetchReferrer = async () => {
        try {
          const response = await fetch(`/api/referrer/${formattedRef}`);
          if (response.ok) {
            const data = await response.json();
            setReferrerUsername(data.username);
            setHasValidReferral(true);
          } else {
            setHasValidReferral(false);
          }
        } catch (err) {
          console.error('Error fetching referrer:', err);
          setHasValidReferral(false);
        }
      };
      
      fetchReferrer();
    } else {
      setHasValidReferral(false);
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); 
    setSuccess('');
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    if (!formData.username || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill in all required fields.');
      return false;
    }
    // Referral code is REQUIRED from URL parameter
    if (!hasValidReferral || !formData.referralId) {
      setError('Invalid or missing referral link. Please use a valid referral link to sign up.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    // Username validation (alphanumeric, underscores, hyphens)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(formData.username)) {
      setError('Username can only contain letters, numbers, underscores, and hyphens.');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    // Phone validation (Kenyan format - 9 digits)
    const phoneRegex = /^[0-9]{9}$/;
    if (!phoneRegex.test(formData.phone.replace(/\s/g, ''))) {
      setError('Please enter a valid Kenyan phone number (9 digits without +254).');
      return false;
    }
    return true;
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      console.log('Attempting sign up with:', formData);

      // Format phone number to include country code for storage
      const formattedPhone = `+254${formData.phone.replace(/\s/g, '')}`;

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          phone: formattedPhone,
          password: formData.password,
          referralId: formData.referralId ? formData.referralId.toUpperCase() : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 409) {
          if (data.message.includes('Username')) {
            throw new Error('Username already taken. Please choose a different username.');
          } else if (data.message.includes('Email')) {
            throw new Error('Email already registered. Please log in or use a different email.');
          }
        } else if (response.status === 400 && data.message.includes('Referral ID')) {
          throw new Error('Invalid referral ID. Please check and try again.');
        }
        throw new Error(data.message || 'Registration failed');
      }

      // Store registration data and show success message
      setRegistrationData(data);
      setEmailSent(data.email_sent);
      
      if (data.email_sent) {
        setSuccess('Registration successful! You can now log in and proceed to activation.');
      } else {
        setSuccess('Registration successful! You can now log in and proceed to activation.');
      }

      console.log('Sign up successful! User ID:', data.user_id);

    } catch (err: any) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Format phone input to show only numbers and auto-format
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow any valid phone format (9-13 digits, optional +, optional 0 prefix)
    // The phone formatter utility will normalize it during validation
    setFormData({ ...formData, phone: value });
    setError('');
    setSuccess('');
  };

  // Reset form and show registration form again
  const handleBackToSignUp = () => {
    setSuccess('');
    setEmailSent(false);
    setRegistrationData(null);
    setFormData({
      username: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
      referralId: '',
    });
  };

  // Success Screen - Show after successful registration
  if (success && registrationData) {
    return (
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-indigo-100">
          <div className="text-center mb-8">
            <div className="text-2xl font-extrabold text-indigo-600 mb-4">
              HH HustleHub Africa
            </div>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900">
              Registration Successful!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Welcome to HustleHub Africa
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Your Account Details:</h3>
              <div className="space-y-2 text-sm text-blue-700">
                <div className="flex justify-between">
                  <span>Username:</span>
                  <span className="font-medium">{formData.username}</span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="font-medium">{formData.email}</span>
                </div>
                <div className="flex justify-between">
                  <span>Referral ID:</span>
                  <span className="font-medium">{registrationData.referral_id}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
              <h3 className="font-semibold text-indigo-800 mb-3">Next Steps:</h3>
              <ol className="space-y-2 text-sm text-indigo-700">
                <li className="flex items-start">
                  <span className="bg-indigo-100 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">1</span>
                  <span><strong>Log in</strong> - Use your credentials to access your account</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-100 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">2</span>
                  <span><strong>Pay activation fee</strong> - KES 90 to activate your account</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-100 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                  <span><strong>Start earning!</strong> - Access surveys, content creation, and referrals</span>
                </li>
              </ol>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/auth/login')}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
            >
              Go to Login
            </button>
            <button
              onClick={handleBackToSignUp}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
            >
              Back to Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default sign up form
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8">
          <div className="text-center mb-8">
            <div className="text-2xl font-extrabold text-indigo-600 mb-4">
              HH HustleHub Africa
            </div>
            <h1 className="text-3xl font-extrabold text-gray-900">Create Account</h1>
            <p className="mt-2 text-gray-600">Join HustleHub Africa and start earning</p>
          </div>

          {/* Google Sign Up Button */}
          <div className="mb-6">
            <GoogleSignInButton />
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or sign up with email</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Referrer Info */}
          {referrerUsername && (
            <div className="mb-4 p-3 bg-indigo-100 border border-indigo-400 text-indigo-700 rounded-lg text-sm">
              Referred by: <span className="font-semibold">{referrerUsername}</span>
            </div>
          )}

          {/* Sign Up Form */}
          <form className="space-y-4" onSubmit={handleSignUp}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Choose your username"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number (9 digits)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="254XXXXXXXXX without country code"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Minimum 6 characters"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm your password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/sign-in" className="text-indigo-600 font-semibold hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
