'use client';

import { AlertTriangle } from 'lucide-react';

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="h-full min-h-0 w-full flex items-center justify-center bg-[#F7F8FA] px-4">
      <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-sm text-center">
        <div className="mx-auto mb-3 w-11 h-11 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
          <AlertTriangle size={20} />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Chat failed to load</h2>
        <p className="mt-1 text-sm text-gray-500">{error.message || 'An unexpected error occurred in chat.'}</p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-cu-primary px-4 py-2 text-sm font-semibold text-white hover:bg-cu-primary-dark transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
