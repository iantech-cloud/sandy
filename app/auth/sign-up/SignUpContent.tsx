'use client'; 

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPhoneNumber } from '@/app/lib/utils/phoneFormatter';

export default function SignUpContent() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    fullName: '',
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
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [confirmNameAccuracy, setConfirmNameAccuracy] = useState(false);
  const router = useRouter();

  // Check for referral code in URL (silent — not displayed to user)
  useEffect(() => {
    const refParam = searchParams.get('ref');
    const DEFAULT_REFERRAL_CODE = 'SANDY001';
    const formattedRef = refParam
      ? refParam.toUpperCase().replace(/[^A-Z0-9]/g, '')
      : DEFAULT_REFERRAL_CODE;

    setFormData(prev => ({ ...prev, referralId: formattedRef }));
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(''); 
    setSuccess('');
  };

  // Check if form is completely filled and all checkboxes are checked
  const isFormComplete = () => {
    const hasAllFields = formData.fullName.trim() && 
                         formData.email.trim() && 
                         formData.phone.trim() && 
                         formData.password && 
                         formData.confirmPassword;
    const hasAllCheckboxes = agreeToTerms && confirmNameAccuracy;
    const passwordsMatch = formData.password === formData.confirmPassword;
    
    return hasAllFields && hasAllCheckboxes && passwordsMatch && !isLoading;
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    if (!formData.fullName || !formData.email || !formData.phone || !formData.password) {
      setError('Please fill in all required fields.');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return false;
    }
    // Full name validation (letters, spaces, hyphens, apostrophes)
    const nameRegex = /^[a-zA-Z\s\-']+$/;
    if (!nameRegex.test(formData.fullName)) {
      setError('Name can only contain letters, spaces, hyphens, and apostrophes.');
      return false;
    }
    if (formData.fullName.trim().length < 2) {
      setError('Please enter a valid full name with at least 2 characters.');
      return false;
    }
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }
    // Phone validation (Kenyan format - accepts multiple formats)
    const cleanPhone = formData.phone.replace(/[\s\-\+]/g, '');
    const isValidFormat = 
      /^0[0-9]{9}$/.test(cleanPhone) ||  // 0712345678 (10 digits starting with 0)
      /^[0-9]{9}$/.test(cleanPhone) ||   // 712345678 (9 digits)
      /^254[0-9]{9}$/.test(cleanPhone);  // 254712345678 (12 digits with country code)
    
    if (!isValidFormat) {
      setError('Please enter a valid Kenyan phone number (e.g., 0712345678, 712345678, or 254712345678).');
      return false;
    }
    // Checkbox validations
    if (!agreeToTerms) {
      setError('You must agree to the terms and policies to create an account.');
      return false;
    }
    if (!confirmNameAccuracy) {
      setError('You must confirm that your name matches your government-issued identification.');
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

      // Format phone number using the proper formatter utility
      // This handles: 0712345678, 712345678, 254712345678, +254712345678
      const formattedPhone = formatPhoneNumber(formData.phone);

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
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
      
      setSuccess('Registration successful! You can now log in and proceed to activation.');

      console.log('Sign up successful! User ID:', data.user_id, 'Generated username:', data.username);

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
    setAgreeToTerms(false);
    setConfirmNameAccuracy(false);
    setFormData({
      fullName: '',
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
                  <span className="font-medium">{registrationData.username || formData.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Email:</span>
                  <span className="font-medium">{formData.email}</span>
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
                  <span><strong>Pay activation fee</strong> - KES 95 to activate your account</span>
                </li>
                <li className="flex items-start">
                  <span className="bg-indigo-100 text-indigo-800 rounded-full w-5 h-5 flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0">3</span>
                  <span><strong>Start earning!</strong> - Access surveys and content creation</span>
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

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Sign Up Form */}
          <form className="space-y-4" onSubmit={handleSignUp}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                We&apos;ll automatically create a unique username for you
              </p>
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
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handlePhoneChange}
                placeholder="e.g., 0712345678"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter 10 digits starting with 0 (e.g., 0712345678)
              </p>
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

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="agreeToTerms"
                checked={agreeToTerms}
                onChange={(e) => {
                  setAgreeToTerms(e.target.checked);
                  setError('');
                }}
                className="w-4 h-4 mt-1 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="agreeToTerms" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                I certify that I am <span className="font-bold">18 years of age or older</span>, agree to the <span className="font-bold">User Agreement</span>, acknowledge the <span className="font-bold"><Link href="/terms" target="_blank" className="text-indigo-600 hover:text-indigo-700 underline">Terms &amp; Conditions and Refund Policy</Link></span>.
              </label>
            </div>

            {/* Name Accuracy Checkbox */}
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="confirmNameAccuracy"
                checked={confirmNameAccuracy}
                onChange={(e) => {
                  setConfirmNameAccuracy(e.target.checked);
                  setError('');
                }}
                className="w-4 h-4 mt-1 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="confirmNameAccuracy" className="text-sm text-gray-700 cursor-pointer leading-relaxed">
                I acknowledge my name is correct and corresponds to the <span className="font-bold">government-issued identification</span>.
              </label>
            </div>

            {/* Create Account Button - Only visible when form is complete */}
            {isFormComplete() ? (
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            ) : (
              <div className="w-full bg-gray-300 text-gray-500 py-3 rounded-lg font-semibold text-center cursor-not-allowed">
                Please fill all fields and accept the terms
              </div>
            )}
          </form>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-indigo-600 font-semibold hover:text-indigo-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
