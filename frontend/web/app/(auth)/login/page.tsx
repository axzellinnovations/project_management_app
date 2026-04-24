'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useLoginForm } from './useLoginForm';

/*
 * The Login View Component.
 * Because we abstracted the logic into `useLoginForm`, 
 * this file is extremely clean. Its only job is to bind the state variables 
 * to the HTML inputs and render the UI.
 */
export default function LoginPage() {
    // Destructure the state and handlers from our custom business logic hook.
  const {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    showPassword, setShowPassword,
    isLoading,
    error,
    handleLogin,
  } = useLoginForm();

    return (

        <div className='min-h-screen flex flex-col items-center justify-center p-4'>

            {/* ── 1. Navigation ── */}
            <div className="w-full max-w-[420px] mb-4">
                <Link href={"/"} className='inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
                    {/* Accessibility: aria-hidden="true" tells screen readers to ignore this decorative icon */}
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to home
                </Link>
            </div>

            {/* ── 2. Brand Header ── */}
            <div className='mb-8 text-center'>
                <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4' aria-hidden="true">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planora</h1>
                <p className="text-gray-500 text-sm mt-2">Project Management Platform</p>
            </div>

            {/* ── 3. Main Card Container ── */}
            <div className='w-full max-w-[420px] glass-panel rounded-[24px] shadow-xl p-4 sm:p-8'>

                {/* ── Tab Switcher ── */}
                {/* Accessibility: role="tablist" and "tab" help screen readers understand this UI paradigm */}
                <div className='flex bg-gray-100 p-1.5 rounded-xl mb-8' role="tablist">
                    <button
                        role="tab"
                        aria-selected="true"
                        className='flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold'
                    >
                        Sign In
                    </button>
                    <Link
                        href="/register"
                        role="tab"
                        aria-selected="false"
                        className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors"
                    >
                        Register
                    </Link>
                </div>

                {/* ── Error Banner ── */}
                {/* Accessibility: aria-live="polite" ensures the error is read aloud exactly when it appears */}
                {error && (
                    <div
                        id="login-error"
                        role="alert"
                        aria-live="polite"
                        className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* ── The Form ── */}
                {/* noValidate tells the browser to let React handle the validation logic and error messages */}
                <form className='space-y-5' onSubmit={handleLogin} noValidate>

                    {/* Email Input */}
                    <div>
                        {/* Accessibility: htmlFor matches the input ID, making the label clickable */}
                        <label htmlFor="login-email" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
                            Email Address
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            // Mobile OS hints for better UX on phones
                            autoComplete="email"
                            autoCapitalize="off"
                            autoCorrect="off"
                            inputMode="email"
                            // The text-[16px] prevents iOS Safari from auto-zooming
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-[16px] sm:text-sm"
                            placeholder="Enter your email"
                            value={email}
                            // Data Normalization: Force lowercase immediately to prevent case-sensitive login bugs later.
                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                            // Accessibility: Links this specific input to the error banner above
                            aria-describedby={error ? 'login-error' : undefined}
                            aria-invalid={!!error}
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label htmlFor="login-password" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-[16px] sm:text-sm"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-describedby={error ? 'login-error' : undefined}
                                aria-invalid={!!error}
                            />

                            {/* Visibility Toggle */}
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                tabIndex={-1}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    {/* ── Utilities: Remember Me & Forgot Password ── */}
                    <div className="flex items-center justify-between mt-2">
                        <label htmlFor="login-remember" className="flex items-center gap-2 cursor-pointer">
                            <input
                                id="login-remember"
                                type="checkbox"
                                checked={remember}
                                onChange={(e) => setRemember(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-gray-500 text-xs">Remember me for 7 days</span>
                        </label>
                        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold text-xs">
                            Forgot password?
                        </Link>
                    </div>

                    {/* ── Submit Button ── */}
                     {/* Accessibility: The button's disabled state is managed by the isLoading flag to prevent multiple submissions */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full font-bold py-2 min-h-[44px] rounded-lg transition-colors text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                {/* ── Footer ── */}
                <p className="mt-8 text-center text-xs text-gray-400">
                    © 2026 Planora. All rights reserved.
                </p>
            </div>
        </div>
    );
}
