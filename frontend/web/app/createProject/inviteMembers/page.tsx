'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';

export default function InviteMembersPage() {
    const searchParams = useSearchParams();

    const [email, setEmail] = useState('');
    const [projectId, setProjectId] = useState<string | null>(null);
    const [projectKey, setProjectKey] = useState<string | null>(null);

    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Get projectId and projectKey from URL or localStorage
    useEffect(() => {
        const fromUrlId = searchParams.get('projectId');
        const fromUrlKey = searchParams.get('projectKey');

        if (fromUrlId) {
            setProjectId(fromUrlId);
            if (typeof window !== 'undefined') localStorage.setItem('currentProjectId', fromUrlId);
        }
        if (fromUrlKey) {
            setProjectKey(fromUrlKey);
            if (typeof window !== 'undefined') localStorage.setItem('currentProjectKey', fromUrlKey);
        }

        if (!fromUrlId && typeof window !== 'undefined') {
            const lsId = localStorage.getItem('currentProjectId');
            if (lsId) setProjectId(lsId);
        }
        if (!fromUrlKey && typeof window !== 'undefined') {
            const lsKey = localStorage.getItem('currentProjectKey');
            if (lsKey) setProjectKey(lsKey);
        }
    }, [searchParams]);

    const canInvite = useMemo(() => {
        return Boolean(projectId && email.trim());
    }, [projectId, email]);

    const handleInvite = async () => {
        setMsg(null);

        const trimmed = email.trim().toLowerCase();
        if (!projectId) {
            setMsg({ type: 'error', text: 'Project ID not found. Please open this page with ?projectId=... in URL.' });
            return;
        }
        if (!trimmed) {
            setMsg({ type: 'error', text: 'Please enter an email address.' });
            return;
        }
        // basic email check
        if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(trimmed)) {
            setMsg({ type: 'error', text: 'Please enter a valid email address.' });
            return;
        }

        try {
            setLoading(true);
            await api.post(`/api/projects/${projectId}/invitations`, {
                email: trimmed,
            });

            setMsg({ type: 'success', text: 'Invitation email sent successfully.' });
            setEmail('');
        } catch (err: any) {
            const serverMsg =
                err?.response?.data?.message ||
                err?.response?.data ||
                'Failed to send invitation. Please try again.';
            setMsg({ type: 'error', text: String(serverMsg) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen relative flex flex-col items-center justify-center py-10 px-4 overflow-hidden bg-[#F5F5F7] selection:bg-[#1D56D5] selection:text-white">
            {/* Ambient Background Orbs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#3B82F6]/30 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#8B5CF6]/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-[#10B981]/20 rounded-full blur-[100px] pointer-events-none" />

            {/* Header */}
            <div className="relative z-10 w-full max-w-[800px] text-center mb-4">
                <h1 className="font-outfit font-bold text-[28px] leading-[36px] text-[#1D1D1F] mb-1 tracking-tight">
                    Invite Your Team
                </h1>
                <p className="font-inter text-[16px] leading-[24px] text-[#86868B] max-w-[482px] mx-auto">
                    Collaborate better by inviting team members to your project
                </p>
                {projectKey && (
                    <p className="mt-4 font-inter text-[13px] text-[#1D1D1F] inline-block px-4 py-1.5 bg-white/70 backdrop-blur-md border border-white/50 rounded-full shadow-sm">
                        Project Key: <span className="font-semibold text-[#1D56D5] uppercase tracking-wide">{projectKey}</span>
                    </p>
                )}
            </div>

            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-[800px] bg-white/60 backdrop-blur-2xl rounded-[24px] shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/50 p-6 md:p-8">

                {/* Status message */}
                {msg && (
                    <div
                        className={`mb-6 rounded-[14px] p-4 border font-inter text-[14px] backdrop-blur-sm ${msg.type === 'success'
                            ? 'bg-[#ECFDF3]/80 border-[#ABEFC6] text-[#067647]'
                            : 'bg-[#FEF3F2]/80 border-[#FECDCA] text-[#B42318]'
                            }`}
                    >
                        {msg.text}
                    </div>
                )}

                {/* Email Invite Section */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="flex-grow relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86868B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email address"
                            className="w-full h-[44px] bg-white/50 border border-white/60 hover:border-[#D1D5DC] rounded-[14px] pl-12 pr-4 font-inter text-[15px] text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-all focus:bg-white focus:ring-4 focus:ring-[#1D56D5]/10 focus:border-[#1D56D5]"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={handleInvite}
                        disabled={!canInvite || loading}
                        className={`h-[44px] rounded-[14px] px-8 text-white font-inter font-medium text-[15px] shadow-sm transition-all sm:w-auto w-full ${!canInvite || loading ? 'bg-[#1D56D5]/60 cursor-not-allowed shadow-none' : 'bg-[#1D56D5] hover:bg-[#1642B5] hover:shadow-md'
                            }`}
                    >
                        {loading ? 'Sending...' : 'Send Invite'}
                    </button>
                </div>

                {/* Role Permissions Section (info only) */}
                <div className="bg-white/40 border border-white/40 rounded-[16px] p-4 mb-6 shadow-sm backdrop-blur-md">
                    <h3 className="font-inter font-semibold text-[15px] text-[#1D1D1F] mb-4">Role Permissions</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3 text-[14px]">
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#1D56D5]"></div>
                            <div>
                                <span className="font-outfit font-medium text-[#1D1D1F]">Admin: </span>
                                <span className="font-inter text-[#86868B]">Full access to project settings and team management</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-[14px]">
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#34C759]"></div>
                            <div>
                                <span className="font-outfit font-medium text-[#1D1D1F]">Member: </span>
                                <span className="font-inter text-[#86868B]">Can create, edit, and manage tasks and sprints</span>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-[14px]">
                            <div className="mt-0.5 w-1.5 h-1.5 rounded-full bg-[#FF9500]"></div>
                            <div>
                                <span className="font-outfit font-medium text-[#1D1D1F]">Viewer: </span>
                                <span className="font-inter text-[#86868B]">Read-only access to view project progress</span>
                            </div>
                        </div>
                    </div>

                    <p className="mt-5 pt-4 border-t border-white/40 font-inter text-[13px] text-[#86868B]">
                        Default role for invited members: <span className="font-medium text-[#1D1D1F]">Member</span>
                    </p>
                </div>

                {/* Footer Info */}
                <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-blue-100/50 rounded-[16px] p-4 mb-6 flex items-start gap-4 backdrop-blur-sm">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#1D56D5] to-[#4F46E5] rounded-[10px] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <div>
                        <h4 className="font-inter font-medium text-[15px] text-[#1D1D1F] mb-1">
                            You can always invite team members later
                        </h4>
                        <p className="font-inter text-[14px] text-[#86868B]">
                            Skip this step and add team members from your project settings if you prefer.
                        </p>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <Link href="/createProject" className="w-[120px] h-[44px] bg-white/50 border border-white/60 rounded-[14px] flex items-center justify-center font-inter font-medium text-[15px] text-[#1D1D1F] hover:bg-white hover:shadow-sm transition-all md:w-auto md:flex-1">
                        Back
                    </Link>
                    <Link href="/summary" className="flex-1 h-[44px] bg-[#1D56D5] rounded-[14px] flex items-center justify-center font-inter font-medium text-[15px] text-white shadow-md hover:bg-[#1642B5] hover:shadow-lg transition-all">
                        Start Project
                    </Link>
                </div>

            </div>

            <div className="mt-4 relative z-10 text-center text-[#86868B] font-inter text-[13px]">
                © 2025 Planora. All rights reserved.
            </div>
        </div>
    );
}
