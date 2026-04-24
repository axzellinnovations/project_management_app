'use client'; // Tells Next.js to render this component on the browser, not the server.

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios'; // Centralized Axios instance (hopefully configured with base URLs and interceptors)

import AuthCard from './UI/AuthCard';
import Button from './UI/Button';

/*
 * The OTP Verification Form.
 * Handles extracting the email from the URL, submitting the OTP to the backend,
 * gracefully handling Spring Boot error responses, and managing the resend logic.
 */
export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Grabs ?email=suthankan@example.com from the URL bar.
  const email = searchParams.get('email'); 

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── OTP VERIFICATION SUBMIT ───────────────────────────────────────────────
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the browser from doing a full page refresh
    setIsLoading(true);
    setError('');

    try {
      // Hit the Spring Boot backend
      await api.post('/api/auth/reg/verify', { email, otp });

      setSuccessMsg('Email verified! Redirecting to login...');
      // UX: Give the user 1.5 seconds to read the success message before kicking them to login.
      setTimeout(() => router.push('/login'), 1500);

    } catch (_err: unknown) {
      // Safely parse the Axios error object.
      const errResponse = (_err as { response?: { status?: number; data?: unknown } })?.response;
      const status = errResponse?.status;
      const errorData = errResponse?.data;

      let errorMessage = 'Invalid OTP. Please try again.';

      // Backend Error Translation: 
      // We map specific HTTP status codes and backend string responses to user-friendly messages.
      if (status === 429) {
        errorMessage = 'Too many failed attempts. Please request a new OTP.';
      } else if (typeof errorData === 'string' && errorData.trim()) {
        errorMessage = errorData;
        if (errorData.toLowerCase().includes('attempt')) {
          errorMessage = 'Too many failed attempts. Please request a new OTP.';
        }
      } else if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        // Fallback for standard JSON error objects from Spring Boot.
        errorMessage = (errorData as { message: string }).message;
      }

      setError(errorMessage);
    } finally {
      // Always turn off the loading spinner, whether it succeeded or failed.
      setIsLoading(false);
    }
  };

  // ── RESEND OTP LOGIC ──────────────────────────────────────────────────────
  const handleResend = async () => {
    if (!email) return;
    
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/resend', { email });
      setError('');

      const msg = typeof response.data === 'string' ? response.data : 'New OTP sent to your email.';
      setSuccessMsg(msg);
    } catch (_err: unknown) {
      
      let errorMessage = 'Failed to resend OTP. Please try again.';
      const res = (_err as { response?: { data?: unknown } })?.response;
      const errorData = res?.data;
      
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === 'object' && 'message' in errorData) {
        errorMessage = (errorData as { message: string }).message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <AuthCard>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-500 mt-2">
          We sent a verification code to <br/>
          <span className="font-semibold text-gray-900">{email}</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label htmlFor="otp-input" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
            Verification Code (OTP)
          </label>
          <input
            id="otp-input"
            type="text"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            // 'font-mono' and 'tracking-widest' makes the numbers spread out, 
            // mimicking standard authenticator app UI.
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            placeholder="123456"
            aria-label="Six-digit verification code"
            aria-describedby={error ? 'verify-error' : undefined}
          />
        </div>

        {/* Error State - aria-live="polite" tells screen readers to read this out loud when it appears */}
        {error && (
          <p id="verify-error" role="alert" aria-live="polite" className="text-xs text-red-600 text-center bg-red-50 p-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Success State */}
        {successMsg && (
          <p role="status" aria-live="polite" className="text-xs text-green-700 text-center bg-green-50 p-2 rounded-lg">
            {successMsg}
          </p>
        )}

        {/* Uses our custom Button component */}
        <Button type="submit" isLoading={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify Email'}
        </Button>
      </form>

      {/* Footer Links */}
      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          Didn&apos;t receive the code?{' '}
          <button 
            onClick={handleResend}
            disabled={isLoading}
            aria-label="Resend verification code"
            className="text-blue-600 font-semibold hover:underline disabled:opacity-50"
          >
            Resend
          </button>
        </p>
      </div>
      
      <div className="mt-4 text-center">
        <Link href="/register" className="text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Register
        </Link>
      </div>
    </AuthCard>
  );
}