'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';

function AcceptInviteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const fromUrl = searchParams.get('token');
        if (fromUrl) {
            setToken(fromUrl);
        } else {
            setMsg({ type: 'error', text: 'Invalid or missing invitation link.' });
        }
    }, [searchParams]);

    const handleAccept = async () => {
        setMsg(null);
        if (!token) return;

        // Ensure user is logged in
        if (typeof window !== 'undefined') {
            const authToken = localStorage.getItem('token');
            if (!authToken) {
                // Save token so they can accept after login
                localStorage.setItem('pendingInviteToken', token);
                // Redirect to login (assuming /login exists for user, adapt if it's / register)
                router.push('/login?message=Please log in to accept your invitation');
                return;
            }
        }

        try {
            setLoading(true);
            await api.post('/api/projects/invitations/accept', { token });
            setMsg({ type: 'success', text: 'Invitation accepted! You are now a member of the project team.' });

            // Redirect to dashboard after brief delay
            setTimeout(() => {
                router.push('/dashboard');
            }, 2000);

        } catch (err: any) {
            const serverMsg =
                err?.response?.data?.message ||
                err?.response?.data ||
                'Failed to accept invitation. It may have expired or you may already be a member.';
            setMsg({ type: 'error', text: String(serverMsg) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full max-w-[500px] bg-white rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] border border-[#E5E7EB] p-8 text-center">
            <div className="w-16 h-16 bg-[#EFF6FF] text-[#1D56D5] rounded-full flex items-center justify-center mx-auto mb-6">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
            </div>
            <h1 className="font-outfit font-bold text-[28px] text-[#101828] mb-2">
                Project Invitation
            </h1>
            <p className="font-inter text-[16px] text-[#4A5565] mb-8">
                You've been invited to join a project on Planora. Click below to accept and access your new workspace.
            </p>

            {msg && (
                <div
                    className={`mb-6 rounded-[10px] p-4 border font-inter text-[14px] text-left ${msg.type === 'success'
                            ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]'
                            : 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                        }`}
                >
                    {msg.text}
                </div>
            )}

            <button
                onClick={handleAccept}
                disabled={!token || loading || msg?.type === 'success'}
                className={`w-full h-[50px] rounded-[10px] font-inter font-medium text-[16px] text-white transition-colors ${!token || loading || msg?.type === 'success' ? 'bg-[#1D56D5]/60 cursor-not-allowed' : 'bg-[#1D56D5] hover:bg-blue-700'
                    }`}
            >
                {loading ? 'Processing...' : msg?.type === 'success' ? 'Redirecting...' : 'Accept Invitation'}
            </button>
        </div>
    );
}

export default function AcceptInvitePage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#FFFFFF] to-[#FAF5FF] flex flex-col items-center justify-center p-4">
            <Suspense fallback={
                <div className="text-center font-inter text-[#4A5565]">
                    Loading invitation details...
                </div>
            }>
                <AcceptInviteContent />
            </Suspense>
        </div>
    );
}
