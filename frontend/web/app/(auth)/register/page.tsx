'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';

export default function RegisterPage() {
  const router = useRouter();
  
  // 1. State for Registration Form
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 2. Handle Register Logic
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      setIsLoading(false);
      return;
    }

    try {
        // MATCHING YOUR BACKEND USER.JAVA EXACTLY
        const response = await api.post('/api/auth/register', {
            username: username, 
            fullName: fullName,
            email: email,
            password: password
        });

        console.log("Registration successful:", response.data);

        // Redirect to Verify page
        router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);

    } catch (error: any) {
        console.error("Registration failed:", error);
        // Show the text error from backend if available
        alert(error.response?.data || "Registration failed. Please try again.");
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4 font-sans">
      
      {/* 1. Back to Home Link */}
      <div className="w-full max-w-[420px] mb-4">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
        </Link>
      </div>

      {/* 2. Logo Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg mb-4">
          <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Planora</h1>
        <p className="text-gray-500 text-sm mt-2">Project Management Platform</p>
      </div>

      {/* 3. Main Card */}
      <div className="w-full max-w-[420px] bg-white rounded-[24px] shadow-sm p-8">
        
        {/* Tab Switcher */}
        <div className="flex bg-gray-100 p-1.5 rounded-xl mb-8">
          <Link href="/login" className="flex-1 flex items-center justify-center text-gray-500 hover:text-gray-900 py-2.5 text-sm font-medium transition-colors">
            Sign In
          </Link>
          <button className="flex-1 bg-white text-gray-900 shadow-sm rounded-lg py-2.5 text-sm font-semibold">
            Register
          </button>
        </div>

        {/* The Form */}
        <form onSubmit={handleRegister} className="space-y-4">
          
          {/* NEW: Username Field (Added this!) */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Username</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              placeholder="Pick a username"
            />
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              placeholder="John Doe"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              placeholder="Enter your email"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              placeholder="Create a password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all text-sm"
              placeholder="Confirm your password"
            />
          </div>

          {/* Create Account Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full font-bold py-3.5 rounded-xl transition-all text-white shadow-blue-500/30 shadow-lg active:scale-[0.98] mt-4 
            ${isLoading ? 'bg-blue-400 cursor-not-allowed opacity-70' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

        </form>

      </div>

      <p className="mt-8 text-center text-xs text-gray-400">
        © 2024 Planora. All rights reserved.
      </p>

    </div>
  );
}