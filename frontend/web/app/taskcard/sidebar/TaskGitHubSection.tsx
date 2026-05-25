'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Check,
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
import { CIStatusBadge } from '@/components/ui';
import SidebarField from './SidebarField';
import CreateIssueModal from './CreateIssueModal';

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
  const [issueModalOpen, setIssueModalOpen]   = useState(false);

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

  const handleCreateIssue = () => setIssueModalOpen(true);

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

  const openPrCount = prs.filter(p => !p.mergedAt && p.state === 'open').length;

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
          {!loadingSummary && summary?.latestCiStatus && (
            <CIStatusBadge status={summary.latestCiStatus} size="sm" />
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
                    <CIStatusBadge status={summary.latestCiStatus} size="md" />
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
                    /* ── Skeletons ── */
                    <>
                      <Skeleton className="h-[90px] w-full" />
                      <Skeleton className="h-[82px] w-full" />
                      <Skeleton className="h-[90px] w-full" />
                    </>
                  ) : prs.length === 0 ? (
                    /* ── Empty state ── */
                    <div className="flex flex-col items-center gap-2.5 py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F4F7]">
                        <GitPullRequest size={18} className="text-[#9CA3AF]" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#6A7282]">
                          No pull requests linked
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug text-[#98A2B3]">
                          PRs that reference this task will appear here
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* ── PR cards ── */
                    prs.map((pr) => {
                      const stateInfo = prStateMeta(pr.state, pr.mergedAt);
                      const review    = reviewBadgeProps(pr.reviewStatus);
                      const accentCls =
                        pr.mergedAt || pr.state === 'merged' ? 'border-l-purple-400' :
                        pr.state === 'closed'                ? 'border-l-red-400'    :
                                                               'border-l-green-400';
                      return (
                        <a
                          key={pr.id}
                          href={pr.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group block overflow-hidden rounded-lg border border-l-2 border-[#E5E7EB] bg-white transition-all hover:bg-[#FAFBFF] hover:shadow-sm ${accentCls}`}
                        >
                          <div className="px-3 pb-2.5 pt-2.5">

                            {/* ── Row 1: state icon + PR number + title + link ── */}
                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="mb-0.5 flex items-center gap-1.5">
                                  {stateInfo.icon}
                                  <span className="font-mono text-[10px] font-bold text-[#9CA3AF]">
                                    #{pr.prNumber}
                                  </span>
                                </div>
                                <p className="line-clamp-2 text-[11px] font-semibold leading-snug text-[#374151] transition-colors group-hover:text-[#155DFC]">
                                  {pr.title}
                                </p>
                              </div>
                              <ExternalLink
                                size={11}
                                className="mt-0.5 flex-shrink-0 text-[#C4C9D4] transition-colors group-hover:text-[#155DFC]"
                              />
                            </div>

                            {/* ── Row 2: PR state · CI · review badges ── */}
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                              <Badge label={stateInfo.label} cls={stateInfo.badgeCls} />
                              <CIStatusBadge status={pr.ciStatus} size="sm" />
                              {review && <Badge label={review.label} cls={review.cls} />}
                            </div>

                            {/* ── Row 3: branch flow ── */}
                            <div className="mt-2 flex min-w-0 items-center gap-1 font-mono text-[10px] text-[#B0B7C3]">
                              <GitBranch size={9} className="flex-shrink-0" />
                              <span className="truncate">{pr.headBranch}</span>
                              <span className="flex-shrink-0 opacity-50">→</span>
                              <span className="truncate">{pr.baseBranch}</span>
                            </div>

                            {/* ── Row 4: author · updated time ── */}
                            <div className="mt-1 flex items-center justify-between text-[10px] text-[#C4C9D4]">
                              {pr.author
                                ? <span className="truncate">{pr.author}</span>
                                : <span />
                              }
                              <span className="flex-shrink-0 pl-2">{formatRelative(pr.updatedAt)}</span>
                            </div>

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
                <div className="space-y-2 px-4 pb-4 pt-2">
                  {loadingCommits ? (
                    /* ── Loading skeletons ── */
                    <>
                      <Skeleton className="h-[78px] w-full" />
                      <Skeleton className="h-[70px] w-full" />
                      <Skeleton className="h-[78px] w-full" />
                      <Skeleton className="h-[70px] w-full" />
                    </>
                  ) : commits.length === 0 ? (
                    /* ── Empty state ── */
                    <div className="flex flex-col items-center gap-2.5 py-6 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F4F7]">
                        <GitCommit size={18} className="text-[#9CA3AF]" />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#6A7282]">No commits linked</p>
                        <p className="mt-0.5 text-[10px] leading-snug text-[#98A2B3]">
                          Commits mentioning this task number will appear here
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* ── Commit cards ── */
                    commits.map((commit) => {
                      const ciAccent =
                        commit.ciStatus === 'PASSING' ? 'border-l-green-400' :
                        commit.ciStatus === 'FAILED'  ? 'border-l-red-400'   :
                        commit.ciStatus === 'RUNNING' ? 'border-l-amber-400' :
                                                        'border-l-[#D1D5DB]';
                      return (
                        <a
                          key={commit.id}
                          href={commit.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Commit ${commit.sha}: ${commit.message}`}
                          className={`group block overflow-hidden rounded-lg border border-l-2 border-[#E5E7EB] bg-white transition-all hover:bg-[#FAFBFF] hover:shadow-sm ${ciAccent}`}
                        >
                          <div className="px-3 pb-2.5 pt-2.5">

                            {/* ── Row 1: SHA chip · CI badge · external link ── */}
                            <div className="flex items-center gap-1.5">
                              <code className="inline-flex items-center gap-1 rounded bg-[#F0F4FF] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#155DFC]">
                                <GitCommit size={9} aria-hidden="true" />
                                {commit.sha}
                              </code>
                              <CIStatusBadge status={commit.ciStatus} size="sm" />
                              <ExternalLink
                                size={10}
                                aria-hidden="true"
                                className="ml-auto flex-shrink-0 text-[#C4C9D4] transition-colors group-hover:text-[#155DFC]"
                              />
                            </div>

                            {/* ── Row 2: commit message, 2-line clamp ── */}
                            <p className="mt-1.5 line-clamp-2 text-[11px] font-medium leading-snug text-[#374151] transition-colors group-hover:text-[#155DFC]">
                              {commit.message}
                            </p>

                            {/* ── Row 3: author · timestamp ── */}
                            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#B0B7C3]">
                              {commit.author && (
                                <span className="max-w-[100px] truncate">{commit.author}</span>
                              )}
                              {commit.author && commit.committedAt && (
                                <span className="flex-shrink-0">·</span>
                              )}
                              {commit.committedAt && (
                                <span className="flex flex-shrink-0 items-center gap-1">
                                  <Clock size={9} aria-hidden="true" />
                                  <span>{formatRelative(commit.committedAt)}</span>
                                </span>
                              )}
                            </div>

                          </div>
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

      <CreateIssueModal
        open={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        taskId={taskId}
        projectId={projectId}
      />
    </div>
  );
};

export default TaskGitHubSection;
