'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, CircleDot, ExternalLink, Loader2, X } from 'lucide-react';
import {
  fetchRepositoriesWithToken,
  getGitHubToken,
  getProjectGitHubRepo,
} from '@/services/githubService';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CreatedIssueDTO {
  issueNumber: number;
  title: string;
  htmlUrl: string;
  state: string;
}

interface RepoOption {
  value: string;
  label: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8080';

// ── Component ─────────────────────────────────────────────────────────────────

export interface CreateIssueModalProps {
  open: boolean;
  onClose: () => void;
  taskId: number;
  projectId?: number;
  /** Optionally pre-fill the issue title from the task title */
  defaultTitle?: string;
}

const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  open,
  onClose,
  taskId,
  projectId,
  defaultTitle = '',
}) => {
  const titleRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [repoFullName, setRepoFullName] = useState('');
  const [title, setTitle]               = useState('');
  const [body, setBody]                 = useState('');

  // Repository picker
  const [repoOptions, setRepoOptions]       = useState<RepoOption[]>([]);
  const [repoInputMode, setRepoInputMode]   = useState<'select' | 'text'>('select');
  const [loadingRepos, setLoadingRepos]     = useState(false);

  // Submission
  const [fieldErrors, setFieldErrors] = useState<{ repoFullName?: string; title?: string }>({});
  const [submitting, setSubmitting]   = useState(false);
  const [apiError, setApiError]       = useState<string | null>(null);
  const [success, setSuccess]         = useState<{ issueNumber: number; htmlUrl: string } | null>(null);

  // ── Load repos and reset form whenever the modal opens ────────────────────

  useEffect(() => {
    if (!open) return;

    setTitle(defaultTitle);
    setBody('');
    setFieldErrors({});
    setApiError(null);
    setSuccess(null);

    const connected  = projectId != null ? getProjectGitHubRepo(projectId) : null;
    const token      = getGitHubToken();
    const connRepo   = connected?.repoFullName ?? '';

    setRepoFullName(connRepo);

    const connOption: RepoOption[] = connected
      ? [{ value: connected.repoFullName, label: `${connected.repoFullName} (connected)` }]
      : [];

    // No token AND no connected repo → free-text input
    if (!token && connOption.length === 0) {
      setRepoInputMode('text');
      setRepoOptions([]);
      setLoadingRepos(false);
      return;
    }

    // No token but has connected repo → single-option select
    if (!token) {
      setRepoOptions(connOption);
      setRepoInputMode('select');
      setLoadingRepos(false);
      return;
    }

    // Has token → fetch the user's repos from GitHub
    let cancelled = false;
    setLoadingRepos(true);

    fetchRepositoriesWithToken(token)
      .then(ghRepos => {
        if (cancelled) return;
        const seen  = new Set(connOption.map(o => o.value));
        const extra = ghRepos
          .filter(r => !seen.has(r.full_name))
          .map(r => ({ value: r.full_name, label: r.full_name }));
        const all = [...connOption, ...extra];
        setRepoOptions(all);
        setRepoInputMode('select');
        if (!connRepo && all[0]) setRepoFullName(all[0].value);
      })
      .catch(() => {
        if (cancelled) return;
        // Graceful fallback: use connected repo if present, otherwise text input
        if (connOption.length > 0) {
          setRepoOptions(connOption);
          setRepoInputMode('select');
        } else {
          setRepoInputMode('text');
          setRepoOptions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRepos(false);
      });

    return () => { cancelled = true; };
  }, [open, projectId, defaultTitle]);

  // Auto-focus title field once repos have finished loading
  useEffect(() => {
    if (!open || loadingRepos || success) return;
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open, loadingRepos, success]);

  // ── Validation ────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const next: { repoFullName?: string; title?: string } = {};
    const repo = repoFullName.trim();
    if (!repo) {
      next.repoFullName = 'Repository is required';
    } else if (repoInputMode === 'text' && !repo.includes('/')) {
      next.repoFullName = 'Use the format owner/repository';
    }
    if (!title.trim()) next.title = 'Title is required';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setApiError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/github-issue`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoFullName: repoFullName.trim(),
          title: title.trim(),
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message ?? `Failed to create issue (${res.status})`);
      }

      const created = await res.json() as CreatedIssueDTO;
      setSuccess({ issueNumber: created.issueNumber, htmlUrl: created.htmlUrl });
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Failed to create issue');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const resetForAnother = () => {
    setSuccess(null);
    setTitle('');
    setBody('');
    setFieldErrors({});
    setApiError(null);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create GitHub Issue"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="relative bg-[#24292F] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
              <CircleDot size={22} className="text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-white">Create GitHub Issue</h2>
              <p className="text-[11px] font-medium uppercase tracking-wider text-white/50">
                GitHub Integration
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close modal"
            className="absolute right-4 top-4 rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* ── Success state ────────────────────────────────────────────────── */}
        {success ? (
          <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
              <Check size={30} className="text-green-500" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1F2937]">Issue Created!</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                Issue{' '}
                <span className="font-mono font-semibold">#{success.issueNumber}</span>
                {' '}has been created successfully.
              </p>
            </div>
            <a
              href={success.htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm font-semibold text-[#155DFC] hover:underline"
            >
              <ExternalLink size={14} aria-hidden="true" />
              View on GitHub
            </a>
            <div className="mt-2 flex w-full gap-3">
              <button
                type="button"
                onClick={resetForAnother}
                className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-bold text-[#374151] transition-colors hover:bg-[#F9FAFB] active:scale-[0.98]"
              >
                Create Another
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-xl bg-[#24292F] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#374151] active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (

          /* ── Form ────────────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} noValidate className="space-y-5 p-6">

            {/* API error banner */}
            {apiError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                <AlertCircle size={15} className="flex-shrink-0" aria-hidden="true" />
                <span>{apiError}</span>
              </div>
            )}

            {/* ── Repository ─────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A7282]">
                Repository{' '}
                <span className="text-red-500" aria-hidden="true">*</span>
              </label>

              {loadingRepos ? (
                <div className="flex h-11 items-center gap-2 rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-4">
                  <Loader2 size={14} className="animate-spin text-[#9CA3AF]" aria-hidden="true" />
                  <span className="text-sm text-[#9CA3AF]">Loading repositories…</span>
                </div>
              ) : repoInputMode === 'select' && repoOptions.length > 0 ? (
                <select
                  value={repoFullName}
                  onChange={e => {
                    setRepoFullName(e.target.value);
                    setFieldErrors(prev => ({ ...prev, repoFullName: undefined }));
                  }}
                  disabled={submitting}
                  className={[
                    'h-11 w-full rounded-xl border bg-[#F9FAFB] px-4 text-sm text-[#374151]',
                    'focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all disabled:opacity-60',
                    fieldErrors.repoFullName ? 'border-red-300' : 'border-[#EAECF0]',
                  ].join(' ')}
                >
                  {repoOptions.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={repoFullName}
                  onChange={e => {
                    setRepoFullName(e.target.value);
                    setFieldErrors(prev => ({ ...prev, repoFullName: undefined }));
                  }}
                  placeholder="owner/repository"
                  spellCheck={false}
                  disabled={submitting}
                  className={[
                    'h-11 w-full rounded-xl border bg-[#F9FAFB] px-4 font-mono text-sm text-[#374151]',
                    'placeholder:text-[#C4C9D4] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all disabled:opacity-60',
                    fieldErrors.repoFullName ? 'border-red-300' : 'border-[#EAECF0]',
                  ].join(' ')}
                />
              )}

              {fieldErrors.repoFullName && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle size={10} aria-hidden="true" />
                  {fieldErrors.repoFullName}
                </p>
              )}
            </div>

            {/* ── Title ──────────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A7282]">
                Title{' '}
                <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={e => {
                  setTitle(e.target.value);
                  setFieldErrors(prev => ({ ...prev, title: undefined }));
                }}
                placeholder="Concise, descriptive issue title"
                disabled={submitting}
                className={[
                  'h-11 w-full rounded-xl border bg-[#F9FAFB] px-4 text-sm text-[#374151]',
                  'placeholder:text-[#C4C9D4] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all disabled:opacity-60',
                  fieldErrors.title ? 'border-red-300' : 'border-[#EAECF0]',
                ].join(' ')}
              />
              {fieldErrors.title && (
                <p className="flex items-center gap-1 text-xs text-red-600">
                  <AlertCircle size={10} aria-hidden="true" />
                  {fieldErrors.title}
                </p>
              )}
            </div>

            {/* ── Description ────────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6A7282]">
                Description{' '}
                <span className="font-medium normal-case tracking-normal text-[#C4C9D4]">
                  (optional)
                </span>
              </label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Describe the issue, steps to reproduce, expected behavior…"
                rows={4}
                disabled={submitting}
                className="w-full resize-none rounded-xl border border-[#EAECF0] bg-[#F9FAFB] px-4 py-3 text-sm text-[#374151] placeholder:text-[#C4C9D4] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 transition-all disabled:opacity-60"
              />
            </div>

            {/* ── Actions ────────────────────────────────────────────────── */}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-[#E5E7EB] py-2.5 text-sm font-bold text-[#374151] transition-all hover:bg-[#F9FAFB] disabled:opacity-50 active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || loadingRepos}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#24292F] py-2.5 text-sm font-bold text-white transition-all hover:bg-[#374151] disabled:opacity-50 active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    Creating…
                  </>
                ) : (
                  'Create Issue'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateIssueModal;
