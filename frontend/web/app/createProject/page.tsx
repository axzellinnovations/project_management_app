'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';

export default function InviteMembersPage() {
  const searchParams = useSearchParams();

  const [email, setEmail] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // projectId source priority:
  // 1) URL: /createProject/inviteMembers?projectId=123
  // 2) localStorage: currentProjectId
  useEffect(() => {
    const fromUrl = searchParams.get('projectId');
    if (fromUrl) {
      setProjectId(fromUrl);
      if (typeof window !== 'undefined') localStorage.setItem('currentProjectId', fromUrl);
      return;
    }
    if (typeof window !== 'undefined') {
      const fromLs = localStorage.getItem('currentProjectId');
      if (fromLs) setProjectId(fromLs);
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
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
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
    <div className="min-h-screen bg-gradient-to-br from-[#EFF6FF] via-[#FFFFFF] to-[#FAF5FF] flex flex-col items-center py-20 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 bg-[#1D56D5] rounded-[14px] flex items-center justify-center mx-auto mb-6 relative">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <line x1="20" y1="8" x2="20" y2="14" />
            <line x1="23" y1="11" x2="17" y2="11" />
          </svg>
        </div>
        <h1 className="font-outfit font-bold text-[36px] leading-[40px] text-[#101828] mb-3">
          Invite Your Team
        </h1>
        <p className="font-inter text-[18px] leading-[28px] text-[#4A5565] max-w-[482px] mx-auto">
          Collaborate better by inviting team members to your project
        </p>
        {projectId && (
          <p className="mt-2 font-inter text-[13px] text-[#6A7282]">
            Project ID: <span className="font-medium text-[#101828]">{projectId}</span>
          </p>
        )}
      </div>

      {/* Main Content Container */}
      <div className="w-full max-w-[768px] bg-white rounded-[16px] shadow-[0px_20px_25px_-5px_rgba(0,0,0,0.1),0px_8px_10px_-6px_rgba(0,0,0,0.1)] border border-[#E5E7EB] p-8">

        {/* Status message */}
        {msg && (
          <div
            className={`mb-5 rounded-[10px] p-4 border font-inter text-[14px] ${
              msg.type === 'success'
                ? 'bg-[#ECFDF3] border-[#ABEFC6] text-[#067647]'
                : 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Email Invite Section */}
        <div className="flex gap-3 mb-6">
          <div className="flex-grow relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6A7282" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              className="w-full h-[50px] border border-[#D1D5DC] rounded-[10px] pl-10 pr-4 font-inter text-[16px] text-[#0A0A0A] placeholder:text-[#6A7282] focus:outline-none focus:ring-2 focus:ring-[#1D56D5]/20 focus:border-[#1D56D5]"
            />
          </div>

          <button
            type="button"
            onClick={handleInvite}
            disabled={!canInvite || loading}
            className={`h-[50px] rounded-[10px] px-6 text-white font-inter font-medium text-[16px] transition-colors ${
              !canInvite || loading ? 'bg-[#1D56D5]/60 cursor-not-allowed' : 'bg-[#1D56D5] hover:bg-blue-700'
            }`}
          >
            {loading ? 'Sending...' : 'Invite'}
          </button>
        </div>

        {/* Role Permissions Section (info only) */}
        <div className="bg-[#F9FAFB] rounded-[10px] p-4 mb-6">
          <h3 className="font-inter font-medium text-[14px] text-[#101828] mb-3">Role Permissions</h3>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2 text-[14px]">
              <span className="font-inter font-medium text-[#101828] w-16">Admin:</span>
              <span className="font-inter text-[#4A5565]">Full access to project settings and team management</span>
            </div>
            <div className="flex gap-2 text-[14px]">
              <span className="font-inter font-medium text-[#101828] w-16">Member:</span>
              <span className="font-inter text-[#4A5565]">Can create, edit, and manage tasks and sprints</span>
            </div>
            <div className="flex gap-2 text-[14px]">
              <span className="font-inter font-medium text-[#101828] w-16">Viewer:</span>
              <span className="font-inter text-[#4A5565]">Read-only access to view project progress</span>
            </div>
          </div>

          <p className="mt-3 font-inter text-[12px] text-[#6A7282]">
            Default role for invited members: <span className="font-medium text-[#101828]">Member</span>
          </p>
        </div>

        {/* Footer Info */}
        <div className="bg-[#EFF6FF] border border-[#DBEAFE] rounded-[10px] p-4 mb-6 flex items-start gap-4">
          <div className="w-10 h-10 bg-[#1D56D5] rounded-[10px] flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h4 className="font-inter font-medium text-[16px] text-[#101828] mb-1">
              You can always invite team members later
            </h4>
            <p className="font-inter text-[14px] text-[#4A5565]">
              Skip this step and add team members from your project settings if you prefer.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Link href="/createProject/ifAgile" className="flex-1 h-[50px] border border-[#D1D5DC] rounded-[10px] flex items-center justify-center font-inter font-medium text-[16px] text-[#364153] hover:bg-gray-50 transition-colors">
            Back
          </Link>
          <Link href="/summary" className="flex-1 h-[50px] bg-[#1D56D5] rounded-[10px] flex items-center justify-center font-inter font-medium text-[16px] text-white hover:bg-blue-700 transition-colors">
            Skip & Start Project
          </Link>
        </div>

      </div>

      <div className="mt-8 text-center text-[#4A5565] font-inter text-[14px]">
        © 2025 Planora. All rights reserved.
      </div>
    </div>
  );
}