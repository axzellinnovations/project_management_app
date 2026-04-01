'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

import InputField from '../components/UI/InputField'; 
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        const response = await api.post('/api/auth/register', {
            username, fullName, email: email.toLowerCase(), password
        });
        console.log("Registration successful:", response.data);
        router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("Registration failed:", error);
        
        let errorMessage = 'Registration failed. Please try again.';
        const errorData = error.response?.data;
        
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
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <InputField 
            label="Username" type="text" value={username} required
            onChange={(e) => setUsername(e.target.value)} placeholder="Pick a username"
          />

          <InputField 
            label="Full Name" type="text" value={fullName} required
            onChange={(e) => setFullName(e.target.value)} placeholder="John Doe"
          />

          <InputField 
            label="Email Address" type="email" value={email} required
            onChange={(e) => setEmail(e.target.value.toLowerCase())} placeholder="Enter your email"
          />

          <InputField 
            label="Password" type="password" value={password} required
            onChange={(e) => setPassword(e.target.value)} placeholder="Create a password"
          />

          <InputField 
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