'use client';

import { useEffect } from 'react';

export default function MembersError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Members route error:', error);
  }, [error]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="bg-white border border-red-200 rounded-2xl p-6 text-center">
        <h2 className="text-[18px] font-bold text-red-700">Unable to load members</h2>
        <p className="text-[13px] text-red-600 mt-1">An error occurred while loading this team page.</p>
        <button
          onClick={reset}
          className="mt-4 px-4 py-2 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
