'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';

import AuthCard from './UI/AuthCard';
import Button from './UI/Button';

export default function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email'); 

  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.post('/api/auth/reg/verify', { email, otp });
      alert("Email verified successfully! Please login.");
      router.push('/login');
    } catch (err: any) {
      setError(err.response?.data?.message || "Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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

        <Button type="submit" isLoading={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify Email'}
        </Button>
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
    </AuthCard>
  );
}