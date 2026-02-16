'use client';

import { useState } from 'react';   
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

import InputField from '../components/UI/InputField'; 
import Button from '../components/UI/Button';
import BrandLogo from '../components/UI/BrandLogo';
import AuthCard from '../components/UI/AuthCard';

export default function LoginPage() {
    const router = useRouter();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await api.post('/api/auth/login', { email, password });
            localStorage.setItem('token', response.data);
            router.push('/dashboard');
        } catch (error:any) {
            console.error("Login failed:", error);
            alert(error.response?.data || "Login failed.");
        } finally {
            setIsLoading(false);
        }
    };

    return(
        <div className='min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4'>

            {/* Back Link */}
            <div className="w-full max-w-[420px] mb-4">
                <Link href={"/"} className='inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to home
                </Link>
            </div>

            <BrandLogo />

            <AuthCard>
                {/* Tab Switcher */}
                <div className='flex bg-gray-100 p-1.5 rounded-xl mb-8'>
                    <button className='flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold'>
                        Sign In
                    </button>
                    <Link href="/register" className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors">
                        Register
                    </Link>
                </div>

                <form className='space-y-5' onSubmit={handleLogin}>
                    <InputField
                        label="Email Address"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        placeholder="Enter your email"
                        required
                    />

                    <InputField
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                    />

                    <div className="flex items-center justify-between mt-2">
                        <label className="flex items-center cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                            <span className="ml-2 text-gray-500 text-xs">Remember me</span>
                        </label>
                        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-700 font-semibold text-xs">
                        Forgot password?
                        </Link>
                    </div>

                    <Button type="submit" isLoading={isLoading}>
                        {isLoading ? 'Signing In...' : 'Sign In'}
                    </Button>
                </form>

                <p className="mt-8 text-center text-xs text-gray-400">
                    © 2026 Planora. All rights reserved.
                </p>
            </AuthCard>
       </div>
    );
}