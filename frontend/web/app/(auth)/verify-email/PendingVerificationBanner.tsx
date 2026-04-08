'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * FEATURE-5: Dismissible banner shown on the verification page when the user
 * has a pending verification email stored in localStorage (set at register time).
 * Checks both the URL ?email= param and localStorage for the pending email.
 */
export default function PendingVerificationBanner() {
    const searchParams = useSearchParams();
    const [dismissed, setDismissed] = useState(false);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);

    useEffect(() => {
        const emailFromUrl = searchParams.get('email');
        const emailFromStorage = localStorage.getItem('pendingVerificationEmail');

        const email = emailFromUrl || emailFromStorage;
        if (email) {
            setPendingEmail(email);
            // Persist so returning users still see the banner
            localStorage.setItem('pendingVerificationEmail', email);
        }
    }, [searchParams]);

    if (dismissed || !pendingEmail) return null;

    return (
        <div
            role="alert"
            aria-live="polite"
            className="w-full max-w-[480px] mb-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
            </svg>
            <span className="flex-1">
                <strong>Email verification pending</strong> for{' '}
                <span className="font-semibold">{pendingEmail}</span>. Enter the
                6-digit code below to activate your account.
            </span>
            <button
                onClick={() => {
                    setDismissed(true);
                    localStorage.removeItem('pendingVerificationEmail');
                }}
                aria-label="Dismiss verification reminder"
                className="ml-2 text-amber-600 hover:text-amber-900 transition-colors"
            >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
}
