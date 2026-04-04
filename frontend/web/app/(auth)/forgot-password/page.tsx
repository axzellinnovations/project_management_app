'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, KeyRound, CheckCircle2, ArrowRight, RotateCcw } from 'lucide-react';
import api from '@/lib/axios';
import { validatePassword } from '@/lib/passwordValidation';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';

type Step = 1 | 2 | 3;

export default function ForgotPasswordPage() {
  const router = useRouter();

  // Step 1
  const [email, setEmail] = useState('');
  // Step 2
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // Shared
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const pwValidation = validatePassword(newPassword);
  const otpValue = otp.join('');

  // Auto-redirect from step 3
  useEffect(() => {
    if (step !== 3) return;
    const timer = setTimeout(() => router.push('/login'), 4000);
    return () => clearTimeout(timer);
  }, [step, router]);

  // Resend OTP countdown
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // OTP input handling
  const handleOtpChange = (idx: number, val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[idx] = cleaned;
    setOtp(next);
    if (cleaned && idx < 5) {
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) otpRefs.current[idx + 1]?.focus();
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array(6).fill('');
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    const focusIdx = Math.min(pasted.length, 5);
    otpRefs.current[focusIdx]?.focus();
  };

  // Step 1 — Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post('/api/auth/forgot', { email: email.toLowerCase() });
      setStep(2);
      setCountdown(60);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const d = err.response?.data;
      setError(typeof d === 'string' ? d : d?.message ?? 'Failed to send reset code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (countdown > 0) return;
    setError('');
    try {
      setIsLoading(true);
      await api.post('/api/auth/forgot', { email: email.toLowerCase() });
      setOtp(['', '', '', '', '', '']);
      setCountdown(60);
      otpRefs.current[0]?.focus();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const d = err.response?.data;
      setError(typeof d === 'string' ? d : d?.message ?? 'Failed to resend code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 — Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpValue.length < 6) { setError('Please enter the full 6-digit code.'); return; }
    if (!pwValidation.valid) { setError('Password does not meet the security requirements.'); return; }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    setIsLoading(true);
    try {
      await api.post('/api/auth/reset', { email: email.toLowerCase(), otp: otpValue, newPassword });
      setStep(3);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const d = err.response?.data;
      setError(typeof d === 'string' ? d : d?.message ?? 'Invalid or expired code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputBase = 'w-full px-4 py-3 rounded-xl border focus:ring-4 outline-none transition-all text-sm border-gray-200 focus:border-blue-500 focus:ring-blue-500/10';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      {/* Back to Login */}
      <div className="w-full max-w-[440px] mb-4">
        <Link href="/login" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to login
        </Link>
      </div>

      {/* Card */}
      <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl border border-gray-100 p-8">

        {/* Step Indicator */}
        {step !== 3 && (
          <div className="flex items-center gap-2 mb-8">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                  step === s
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : step > s
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'bg-white border-gray-200 text-gray-400'
                }`}>
                  {step > s ? '✓' : s}
                </div>
                <span className={`text-xs font-medium ${step === s ? 'text-gray-900' : 'text-gray-400'}`}>
                  {s === 1 ? 'Enter Email' : 'Set Password'}
                </span>
                {s < 2 && <div className={`flex-1 h-px mx-1 ${step > s ? 'bg-emerald-400' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* ============ STEP 1 ============ */}
        {step === 1 && (
          <>
            <div className="text-center mb-7">
              <div className="mx-auto w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                <Mail size={24} className="text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Forgot your password?</h1>
              <p className="text-gray-500 text-sm mt-2">No worries — we&apos;ll send a 6-digit reset code to your email.</p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  required
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="Enter your registered email"
                  className={inputBase}
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {isLoading ? 'Sending...' : <><span>Send Reset Code</span><ArrowRight size={16} /></>}
              </button>
            </form>
          </>
        )}

        {/* ============ STEP 2 ============ */}
        {step === 2 && (
          <>
            <div className="text-center mb-7">
              <div className="mx-auto w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mb-4">
                <KeyRound size={24} className="text-amber-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Verify &amp; Reset</h1>
              <p className="text-gray-500 text-sm mt-2">
                We sent a 6-digit code to <span className="font-semibold text-gray-800">{email}</span>.
                <br />Enter the code and set your new password.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* OTP Boxes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-3 ml-1">6-Digit Reset Code</label>
                <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { otpRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className={`w-11 h-12 text-center text-lg font-bold rounded-xl border-2 outline-none transition-all ${
                        digit
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-900 focus:border-blue-400'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex justify-between items-center mt-2 px-1">
                  <span className="text-xs text-gray-400">Code expires in 10 min</span>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={countdown > 0 || isLoading}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    <RotateCcw size={12} />
                    {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    required
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars, letters, numbers &amp; symbols"
                    className={`${inputBase} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    required
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                    className={`${inputBase} pr-11 ${
                      confirmPassword && confirmPassword !== newPassword
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                        : ''
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword && confirmPassword !== newPassword && (
                  <p className="text-[11px] text-red-600 mt-1 ml-1">Passwords do not match.</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || otpValue.length < 6 || !pwValidation.valid || newPassword !== confirmPassword}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </button>

              <button
                type="button"
                onClick={() => { setStep(1); setOtp(['','','','','','']); setError(''); }}
                className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          </>
        )}

        {/* ============ STEP 3 — SUCCESS ============ */}
        {step === 3 && (
          <div className="text-center py-6">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-5">
              <CheckCircle2 size={36} className="text-emerald-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Password Reset!</h1>
            <p className="text-gray-500 text-sm mb-6">
              Your password has been successfully updated.<br />
              Redirecting you to login in a moment...
            </p>
            <div className="w-10 h-1 bg-emerald-200 rounded-full mx-auto overflow-hidden mb-6">
              <div className="h-full bg-emerald-500 rounded-full animate-[shrink_4s_linear_forwards]" style={{
                animation: 'progress 4s linear forwards',
              }} />
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
            >
              Go to Login Now
              <ArrowRight size={16} />
            </Link>
          </div>
        )}

        <p className="mt-8 text-center text-xs text-gray-400">© 2026 Planora. All rights reserved.</p>
      </div>
    </div>
  );
}
