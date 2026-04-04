'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import api from '@/lib/axios';
import { validatePassword } from '@/lib/passwordValidation';
import PasswordStrengthMeter from '@/components/ui/PasswordStrengthMeter';

import Button from '../components/UI/Button';
import BrandLogo from '../components/UI/BrandLogo';
import AuthCard from '../components/UI/AuthCard';

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const pwValidation = validatePassword(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!pwValidation.valid) {
      setError('Password does not meet the required security policy. Please check the requirements below.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/auth/register', {
        username, fullName, email: email.toLowerCase(), password,
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const errorData = err.response?.data;
      let errorMessage = 'Registration failed. Please try again.';
      if (typeof errorData === 'string') errorMessage = errorData;
      else if (errorData?.message) errorMessage = errorData.message;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">

      {/* Back Link */}
      <div className="w-full max-w-[420px] mb-4">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      <BrandLogo />

      <AuthCard>
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8">
          <Link href="/login" className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors">
            Sign In
          </Link>
          <button className="flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold">
            Register
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Username */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Username</label>
            <input
              type="text"
              value={username}
              required
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Pick a username"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              required
              onChange={(e) => setFullName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="Enter your email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, letters, numbers &amp; symbols"
                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                required
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                className={`w-full px-4 py-3 pr-11 rounded-xl border outline-none transition-all text-sm focus:ring-4 ${
                  confirmPassword && confirmPassword !== password
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500/10'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {confirmPassword && confirmPassword !== password && (
              <p className="text-[11px] text-red-600 mt-1 ml-1">Passwords do not match.</p>
            )}
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isLoading || !pwValidation.valid || password !== confirmPassword}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-8 text-center text-xs text-gray-400">
          © 2026 Planora. All rights reserved.
        </p>
      </AuthCard>
    </div>
  );
}