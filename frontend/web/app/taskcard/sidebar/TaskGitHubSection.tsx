'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { getGitHubToken, getProjectGitHubRepo } from '@/services/githubService';
import SidebarField from './SidebarField';

// ── Backend DTO shapes ────────────────────────────────────────────────────────

type CiStatus = 'PASSING' | 'FAILED' | 'RUNNING' | null;
type PrState  = 'open' | 'closed' | 'merged' | string;
type ReviewStatus =
  | 'APPROVED'
  | 'CHANGES_REQUESTED'
  | 'COMMENTED'
  | 'REVIEW_REQUIRED'
  | null;

interface LinkedPrResponseDTO {
  id: number;
  prNumber: number;
  title: string;
  state: PrState;
  ciStatus: CiStatus;
  reviewStatus: ReviewStatus;
  headBranch: string;
  baseBranch: string;
  htmlUrl: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
}

interface LinkedCommitResponseDTO {
  id: number;
  sha: string;
  fullSha: string;
  message: string;
  author: string;
  committedAt: string;
  htmlUrl: string;
  ciStatus: CiStatus;
  referencedTaskNumbers: number[];
}

interface TaskGithubSummaryDTO {
  taskId: number;
  githubBranch: string | null;
  latestCiStatus: CiStatus;
  openPrCount: number;
  latestCommitSha: string | null;
  latestCommitMessage: string | null;
  latestCommitAt: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8080';

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days  = Math.floor(hours / 24);
  if (days  < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function validateBranchName(name: string): string | null {
  const t = name.trim();
  if (!t) return 'Branch name cannot be empty';
  if (t.length > 255) return 'Branch name is too long (max 255 characters)';
  if (/\s/.test(t)) return 'Branch name cannot contain spaces';
  if (t.startsWith('.') || t.startsWith('-')) return 'Branch name cannot start with "." or "-"';
  if (t.endsWith('.lock')) return 'Branch name cannot end with ".lock"';
  if (t.includes('..')) return 'Branch name cannot contain ".."';
  if (!/^[a-zA-Z0-9._/\-]+$/.test(t)) return 'Only letters, numbers, ., _, -, / are allowed';
  return null;
}

interface PrStateMeta {
  label: string;
  badgeCls: string;
  icon: React.ReactNode;
}

function prStateMeta(state: PrState, mergedAt: string | null): PrStateMeta {
  if (mergedAt || state === 'merged')
    return {
      label: 'Merged',
      badgeCls: 'text-purple-700 bg-purple-50 border-purple-200',
      icon: <GitMerge size={11} className="mt-0.5 flex-shrink-0 text-purple-500" />,
    };
  if (state === 'closed')
    return {
      label: 'Closed',
      badgeCls: 'text-red-700 bg-red-50 border-red-200',
      icon: <XCircle size={11} className="mt-0.5 flex-shrink-0 text-red-500" />,
    };
  return {
    label: 'Open',
    badgeCls: 'text-green-700 bg-green-50 border-green-200',
    icon: <GitPullRequest size={11} className="mt-0.5 flex-shrink-0 text-green-500" />,
  };
}

interface BadgeProps { label: string; cls: string; pulse?: boolean }

function ciBadgeProps(status: CiStatus): BadgeProps | null {
  switch (status) {
    case 'PASSING': return { label: 'Passing', cls: 'text-green-700 bg-green-50 border-green-200',   pulse: false };
    case 'FAILED':  return { label: 'Failed',  cls: 'text-red-700 bg-red-50 border-red-200',         pulse: false };
    case 'RUNNING': return { label: 'Running', cls: 'text-amber-700 bg-amber-50 border-amber-200',   pulse: true };
    default:        return null;
  }
}

function reviewBadgeProps(status: ReviewStatus): BadgeProps | null {
  switch (status) {
    case 'APPROVED':          return { label: 'Approved',          cls: 'text-green-700 bg-green-50 border-green-200' };
    case 'CHANGES_REQUESTED': return { label: 'Changes Requested', cls: 'text-red-700 bg-red-50 border-red-200' };
    case 'COMMENTED':         return { label: 'Commented',         cls: 'text-blue-700 bg-blue-50 border-blue-200' };
    case 'REVIEW_REQUIRED':   return { label: 'Review Required',   cls: 'text-gray-600 bg-gray-50 border-gray-200' };
    default:                  return null;
  }
}

// ── Micro-components ──────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`animate-pulse rounded-lg bg-[#F2F4F7] ${className ?? ''}`} />
);

const Badge: React.FC<BadgeProps> = ({ label, cls, pulse = false }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
    {pulse && (
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
      </span>
    )}
    {label}
  </span>
);

const CiStatusIcon: React.FC<{ status: CiStatus; size?: number; className?: string }> = ({
  status, size = 12, className = '',
}) => {
  if (status === 'PASSING') return <CheckCircle2 size={size} className={`text-green-500 ${className}`} />;
  if (status === 'FAILED')  return <XCircle      size={size} className={`text-red-500 ${className}`} />;
  if (status === 'RUNNING') return <Loader2      size={size} className={`animate-spin text-amber-500 ${className}`} />;
  return null;
};

interface CollapseSectionProps {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
}

const CollapseSection: React.FC<CollapseSectionProps> = ({
  title, icon, open, onToggle, count, children,
}) => (
  <div>
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-[#6A7282] transition-colors hover:bg-[#FAFAFA]"
    >
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
        {count != null && count > 0 && (
          <span className="rounded-full bg-[#EAECF0] px-1.5 py-0.5 text-[9px] font-bold leading-none text-[#4B5563]">
            {count}
          </span>
        )}
      </span>
      <ChevronDown
        size={13}
        className={`text-[#9CA3AF] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
      />
    </button>
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="body"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeInOut' }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => (
  <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-[#E5E7EB] px-3 py-3">
    <span className="mt-0.5 text-[#D1D5DB]">{icon}</span>
    <div>
      <p className="text-[11px] font-medium text-[#9CA3AF]">{title}</p>
      {description && (
        <p className="mt-0.5 text-[10px] leading-snug text-[#C4C9D4]">{description}</p>
      )}
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

interface TaskGitHubSectionProps {
  taskId: number;
  projectId?: number;
}

const TaskGitHubSection: React.FC<TaskGitHubSectionProps> = ({ taskId, projectId }) => {
  const [open, setOpen]               = useState(true);
  const [prsOpen, setPrsOpen]         = useState(true);
  const [commitsOpen, setCommitsOpen] = useState(true);

  const [summary, setSummary]   = useState<TaskGithubSummaryDTO | null>(null);
  const [prs, setPrs]           = useState<LinkedPrResponseDTO[]>([]);
  const [commits, setCommits]   = useState<LinkedCommitResponseDTO[]>([]);

  const [loadingSummary, setLoadingSummary]   = useState(true);
  const [loadingPrs, setLoadingPrs]           = useState(true);
  const [loadingCommits, setLoadingCommits]   = useState(true);
  const [syncing, setSyncing]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [copied, setCopied]                   = useState(false);

  const [branchEditing, setBranchEditing] = useState(false);
  const [branchInput, setBranchInput]     = useState('');
  const [branchError, setBranchError]     = useState<string | null>(null);
  const [savingBranch, setSavingBranch]   = useState(false);
  const [branchSaved, setBranchSaved]     = useState(false);

  // Restore per-task collapse prefs
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(`planora:task-github:${taskId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      if ('github'  in saved) setOpen(saved.github);
      if ('prs'     in saved) setPrsOpen(saved.prs);
      if ('commits' in saved) setCommitsOpen(saved.commits);
    } catch { /* ignore malformed */ }
  }, [taskId]);

  const persist = useCallback((key: string, value: boolean) => {
    if (typeof window === 'undefined') return;
    try {
      const raw  = window.localStorage.getItem(`planora:task-github:${taskId}`);
      const prev = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
      window.localStorage.setItem(
        `planora:task-github:${taskId}`,
        JSON.stringify({ ...prev, [key]: value }),
      );
    } catch { /* ignore */ }
  }, [taskId]);

  const toggle = (key: 'github' | 'prs' | 'commits') => {
    if (key === 'github')  setOpen(v        => { persist('github',  !v); return !v; });
    if (key === 'prs')     setPrsOpen(v     => { persist('prs',     !v); return !v; });
    if (key === 'commits') setCommitsOpen(v => { persist('commits', !v); return !v; });
  };

  const fetchData = useCallback(async (withSync = false) => {
    const token   = getGitHubToken();
    const repo    = projectId != null ? getProjectGitHubRepo(projectId) : null;
    const canSync = withSync && !!token && !!repo;
    const syncQS  = canSync ? `?repoFullName=${encodeURIComponent(repo!.repoFullName)}` : '';
    const headers: HeadersInit = canSync && token ? { 'X-GitHub-Token': token } : {};

    setError(null);
    if (withSync) setSyncing(true);
    setLoadingSummary(true);
    setLoadingPrs(true);
    setLoadingCommits(true);

    try {
      const commitsUrl = syncQS
        ? `${API_BASE}/api/tasks/${taskId}/commits${syncQS}&limit=10`
        : `${API_BASE}/api/tasks/${taskId}/commits?limit=10`;

      const [summaryRes, prsRes, commitsRes] = await Promise.all([
        fetch(`${API_BASE}/api/tasks/${taskId}/github`,                  { credentials: 'include', headers }),
        fetch(`${API_BASE}/api/tasks/${taskId}/pull-requests${syncQS}`,  { credentials: 'include', headers }),
        fetch(commitsUrl,                                                  { credentials: 'include', headers }),
      ]);

      if (!summaryRes.ok) throw new Error('Failed to load GitHub data');
      setSummary(await summaryRes.json() as TaskGithubSummaryDTO);

      if (prsRes.ok)     { const p = await prsRes.json();     setPrs(Array.isArray(p) ? p : []); }
      if (commitsRes.ok) { const c = await commitsRes.json(); setCommits(Array.isArray(c) ? c : []); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load GitHub data');
    } finally {
      setLoadingSummary(false);
      setLoadingPrs(false);
      setLoadingCommits(false);
      if (withSync) setSyncing(false);
    }
  }, [taskId, projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreateIssue = () => {
    const repo = projectId != null ? getProjectGitHubRepo(projectId) : null;
    if (!repo) return;
    window.open(`https://github.com/${repo.repoFullName}/issues/new`, '_blank', 'noopener,noreferrer');
  };

  const copyBranch = async () => {
    if (!summary?.githubBranch) return;
    try {
      await navigator.clipboard.writeText(summary.githubBranch);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  };

  const startBranchEdit = () => {
    setBranchInput(summary?.githubBranch ?? '');
    setBranchError(null);
    setBranchEditing(true);
  };

  const cancelBranchEdit = () => {
    setBranchEditing(false);
    setBranchError(null);
  };

  const handleBranchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter')  { e.preventDefault(); saveBranch(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelBranchEdit(); }
  };

  const saveBranch = async () => {
    const trimmed = branchInput.trim();
    const validationError = validateBranchName(trimmed);
    if (validationError) { setBranchError(validationError); return; }

    setBranchError(null);
    setSavingBranch(true);
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/github/branch`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null) as { message?: string } | null;
        throw new Error(data?.message ?? 'Failed to save branch name');
      }
      setSummary(prev => prev ? { ...prev, githubBranch: trimmed } : prev);
      setBranchEditing(false);
      setBranchSaved(true);
      setTimeout(() => setBranchSaved(false), 2500);
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : 'Failed to save branch name');
    } finally {
      setSavingBranch(false);
    }
  };

  const ciSummaryBadge = ciBadgeProps(summary?.latestCiStatus ?? null);
  const openPrCount    = prs.filter(p => !p.mergedAt && p.state === 'open').length;

  return (
    <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-sm">

      {/* ── Section header ──────────────────────────────────────────────────── */}
      <button
        onClick={() => toggle('github')}
        className="flex w-full items-center justify-between border-b border-[#F2F4F7] px-4 py-2.5 transition-colors hover:bg-[#FAFAFA]"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6A7282]">
          <GitBranch size={12} />
          GitHub
          {!loadingPrs && openPrCount > 0 && (
            <span className="rounded-full bg-[#155DFC] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">
              {openPrCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {!loadingSummary && ciSummaryBadge && (
            <Badge label={ciSummaryBadge.label} cls={ciSummaryBadge.cls} pulse={ciSummaryBadge.pulse} />
          )}
          <ChevronDown
            size={14}
            className={`text-[#9CA3AF] transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
          />
        </div>
      </button>

      {/* ── Collapsible body ────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="github-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >

            {/* Summary panel */}
            <div className="space-y-3.5 p-4">

              {/* Error banner */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  <AlertCircle size={13} className="flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Branch */}
              <SidebarField label="Branch">
                {loadingSummary ? (
                  <Skeleton className="h-8 w-full" />
                ) : branchEditing ? (
                  /* ── Edit / Create mode ─────────────────────────────────── */
                  <div className="space-y-1.5">
                    <div className={`flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 transition-colors ${
                      branchError
                        ? 'border-red-300 ring-1 ring-red-200'
                        : 'border-[#155DFC] ring-1 ring-[#155DFC]/20'
                    }`}>
                      <GitBranch size={12} className="flex-shrink-0 text-[#6A7282]" />
                      <input
                        type="text"
                        value={branchInput}
                        onChange={e => { setBranchInput(e.target.value); setBranchError(null); }}
                        onKeyDown={handleBranchKeyDown}
                        placeholder="e.g. feature/task-123"
                        autoFocus
                        spellCheck={false}
                        disabled={savingBranch}
                        className="min-w-0 flex-1 bg-transparent font-mono text-xs text-[#374151] outline-none placeholder:text-[#C4C9D4] disabled:opacity-60"
                      />
                      {savingBranch && (
                        <Loader2 size={11} className="flex-shrink-0 animate-spin text-[#9CA3AF]" />
                      )}
                    </div>

                    {branchError && (
                      <p className="flex items-center gap-1 text-[10px] text-red-600">
                        <AlertCircle size={9} className="flex-shrink-0" />
                        {branchError}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={saveBranch}
                        disabled={savingBranch || !branchInput.trim()}
                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#155DFC] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1248CC] disabled:opacity-50"
                      >
                        {savingBranch ? (
                          <><Loader2 size={10} className="animate-spin" /> Saving…</>
                        ) : summary?.githubBranch ? (
                          <><Check size={10} /> Update Branch</>
                        ) : (
                          <><GitBranch size={10} /> Set Branch</>
                        )}
                      </button>
                      <button
                        onClick={cancelBranchEdit}
                        disabled={savingBranch}
                        className="flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : summary?.githubBranch ? (
                  /* ── View mode (branch exists) ──────────────────────────── */
                  <div className="group flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-1.5 transition-colors hover:border-[#D1D5DB]">
                    <GitBranch size={12} className="flex-shrink-0 text-[#6A7282]" />
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-[#374151]">
                      {summary.githubBranch}
                    </span>
                    {branchSaved && (
                      <Check size={11} className="flex-shrink-0 text-green-500" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); startBranchEdit(); }}
                      title="Edit branch name"
                      className="flex-shrink-0 rounded p-0.5 text-[#C4C9D4] transition-colors hover:text-[#374151]"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); copyBranch(); }}
                      title={copied ? 'Copied!' : 'Copy branch name'}
                      className="flex-shrink-0 rounded p-0.5 text-[#C4C9D4] transition-colors hover:text-[#374151]"
                    >
                      {copied
                        ? <Check size={11} className="text-green-500" />
                        : <Copy size={11} />
                      }
                    </button>
                  </div>
                ) : (
                  /* ── Empty state (no branch) ────────────────────────────── */
                  <button
                    onClick={startBranchEdit}
                    className="flex w-full items-center gap-2 rounded-lg border border-dashed border-[#D0D5DD] bg-[#FAFAFA] px-3 py-2 text-[11px] font-medium text-[#9CA3AF] transition-colors hover:border-[#155DFC] hover:bg-blue-50/30 hover:text-[#155DFC]"
                  >
                    <GitBranch size={12} />
                    Set branch name…
                  </button>
                )}
              </SidebarField>

              {/* CI Status */}
              {!loadingSummary && summary?.latestCiStatus && (
                <SidebarField label="CI Status">
                  <div className="flex items-center gap-2">
                    <CiStatusIcon status={summary.latestCiStatus} size={14} />
                    <span className={`text-xs font-semibold ${
                      summary.latestCiStatus === 'PASSING' ? 'text-green-700' :
                      summary.latestCiStatus === 'FAILED'  ? 'text-red-700'   :
                                                             'text-amber-700'
                    }`}>
                      {summary.latestCiStatus === 'PASSING' ? 'Passing' :
                       summary.latestCiStatus === 'FAILED'  ? 'Failed'  : 'Running'}
                    </span>
                    {summary.latestCommitSha && (
                      <span className="ml-auto font-mono text-[10px] text-[#98A2B3]">
                        {summary.latestCommitSha}
                      </span>
                    )}
                  </div>
                </SidebarField>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => fetchData(true)}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB] disabled:opacity-50"
                >
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
                <button
                  onClick={handleCreateIssue}
                  className="flex items-center gap-1.5 rounded-lg border border-[#155DFC] bg-[#155DFC] px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#1248CC]"
                >
                  <Plus size={11} />
                  Create Issue
                </button>
              </div>
            </div>

            {/* ── Pull Requests ─────────────────────────────────────────────── */}
            <div className="border-t border-[#F2F4F7]">
              <CollapseSection
                title="Pull Requests"
                icon={<GitPullRequest size={11} />}
                open={prsOpen}
                onToggle={() => toggle('prs')}
                count={prs.length}
              >
                <div className="space-y-2 px-4 pb-4 pt-2">
                  {loadingPrs ? (
                    <>
                      <Skeleton className="h-[76px] w-full" />
                      <Skeleton className="h-[76px] w-full" />
                    </>
                  ) : prs.length === 0 ? (
                    <EmptyState
                      icon={<GitPullRequest size={14} />}
                      title="No pull requests linked"
                      description="PRs referencing this task will appear here"
                    />
                  ) : (
                    prs.map((pr) => {
                      const stateInfo = prStateMeta(pr.state, pr.mergedAt);
                      const ci        = ciBadgeProps(pr.ciStatus);
                      const review    = reviewBadgeProps(pr.reviewStatus);
                      return (
                        <a
                          key={pr.id}
                          href={pr.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-2.5 transition-all hover:border-[#155DFC] hover:bg-blue-50/30 hover:shadow-sm"
                        >
                          {/* PR title row */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-1.5">
                              {stateInfo.icon}
                              <span className="line-clamp-2 text-xs font-semibold leading-tight text-[#374151] transition-colors group-hover:text-[#155DFC]">
                                {pr.title}
                              </span>
                            </div>
                            <ExternalLink
                              size={11}
                              className="mt-0.5 flex-shrink-0 text-[#C4C9D4] transition-colors group-hover:text-[#155DFC]"
                            />
                          </div>

                          {/* Badges row */}
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <Badge label={stateInfo.label} cls={stateInfo.badgeCls} />
                            {ci     && <Badge label={ci.label}     cls={ci.cls}     pulse={ci.pulse} />}
                            {review && <Badge label={review.label} cls={review.cls} />}
                            <span className="ml-auto whitespace-nowrap text-[10px] text-[#98A2B3]">
                              #{pr.prNumber} · {formatRelative(pr.updatedAt)}
                            </span>
                          </div>

                          {/* Branch flow + author */}
                          <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-[#B0B7C3]">
                            <GitBranch size={9} className="flex-shrink-0" />
                            <span className="truncate">{pr.headBranch}</span>
                            <span className="flex-shrink-0">→</span>
                            <span className="truncate">{pr.baseBranch}</span>
                            {pr.author && (
                              <>
                                <span className="flex-shrink-0 px-0.5">·</span>
                                <span className="truncate font-sans not-italic">{pr.author}</span>
                              </>
                            )}
                          </div>
                        </a>
                      );
                    })
                  )}
                </div>
              </CollapseSection>
            </div>

            {/* ── Commits ──────────────────────────────────────────────────── */}
            <div className="border-t border-[#F2F4F7]">
              <CollapseSection
                title="Commits"
                icon={<GitCommit size={11} />}
                open={commitsOpen}
                onToggle={() => toggle('commits')}
                count={commits.length}
              >
                <div className="space-y-1.5 px-4 pb-4 pt-2">
                  {loadingCommits ? (
                    <>
                      <Skeleton className="h-[54px] w-full" />
                      <Skeleton className="h-[54px] w-full" />
                      <Skeleton className="h-[54px] w-full" />
                    </>
                  ) : commits.length === 0 ? (
                    <EmptyState
                      icon={<GitCommit size={14} />}
                      title="No commits linked"
                      description="Commits mentioning this task number will appear here"
                    />
                  ) : (
                    commits.map((commit) => {
                      const ci = ciBadgeProps(commit.ciStatus);
                      return (
                        <a
                          key={commit.id}
                          href={commit.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-2.5 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] px-3 py-2 transition-all hover:border-[#155DFC] hover:bg-blue-50/30 hover:shadow-sm"
                        >
                          {/* CI icon or fallback commit icon */}
                          <div className="mt-0.5 flex-shrink-0">
                            {commit.ciStatus
                              ? <CiStatusIcon status={commit.ciStatus} size={13} />
                              : <GitCommit size={13} className="text-[#9CA3AF]" />
                            }
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* SHA + CI badge */}
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[10px] font-semibold text-[#155DFC]">
                                {commit.sha}
                              </span>
                              {ci && <Badge label={ci.label} cls={ci.cls} pulse={ci.pulse} />}
                            </div>

                            {/* Commit message */}
                            <p className="mt-0.5 truncate text-[11px] leading-tight text-[#374151] transition-colors group-hover:text-[#155DFC]">
                              {commit.message}
                            </p>

                            {/* Meta: time · author */}
                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#B0B7C3]">
                              <Clock size={9} className="flex-shrink-0" />
                              <span className="flex-shrink-0">{formatRelative(commit.committedAt)}</span>
                              {commit.author && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{commit.author}</span>
                                </>
                              )}
                            </div>
                          </div>

                          <ExternalLink
                            size={10}
                            className="mt-1 flex-shrink-0 text-[#C4C9D4] transition-colors group-hover:text-[#155DFC]"
                          />
                        </a>
                      );
                    })
                  )}
                </div>
              </CollapseSection>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TaskGitHubSection;
