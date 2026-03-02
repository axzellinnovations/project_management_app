'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';

// We separate the logic component to use useSearchParams safely
function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email'); // Get email from URL

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle OTP Submission
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/auth/reg/verify', {
        email: email,
        otp: otp
      });

      // Success!
      alert("Email verified successfully! Please login.");
      router.push('/login');

    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-sm p-8">
      
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Check your email</h2>
        <p className="text-sm text-gray-500 mt-2">
          We sent a verification code to <br/>
          <span className="font-semibold text-gray-900">{email}</span>
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
            Verification Code (OTP)
          </label>
          <input
            type="text"
            required
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-center text-lg tracking-widest font-mono focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all"
            placeholder="123456"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 text-center bg-red-50 p-2 rounded-lg">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full font-bold py-3.5 rounded-xl transition-all text-white shadow-blue-500/30 shadow-lg active:scale-[0.98] 
          ${isLoading ? 'bg-blue-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isLoading ? 'Verifying...' : 'Verify Email'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-400">
          Didn't receive the code?{' '}
          <button className="text-blue-600 font-semibold hover:underline">
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

    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 font-sans">
      {/* Logo Header - Kept for consistency */}
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planora</h1>
      </div>

      {/* Suspense Wrapper is required for useSearchParams in Next.js App Router */}
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailContent />
      </Suspense>
    </div>
  );
}