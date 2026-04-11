'use client';

import { useEffect } from 'react';

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Inbox route error:', error);
  }, [error]);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="bg-white border border-red-200 rounded-2xl p-6 text-center">
        <h2 className="text-[16px] font-bold text-red-700">Unable to load inbox</h2>
        <p className="text-[13px] text-red-600 mt-1">Something went wrong while loading chat activity.</p>
        <button
          onClick={reset}
          className="mt-4 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-[12px] font-semibold hover:bg-red-100"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
