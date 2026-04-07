'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/auth/forgot', {
        email: email.toLowerCase()
      });

      setSuccess(response.data);
      setSubmitted(true);
      setEmail('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Forgot password error:", err);
      
      let errorMessage = 'Failed to process request. Please try again.';
      const errorData = err.response?.data;
      
      // Handle different error response formats
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='min-h-screen flex flex-col items-center justify-center p-4'>
      {/* Back to Login Link */}
      <div className="w-full max-w-[420px] mb-4">
        <Link href="/login" className='inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to login
        </Link>
      </div>

      {/* Header Section */}
      <div className='mb-8 text-center'>
        <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4'>
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Reset Password</h1>
        <p className="text-gray-500 text-sm mt-2">Enter your email to receive a reset code</p>
      </div>

      {/* Main Card Container */}
      <div className='w-full max-w-[420px] glass-panel rounded-[24px] shadow-xl p-8'>
        {submitted ? (
          // Success Message
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your email</h2>
            <p className="text-gray-500 text-sm mb-6">
              We&apos;ve sent a password reset code to <br />
              <span className="font-semibold text-gray-900">{email}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Go to the reset password page and enter the 6-digit code you received. The code will expire in 10 minutes.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className='w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors mb-2'
            >
              Send code to another email
            </button>
            <Link href="/reset-password" className='block text-blue-600 hover:text-blue-700 font-semibold text-sm text-center'>
              I already have a code
            </Link>
          </div>
        ) : (
          // Form
          <form className='space-y-5' onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div role="alert" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
                Email Address
              </label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full font-bold py-2.5 rounded-lg transition-colors text-white ${
                isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        {/* Footer Reference */}
        <p className="mt-8 text-center text-xs text-gray-400">
          © 2026 Planora. All rights reserved.
        </p>
      </div>
    </div>
  );
}
