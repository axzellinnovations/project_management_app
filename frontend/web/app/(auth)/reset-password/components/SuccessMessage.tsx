'use client';

import Link from 'next/link';

export default function SuccessMessage() {
  return (
    <div className="text-center py-8">
      <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Password reset successfully!</h2>
      <p className="text-gray-500 text-sm mb-6">
        Your password has been updated. You can now log in with your new password.
      </p>
      <Link href="/login" className='w-full block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-center'>
        Go to login
      </Link>
    </div>
  );
}
