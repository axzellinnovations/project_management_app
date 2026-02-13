'use client';

import { useState } from 'react';   
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate network delay

        {/* show data */}
        console.log("Logging in");
        setIsLoading(false);
    }

    return(
        
        <div className='min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] p-4'>

            {/* 1. Back to Home Link */}
            <Link href={"/"} className='mb-8 flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors'>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Back to home
            </Link>

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
            <div className='w-full max-w-[420px] bg-white rounded-[24px] shadow-sm p-8'>
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
            </div>
       </div>

    // <div className='bg-white p-8 rounded-2xl shadow-xl w-full max-w-md'>
    //     <h1 className='text-2xl font-bold text-center mb-6'>Sign In</h1>

    //     <form className='space-y-4' onSubmit={handleLogin}>
    //         {/* email input */}
    //         <div>
    //             <label className='block text-sm font-medium text-gray-700 mb-1'>
    //                  Email Address
    //             </label>
    //             <input
    //                 type='email'
    //                 value={email}
    //                 onChange={(e)=> setEmail(e.target.value)}
    //                 className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none'
    //                 placeholder='abcd@email.com'
    //                 />
    //         </div>

    //         {/* password input */}
    //         <div>
    //             <label className='block text-sm font-medium text-gray-700 mb-1'>
    //                  Password
    //             </label>
    //             <input
    //                 type='password'
    //                 value={password}
    //                 onChange={(e) => setPassword(e.target.value)}
    //                 className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none'
    //                 placeholder='••••••••'
    //                 />
    //         </div>

    //         <button
    //             type='submit'
    //             disabled={isLoading}
    //             className={`w-full font-bold py-2 rounded-lg transition-colors text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
    //             Sign In
    //         </button>
    //     </form>        
    // </div>
    );
}