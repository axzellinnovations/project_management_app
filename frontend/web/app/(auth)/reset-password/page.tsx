'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import ResetPasswordForm from './components/ResetPasswordForm';
import SuccessMessage from './components/SuccessMessage';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (!email || !otp) {
      setError('Please enter both email and OTP.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      await api.post('/api/auth/reset', {
        email: email.toLowerCase(),
        otp: otp,
        newPassword: newPassword
      });

      setSubmitted(true);
      setEmail('');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      console.error("Reset password error:", err);
      
      let errorMessage = 'Failed to reset password. Please try again.';
      const errorData = err.response?.data;
      
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
    <div className='min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4'>
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
        <p className="text-gray-500 text-sm mt-2">Enter your email and OTP to create a new password</p>
      </div>

      {/* Main Card Container */}
      <div className='w-full max-w-[420px] bg-white rounded-[24px] shadow-sm p-8'>
        {submitted ? (
          <SuccessMessage />
        ) : (
          <ResetPasswordForm
            email={email}
            otp={otp}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            error={error}
            isLoading={isLoading}
            onEmailChange={setEmail}
            onOtpChange={setOtp}
            onPasswordChange={setNewPassword}
            onConfirmPasswordChange={setConfirmPassword}
            onSubmit={handleSubmit}
          />
        )}

        {/* Footer Reference */}
        <p className="mt-8 text-center text-xs text-gray-400">
          © 2026 Planora. All rights reserved.
        </p>
      </div>
    </div>
  );
}

