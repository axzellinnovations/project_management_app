'use client';

import Link from 'next/link';
import InputField from '../components/UI/InputField';
import Button from '../components/UI/Button';
import BrandLogo from '../components/UI/BrandLogo';
import AuthCard from '../components/UI/AuthCard';
import { useRegisterForm, STRENGTH_LABELS, STRENGTH_COLOURS } from './useRegisterForm';

export default function RegisterPage() {
  const {
    username, setUsername,
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    isLoading,
    error,
    strength,
    handleRegister,
  } = useRegisterForm();

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
              label="Password" type="password" value={password} required showToggle
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
            label="Confirm Password" type="password" value={confirmPassword} required showToggle
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
