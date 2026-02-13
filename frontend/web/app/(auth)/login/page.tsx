'use client';

import { useState } from 'react';   

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

    <div className='bg-white p-8 rounded-2xl shadow-xl w-full max-w-md'>
        <h1 className='text-2xl font-bold text-center mb-6'>Sign In</h1>

        <form className='space-y-4' onSubmit={handleLogin}>
            {/* email input */}
            <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                     Email Address
                </label>
                <input
                    type='email'
                    value={email}
                    onChange={(e)=> setEmail(e.target.value)}
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    placeholder='abcd@email.com'
                    />
            </div>

            {/* password input */}
            <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                     Password
                </label>
                <input
                    type='password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none'
                    placeholder='••••••••'
                    />
            </div>

            <button
                type='submit'
                disabled={isLoading}
                className={`w-full font-bold py-2 rounded-lg transition-colors text-white ${isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                Sign In
            </button>

        </form>        
    </div>
    );
}