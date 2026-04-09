'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { useLoginForm } from './useLoginForm';

export default function LoginPage() {
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

            {/* 1. Back to Home Link */}
            <div className="w-full max-w-[420px] mb-4">
                <Link href={"/"} className='inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to home
                </Link>
            </div>

            {/* 2. Header Section */}
            <div className='mb-8 text-center'>
                <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4' aria-hidden="true">
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planora</h1>
                <p className="text-gray-500 text-sm mt-2">Project Management Platform</p>
            </div>

            {/* 3. Main Card Container */}
            <div className='w-full max-w-[420px] glass-panel rounded-[24px] shadow-xl p-8'>
                {/* The Tab Switcher */}
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

                {/* FEATURE-1: Error banner with role="alert" and aria-live */}
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

                {/* The Form */}
                <form className='space-y-5' onSubmit={handleLogin} noValidate>
                    {/* FEATURE-1: id + htmlFor pairing on all label/input pairs */}
                    <div>
                        <label htmlFor="login-email" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
                            Email Address
                        </label>
                        <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                            aria-describedby={error ? 'login-error' : undefined}
                            aria-invalid={!!error}
                        />
                    </div>

                    <div>
                        <label htmlFor="login-password" className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
                        <div className="relative">
                            <input
                                id="login-password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-describedby={error ? 'login-error' : undefined}
                                aria-invalid={!!error}
                            />
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

                    {/* NTH-2: Remember-me checkbox + Forgot password link */}
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

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full font-bold py-2 rounded-lg transition-colors text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="mt-8 text-center text-xs text-gray-400">
                    © 2026 Planora. All rights reserved.
                </p>
            </div>
        </div>
    );
}
