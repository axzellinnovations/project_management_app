'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getValidToken } from '@/lib/auth';

import InputField from '../components/UI/InputField';
import Button from '../components/UI/Button';
import BrandLogo from '../components/UI/BrandLogo';
import AuthCard from '../components/UI/AuthCard';

// NTH-1: Password strength computation (no new npm packages)
function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOURS = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'];

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // NTH-3: Skip register page if already authenticated
  useEffect(() => {
    if (getValidToken()) {
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NTH-1: Derive strength reactively
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError("Passwords do not match!");
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/api/auth/register', {
        username, fullName, email: email.toLowerCase(), password
      });
      // FEATURE-5: persist email so the verification page can show a reminder banner
      localStorage.setItem('pendingVerificationEmail', email.toLowerCase());
      router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      let errorMessage = 'Registration failed. Please try again.';
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">

      {/* Back Link */}
      <div className="w-full max-w-[420px] mb-4">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
      </div>

      <BrandLogo />

      <AuthCard>
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8" role="tablist">
          <Link
            href="/login"
            role="tab"
            aria-selected="false"
            className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors"
          >
            Sign In
          </Link>
          <button
            role="tab"
            aria-selected="true"
            className="flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold"
          >
            Register
          </button>
        </div>

        <form onSubmit={handleRegister} className="space-y-4" noValidate>
          {/* FEATURE-1: Error banner with role="alert" + aria-live */}
          {error && (
            <div id="register-error" role="alert" aria-live="polite" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <InputField
            id="reg-username"
            label="Username" type="text" value={username} required
            onChange={(e) => setUsername(e.target.value)} placeholder="Pick a username"
            aria-describedby={error ? 'register-error' : undefined}
          />

          <InputField
            id="reg-fullname"
            label="Full Name" type="text" value={fullName} required
            onChange={(e) => setFullName(e.target.value)} placeholder="John Doe"
          />

          <InputField
            id="reg-email"
            label="Email Address" type="email" value={email} required
            onChange={(e) => setEmail(e.target.value.toLowerCase())} placeholder="Enter your email"
            aria-describedby={error ? 'register-error' : undefined}
          />

          {/* NTH-1: Password field with strength meter */}
          <div>
            <InputField
              id="reg-password"
              label="Password" type="password" value={password} required
              onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (min 8 chars)"
              aria-describedby="pw-strength"
            />
            {password.length > 0 && (
              <div id="pw-strength" className="mt-2" aria-label={`Password strength: ${STRENGTH_LABELS[strength]}`}>
                <div className="flex gap-1 mb-1">
                  {[1, 2, 3, 4].map((seg) => (
                    <div
                      key={seg}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${strength >= seg ? STRENGTH_COLOURS[strength] : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500">{STRENGTH_LABELS[strength]}</p>
              </div>
            )}
          </div>

          <InputField
            id="reg-confirm-password"
            label="Confirm Password" type="password" value={confirmPassword} required
            onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm your password"
          />

          <Button type="submit" isLoading={isLoading}>
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
