'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { saveRefreshToken, saveToken } from '@/lib/auth';


export default function LoginPage() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {

            // 1. Sign in using backend API
            const response = await api.post('/api/auth/login', {
                email: email.toLowerCase(),
                password: password
            });

            // 2. Check if login was successful
            if (response.data.success) {
                // Store tokens
                console.log("Login successful:", response.data);
                saveToken(response.data.token);
                if (response.data.refreshToken) {
                    saveRefreshToken(response.data.refreshToken);
                }

                // 3. Redirect to dashboard
                router.push('/dashboard');
            } else {
                // Show error message from backend
                setError(response.data.message || 'Login failed. Please try again.');
            }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            console.error("Login failed:", error);
            
            // Extract error message from backend response
            let errorMessage = "Login failed. Please try again.";
            const errorData = error.response?.data;
            
            if (typeof errorData === 'string') {
                errorMessage = errorData;
            } else if (errorData?.message) {
                errorMessage = errorData.message;
            }
            
            // Handle different error scenarios
            if (error.response?.status === 403) {
                // Unverified email
                setError(errorMessage || "Email is not verified. Please check your email.");
            } else if (error.response?.status === 401) {
                // Invalid credentials
                setError(errorMessage || "Incorrect username or password");
            } else {
                setError(errorMessage);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (

        <div className='min-h-screen flex flex-col items-center justify-center p-4'>

            {/* 1. Back to Home Link */}
            <div className="w-full max-w-[420px] mb-4">
                <Link href={"/"} className='inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to home
                </Link>
            </div>

            {/* 2. Header Section */}
            <div className='mb-8 text-center'>
                <div className='mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4'>
                    {/* Simple Clipboard Icon */}
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
                <div className='flex bg-gray-100 p-1.5 rounded-xl mb-8'>

                    {/* Sign In-Active */}
                    <button className='flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold'>
                        Sign In
                    </button>

                    {/* Register-Inactive */}
                    <Link href="/register" className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors">
                        Register
                    </Link>
                </div>

                {/* Error Message Display */}
                {error && (
                    <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                )}

                {/* The Form */}
                <form className='space-y-5' onSubmit={handleLogin}>
                    {/* Email Input */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        />
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {/* Remember & Forgot Links */}
                    <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <span className="ml-2 text-gray-500 text-xs">Remember me</span>
                        </label>
                        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold text-xs">
                            Forgot password?
                        </Link>
                    </div>

                    {/* The Big Blue Button */}
                    <button className={`w-full font-bold py-2 rounded-lg transition-colors text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                        {isLoading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
                {/* End of Card */}

                {/* Footer Copyright */}
                <p className="mt-8 text-center text-xs text-gray-400">
                    © 2026 Planora. All rights reserved.
                </p>
            </div>
        </div>
    );
}
