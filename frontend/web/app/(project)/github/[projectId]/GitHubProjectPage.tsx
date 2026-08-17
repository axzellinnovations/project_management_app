'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Globe, Lock, RefreshCw, Search, X, Check, Link2,
  LogOut, User, ExternalLink, GitPullRequest, ChevronDown, AlertCircle, GitCommit,
  SlidersHorizontal, ChevronLeft, ChevronRight, UserPlus,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ensureValidToken } from '@/lib/auth';
import api from '@/lib/axios';
import { useGithubPRSocket, type GithubPRUpdate } from '@/hooks/useGithubPRSocket';
import { useGithubCISocket, type GithubCIUpdate } from '@/hooks/useGithubCISocket';
import { useGithubIssueSocket, type GithubIssueUpdate } from '@/hooks/useGithubIssueSocket';
import { useGithubTaskBadgeSocket, type GithubTaskBadgeUpdate } from '@/hooks/useGithubTaskBadgeSocket';
import { StompProvider } from '@/ws/stomp-provider';
import CIStatusBanner from '@/components/github/CIStatusBanner';
import GitHubAutomationsPanel from '@/components/github/GitHubAutomationsPanel';
import AutomationRuleBuilder from '@/components/github/AutomationRuleBuilder';
import ImportIssueModal from '@/components/github/ImportIssueModal';
import { Popover, toast } from '@/components/ui';
import OverlayPortal from '@/components/ui/OverlayPortal';
import {
  getProjectGitHubRepo,
  setProjectGitHubConnection,
  clearProjectGitHubRepo,
  hasConnectedGitHubAccount,
  fetchRepositories,
  fetchGitHubConnectionStatus,
  fetchGitHubUser,
  fetchProjectGitHubConnection,
  persistProjectGitHubConnection,
  fetchProjectPullRequests,
  fetchProjectCommits,
  fetchProjectIssues,
  fetchImportedGitHubIssueNumbers,
  fetchGitHubAutomationRules,
  fetchGitHubAutomationLogs,
  deleteGitHubAutomationRule,
  setGitHubAutomationRuleEnabled,
  syncProjectGitHub,
  inviteGitHubCollaborator,
  getSavedGitHubAccounts,
  upsertSavedGitHubAccount,
  type GitHubRepository,
  type GitHubPullRequest,
  type GitHubCommit,
  type GitHubIssue,
  type GitHubUser,
  type ProjectGitHubConnection,
  type GithubAutomationRule,
  type GithubAutomationLog,
  type GithubCollaboratorInviteResponse,
  type SavedGitHubAccount,
} from '@/services/github-service';
import IssueCard from '@/components/github/IssueCard';
import GitHubMark from '@/components/github/GitHubMark';
import { fetchMembers, type Member } from '@/services/members-service';
import { getUserFromToken } from '@/lib/auth';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

// ── Shared glass style tokens ─────────────────────────────────────────────────
const glass = {
  card: {
    background: 'var(--cu-bg)',
    border: '1px solid var(--cu-border)',
    boxShadow: 'var(--cu-shadow-sm)',
  },
  cardHover: {
    boxShadow: 'var(--cu-shadow-md)',
  },
  modal: {
    background: 'var(--cu-bg)',
    backdropFilter: 'blur(28px) saturate(180%)',
    border: '1px solid var(--cu-border)',
    boxShadow: 'var(--cu-shadow-xl)',
  },
  button: {
    background: 'var(--cu-bg)',
    border: '1px solid var(--cu-border)',
    boxShadow: 'var(--cu-shadow-sm)',
  },
  buttonActive: {
    background: 'var(--cu-primary)',
    border: '1px solid var(--cu-primary)',
    boxShadow: 'var(--cu-shadow-sm)',
  },
  input: {
    background: 'var(--cu-bg-secondary)',
    border: '1px solid var(--cu-border)',
  },
  divider: { borderBottom: '1px solid var(--cu-border)' },
} as const;

const iconSurfaceClass = 'bg-cu-bg-secondary text-cu-text-secondary border border-cu-border shadow-cu-sm';
const secondaryButtonClass = 'rounded-xl border border-cu-border bg-cu-bg px-3 py-2 font-outfit font-semibold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary disabled:opacity-40';
const iconButtonClass = 'rounded-xl border border-cu-border bg-cu-bg p-2 text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary disabled:opacity-40';
const githubConnectRequiredMessage = 'Connect your GitHub account to load repository activity.';
type GitHubRouteState = 'initializing' | 'needsAppAuth' | 'needsGitHubAccount' | 'needsRepository' | 'connected' | 'error';
type GithubCollaboratorPermission = 'pull' | 'triage' | 'push' | 'maintain';

function getMemberUserId(member: Member): number | undefined {
  return member.user?.userId ?? member.userId;
}

function getMemberGithubUsername(member: Member): string | null {
  return member.user?.githubUsername ?? member.githubUsername ?? null;
}

function getMemberGithubEmail(member: Member): string | null {
  return member.user?.githubEmail ?? member.githubEmail ?? null;
}

function getMemberDisplayName(member: Member): string {
  return member.user?.username ?? member.username ?? member.user?.email ?? member.email ?? 'Team member';
}

function getMemberInviteIdentifier(member: Member): string | null {
  return getMemberGithubUsername(member) ?? getMemberGithubEmail(member);
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    const message = response?.data?.message ?? response?.data?.error;
    if (message) return message;
  }
  return error instanceof Error ? error.message : fallback;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return '';
  const timestamp = new Date(dateStr).getTime();
  if (isNaN(timestamp)) return '';
  const diff = Math.max(0, Date.now() - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function prStatus(pr: GitHubPullRequest): { label: string; color: string; dot: string; glow: string } {
  if (pr.draft) return { label: 'Draft', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20', dot: 'bg-slate-400', glow: '' };
  const prState = (pr as unknown as { state?: string; rawState?: string }).state;
  const isMerged = Boolean(pr.merged_at) || (pr as unknown as { rawState?: string }).rawState === 'merged' || prState === 'merged';
  if (isMerged) return { label: 'Merged', color: 'text-purple-300 bg-purple-400/12 border-purple-400/25', dot: 'bg-purple-400', glow: 'shadow-[0_0_10px_rgba(168,85,247,0.35)]' };
  if (pr.state === 'closed') return { label: 'Closed', color: 'text-red-300 bg-red-400/12 border-red-400/25', dot: 'bg-red-400', glow: '' };
  return { label: 'Open', color: 'text-emerald-300 bg-emerald-400/12 border-emerald-400/25', dot: 'bg-emerald-400', glow: 'shadow-[0_0_10px_rgba(52,211,153,0.35)]' };
}


// ── Disconnected state ────────────────────────────────────────────────────────
function DisconnectedView({
  onConnect,
  onLogout,
  isPostLogout,
}: {
  onConnect: () => void;
  onLogout: () => void;
  isPostLogout: boolean;
}) {
  return (
      <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col items-center gap-8 max-w-sm w-full text-center"
    >
      {/* Logo orb */}
      <div className="relative">
        <div
          className="absolute inset-[-16px] rounded-full blur-3xl opacity-50"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
        />
        <motion.div
          animate={{ boxShadow: ['0 0 24px rgba(99,102,241,0.25)', '0 0 48px rgba(99,102,241,0.4)', '0 0 24px rgba(99,102,241,0.25)'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="relative w-[88px] h-[88px] rounded-[28px] flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--cu-bg-secondary) 0%, var(--cu-bg) 100%)',
            backdropFilter: 'blur(24px) saturate(200%)',
            border: '1px solid var(--cu-border)',
            boxShadow: 'var(--cu-shadow-lg), inset 0 1px 0 var(--cu-border)',
          }}
        >
          <GitHubMark size={42} className="text-cu-text-primary" />
        </motion.div>
      </div>

      {isPostLogout ? (
        <>
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[22px] font-outfit font-black text-cu-text-primary tracking-tight">
              Choose a GitHub account
            </h2>
            <p className="text-sm text-cu-text-secondary font-outfit leading-relaxed">
              You&apos;ll be redirected to GitHub to sign in. If you have multiple accounts you&apos;ll see a picker.
            </p>
          </div>

          <div
            className="w-full rounded-2xl p-4"
            style={{
              background: 'rgba(99,102,241,0.08)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                <User size={11} className="text-indigo-600 dark:text-indigo-300" />
              </div>
              <span className="text-sm text-cu-text-secondary font-outfit text-left leading-relaxed">
                Your previous account has been disconnected. Sign in with any GitHub account.
              </span>
            </div>
          </div>

          <motion.button
            onClick={onConnect}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-outfit font-bold text-[15px] text-white w-full justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(168,85,247,0.7) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 28px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <GitHubMark size={18} className="text-white" />
            Choose GitHub account
          </motion.button>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2.5">
            <h2 className="text-[22px] font-outfit font-black text-cu-text-primary tracking-tight">
              Connect to GitHub
            </h2>
            <p className="text-sm text-cu-text-secondary font-outfit leading-relaxed">
              Link this project to a GitHub repository to track pull requests, commits, and issues.
            </p>
          </div>

          <div
            className="flex flex-col gap-3 w-full rounded-2xl p-5"
            style={{
              background: 'var(--cu-bg-secondary)',
              backdropFilter: 'blur(16px)',
              border: '1px solid var(--cu-border)',
              boxShadow: 'inset 0 1px 0 var(--cu-border)',
            }}
          >
            {[
              { icon: <GitPullRequest size={13} />, text: 'View pull requests in real time' },
              { icon: <GitCommit size={13} />, text: 'Track commits and branch history' },
              { icon: <AlertCircle size={13} />, text: 'Monitor open, merged & closed PRs' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-emerald-600 dark:text-emerald-400"
                  style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  {item.icon}
                </div>
                <span className="text-sm text-cu-text-secondary font-outfit flex-1 text-left">{item.text}</span>
                <Check size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={2.5} />
              </div>
            ))}
          </div>

          <motion.button
            onClick={onConnect}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-outfit font-bold text-[15px] text-white w-full justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(168,85,247,0.7) 100%)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.2)',
              boxShadow: '0 4px 28px rgba(99,102,241,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <GitHubMark size={18} className="text-white" />
            Connect to GitHub
          </motion.button>
        </>
      )}

      <button
        onClick={onLogout}
        className="flex items-center gap-1.5 text-xs font-outfit font-semibold text-red-500 dark:text-red-400/70 hover:text-red-600 dark:hover:text-red-400 transition-colors"
      >
        <LogOut size={12} />
        Logout from GitHub
      </button>

      {!GITHUB_CLIENT_ID && (
        <div
          className="w-full rounded-xl px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30"
        >
          <p className="text-xs text-amber-800 dark:text-amber-300 font-outfit">
            Set <code className="font-mono bg-amber-100 dark:bg-amber-900/30 px-1 py-0.5 rounded">NEXT_PUBLIC_GITHUB_CLIENT_ID</code> to enable GitHub OAuth.
          </p>
        </div>
      )}
      </motion.div>
  );
}

function RouteStatusView({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full max-w-md flex-col items-center gap-5 text-center"
    >
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconSurfaceClass}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-outfit font-black tracking-tight text-cu-text-primary">{title}</h2>
        <p className="text-sm font-outfit leading-relaxed text-cu-text-secondary">{subtitle}</p>
      </div>
      {action}
    </motion.div>
  );
}

function InitializingView() {
  return (
    <RouteStatusView
      title="Loading GitHub view"
      subtitle="Checking your Planora session, GitHub account, and linked project repository."
      icon={<RefreshCw size={22} className="animate-spin text-cu-text-secondary" />}
    />
  );
}

function AppAuthRequiredView({ onLogin }: { onLogin: () => void }) {
  return (
    <RouteStatusView
      title="Sign in required"
      subtitle="Your Planora session could not be restored. Sign in again to open this GitHub project view."
      icon={<Lock size={22} className="text-cu-text-secondary" />}
      action={(
        <button
          type="button"
          onClick={onLogin}
          className="rounded-2xl bg-cu-primary px-5 py-2.5 text-sm font-outfit font-bold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover"
        >
          Go to login
        </button>
      )}
    />
  );
}

function RepositoryRequiredView({ onSelectRepo, loading }: { onSelectRepo: () => void; loading: boolean }) {
  return (
    <RouteStatusView
      title="Choose a repository"
      subtitle="Your GitHub account is connected. Link a repository to this project to load pull requests, commits, issues, and automations."
      icon={<Link2 size={22} className="text-cu-text-secondary" />}
      action={(
        <button
          type="button"
          onClick={onSelectRepo}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-2xl bg-cu-primary px-5 py-2.5 text-sm font-outfit font-bold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover disabled:opacity-50"
        >
          <GitHubMark size={16} className="text-white" />
          {loading ? 'Loading repositories...' : 'Select repository'}
        </button>
      )}
    />
  );
}

function GitHubRouteErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <RouteStatusView
      title="Unable to load GitHub view"
      subtitle={message}
      icon={<AlertCircle size={22} className="text-red-500" />}
      action={(
        <button
          type="button"
          onClick={onRetry}
          className="rounded-2xl border border-cu-border bg-cu-bg px-5 py-2.5 text-sm font-outfit font-bold text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
        >
          Retry
        </button>
      )}
    />
  );
}

// ── PR Card ───────────────────────────────────────────────────────────────────
function PRCard({ pr }: { pr: GitHubPullRequest }) {
  const status = prStatus(pr);
  const authorLogin = pr.user?.login || 'unknown';
  const avatarUrl = pr.user?.avatar_url?.trim() || (authorLogin !== 'unknown' ? `https://github.com/${authorLogin}.png` : null);
  const headRef = pr.head?.ref || 'head';
  const baseRef = pr.base?.ref || 'main';

  return (
    <motion.a
      href={pr.html_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, ...glass.cardHover }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col gap-3 p-4 rounded-2xl group transition-all cursor-pointer"
      style={glass.card}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-outfit font-bold text-slate-500">
          <GitPullRequest size={12} />
          #{pr.number}
        </span>
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-outfit font-semibold border ${status.color} ${status.glow}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <span className="ml-auto text-[11px] text-slate-600 font-outfit shrink-0">
          {timeAgo(pr.updated_at || pr.created_at)}
        </span>
      </div>

      <p className="text-sm font-outfit font-semibold text-cu-text-primary leading-snug line-clamp-2 group-hover:text-cu-primary transition-colors">
        {pr.title || 'Untitled PR'}
      </p>

      <div className="flex items-center gap-1.5 text-[11px] text-cu-text-muted font-outfit">
        <GitBranch size={11} />
        <span className="font-semibold text-cu-text-secondary">{headRef}</span>
        <span className="text-cu-text-muted">→</span>
        <span className="text-cu-text-secondary">{baseRef}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={authorLogin}
              width={18}
              height={18}
              className="h-[18px] w-[18px] rounded-full ring-1 ring-white/10"
              unoptimized
            />
          ) : (
            <div
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <User size={10} className="text-cu-text-tertiary" />
            </div>
          )}
          <span className="text-[11px] text-cu-text-tertiary font-outfit">@{authorLogin}</span>
        </div>
        {(pr.labels || []).slice(0, 3).map(label => (
          <span
            key={label.id}
            className="px-1.5 py-0.5 rounded-full text-[10px] font-outfit font-semibold"
            style={{
              backgroundColor: `#${label.color}22`,
              color: `#${label.color}`,
              border: `1px solid #${label.color}33`,
            }}
          >
            {label.name}
          </span>
        ))}
      </div>
    </motion.a>
  );
}

// ── Commit Card ───────────────────────────────────────────────────────────────
function CommitCard({ commit }: { commit: GitHubCommit }) {
  const firstLine = (commit.commit?.message || 'No commit message').split('\n')[0];
  const shortSha = commit.sha ? commit.sha.slice(0, 7) : '-------';
  const authorName = commit.author?.login || commit.commit?.author?.name || 'unknown';
  const avatarUrl = commit.author?.avatar_url ?? null;
  const commitDate = commit.commit?.author?.date || '';

  return (
    <motion.a
      href={commit.html_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, ...glass.cardHover }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col gap-3 p-4 rounded-2xl group transition-all cursor-pointer"
      style={glass.card}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-cu-text-secondary px-2 py-0.5 rounded-lg bg-cu-bg-secondary border border-cu-border"
        >
          <GitCommit size={11} />
          {shortSha}
        </span>
        {commitDate && (
          <span className="ml-auto text-[11px] text-slate-600 font-outfit shrink-0">
            {timeAgo(commitDate)}
          </span>
        )}
      </div>

      <p className="text-sm font-outfit font-semibold text-cu-text-primary leading-snug line-clamp-2 group-hover:text-cu-primary transition-colors">
        {firstLine}
      </p>

      <div className="flex items-center gap-1.5">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={authorName} width={18} height={18} className="h-[18px] w-[18px] rounded-full ring-1 ring-white/10" unoptimized />
        ) : (
          <div
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <User size={10} className="text-cu-text-tertiary" />
          </div>
        )}
        <span className="text-[11px] text-cu-text-tertiary font-outfit">@{authorName}</span>
      </div>
    </motion.a>
  );
}

// ── Account dropdown ──────────────────────────────────────────────────────────
function AccountDropdown({
  user,
  onLogout,
  onChangeRepo,
  onInviteCollaborator,
  canChangeRepo,
}: {
  user: GitHubUser | null;
  onLogout: () => void;
  onChangeRepo: () => void;
  onInviteCollaborator: () => void;
  canChangeRepo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-cu-hover"
        style={glass.button}
      >
        {user?.avatar_url ? (
          <Image src={user.avatar_url} alt={user.login} width={20} height={20} className="h-5 w-5 rounded-full ring-1 ring-white/15" unoptimized />
        ) : (
          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center">
            <User size={11} className="text-cu-text-tertiary" />
          </div>
        )}
        <span className="text-xs font-outfit font-semibold text-cu-text-primary hidden sm:inline">
          {user?.login ?? 'Account'}
        </span>
        <ChevronDown size={12} className={`text-cu-text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-[var(--cu-z-dropdown)]"
            style={glass.modal}
          >
            <div className="px-4 py-3.5" style={glass.divider}>
              <div className="flex items-center gap-3">
                {user?.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.login} width={38} height={38} className="h-[38px] w-[38px] rounded-full ring-2 ring-white/10" unoptimized />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center">
                    <User size={16} className="text-cu-text-tertiary" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-outfit font-bold text-cu-text-primary truncate">
                    {user?.name ?? user?.login ?? '—'}
                  </span>
                  <span className="text-xs text-cu-text-tertiary font-outfit truncate">@{user?.login}</span>
                </div>
              </div>
              {user && (
                <a
                  href={user.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 flex items-center gap-1.5 text-xs text-indigo-400 font-outfit font-semibold hover:text-indigo-300 transition-colors"
                >
                  <ExternalLink size={11} />
                  View GitHub profile
                </a>
              )}
            </div>

            <div className="py-1.5">
              {canChangeRepo && (
                <>
                  <button
                    onClick={() => { setOpen(false); onInviteCollaborator(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-outfit font-semibold text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors text-left"
                  >
                    <UserPlus size={14} className="text-cu-text-tertiary" />
                    Invite collaborator
                  </button>
                  <button
                    onClick={() => { setOpen(false); onChangeRepo(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-outfit font-semibold text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors text-left"
                  >
                    <Link2 size={14} className="text-cu-text-tertiary" />
                    Change repository
                  </button>
                </>
              )}
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-outfit font-semibold text-red-400 hover:bg-red-400/[0.08] transition-colors text-left"
              >
                <LogOut size={14} />
                Logout from GitHub
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Repo selection modal ──────────────────────────────────────────────────────
function RepoModal({
  repos, search, loading, error, onSearch, onSelect, onClose, onRefresh,
}: {
  repos: GitHubRepository[];
  search: string;
  loading: boolean;
  error: string | null;
  onSearch: (v: string) => void;
  onSelect: (repo: GitHubRepository) => void;
  onClose: () => void;
  onRefresh: () => void;
}) {
  return (
    <OverlayPortal>
      <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,20,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-lg overflow-hidden flex flex-col rounded-2xl"
        style={{ ...glass.modal, maxHeight: '80vh' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={glass.divider}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconSurfaceClass}`}>
              <GitHubMark size={15} className="text-cu-text-primary" />
            </div>
            <span className="font-outfit font-bold text-cu-text-primary text-base">Select a repository</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3" style={glass.divider}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={glass.input}>
            <Search size={14} className="text-slate-500 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search repositories…"
              value={search}
              onChange={e => onSearch(e.target.value)}
              className="flex-1 text-sm font-outfit bg-transparent outline-none text-cu-text-primary placeholder:text-cu-text-muted"
            />
            {search && (
              <button onClick={() => onSearch('')} className="text-slate-500 hover:text-slate-300 transition-colors">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] animate-pulse" />
              <span className="text-sm text-slate-500 font-outfit">Loading repositories…</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                <X size={16} className="text-red-400" />
              </div>
              <p className="text-sm text-slate-400 font-outfit">{error}</p>
              <button onClick={onRefresh} className="text-sm text-indigo-400 font-outfit font-semibold hover:text-indigo-300 transition-colors">
                Try again
              </button>
            </div>
          )}
          {!loading && !error && repos.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12">
              <span className="text-sm text-slate-500 font-outfit">No repositories found</span>
            </div>
          )}
          {!loading && !error && repos.length > 0 && (
            <ul className="py-1.5">
              {repos.map(repo => (
                <li key={repo.id}>
                  <button
                    onClick={() => onSelect(repo)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cu-hover transition-colors text-left group"
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors ${iconSurfaceClass}`}
                    >
                      <GitHubMark size={14} className="text-cu-text-secondary" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-outfit font-semibold text-cu-text-primary truncate">{repo.full_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 font-outfit">
                          <GitBranch size={10} />{repo.default_branch}
                        </span>
                        <span className={`flex items-center gap-1 text-[11px] font-outfit ${repo.private ? 'text-slate-500' : 'text-blue-400'}`}>
                          {repo.private ? <Lock size={9} /> : <Globe size={9} />}
                          {repo.private ? 'Private' : 'Public'}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
      </motion.div>
    </OverlayPortal>
  );
}

function InviteCollaboratorModal({
  repoFullName,
  members,
  loading,
  error,
  result,
  onSubmit,
  onClose,
}: {
  repoFullName: string;
  members: Member[];
  loading: boolean;
  error: string | null;
  result: GithubCollaboratorInviteResponse | null;
  onSubmit: (identifier: string, permission: GithubCollaboratorPermission) => void;
  onClose: () => void;
}) {
  const [identifier, setIdentifier] = useState('');
  const [permission, setPermission] = useState<GithubCollaboratorPermission>('push');
  const canSubmit = identifier.trim().length > 0 && !loading;
  const inviteReadyMembers = members.filter(member => Boolean(getMemberInviteIdentifier(member)));
  const inviteBlockedMembers = members.filter(member => !getMemberInviteIdentifier(member));

  return (
    <OverlayPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4"
        style={{ background: 'rgba(5,8,20,0.72)', backdropFilter: 'blur(10px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.form
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="w-full max-w-md overflow-hidden rounded-2xl"
          style={glass.modal}
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(identifier, permission);
          }}
        >
          <div className="flex items-center justify-between px-5 py-4" style={glass.divider}>
            <div className="flex min-w-0 items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${iconSurfaceClass}`}>
                <UserPlus size={15} className="text-cu-text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-outfit font-bold text-cu-text-primary text-base">Invite collaborator</p>
                <p className="truncate text-xs font-outfit text-cu-text-tertiary">{repoFullName}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-colors"
              aria-label="Close collaborator invite"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid gap-4 px-5 py-5">
            <label className="grid gap-1.5">
              <span className="text-xs font-outfit font-semibold text-cu-text-secondary">GitHub username or email</span>
              <input
                autoFocus
                value={identifier}
                onChange={event => setIdentifier(event.target.value)}
                placeholder="octocat or teammate@example.com"
                className="w-full rounded-xl px-3 py-2.5 text-sm font-outfit text-cu-text-primary outline-none placeholder:text-cu-text-tertiary"
                style={glass.input}
              />
            </label>

            {members.length > 0 && (
              <div className="grid gap-2">
                <span className="text-xs font-outfit font-semibold text-cu-text-secondary">Team members</span>
                <div className="max-h-40 overflow-y-auto rounded-xl border border-cu-border bg-cu-bg-secondary p-2">
                  {inviteReadyMembers.map(member => {
                    const inviteIdentifier = getMemberInviteIdentifier(member);
                    const githubUsername = getMemberGithubUsername(member);
                    return (
                      <button
                        key={`ready-${member.id}`}
                        type="button"
                        onClick={() => inviteIdentifier && setIdentifier(inviteIdentifier)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-cu-hover"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-outfit font-semibold text-cu-text-primary">{getMemberDisplayName(member)}</span>
                          <span className="block truncate text-xs font-outfit text-cu-text-tertiary">
                            {githubUsername ? `@${githubUsername}` : inviteIdentifier}
                          </span>
                        </span>
                        <UserPlus size={13} className="shrink-0 text-cu-text-tertiary" />
                      </button>
                    );
                  })}
                  {inviteBlockedMembers.map(member => (
                    <div
                      key={`blocked-${member.id}`}
                      className="flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left opacity-70"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-outfit font-semibold text-cu-text-secondary">{getMemberDisplayName(member)}</span>
                        <span className="block truncate text-xs font-outfit text-cu-text-tertiary">Connect GitHub in profile first.</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="grid gap-1.5">
              <span className="text-xs font-outfit font-semibold text-cu-text-secondary">Permission</span>
              <select
                value={permission}
                onChange={event => setPermission(event.target.value as GithubCollaboratorPermission)}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-outfit font-semibold text-cu-text-primary outline-none"
                style={glass.input}
              >
                <option value="pull">Read</option>
                <option value="triage">Triage</option>
                <option value="push">Write</option>
                <option value="maintain">Maintain</option>
              </select>
            </label>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-outfit text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300">
                {error}
              </div>
            )}

            {result && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-outfit text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300">
                {result.githubStatus === 201
                  ? `Invitation sent to @${result.githubUsername}.`
                  : `@${result.githubUsername} already has access or was updated.`}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4" style={glass.divider}>
            <button
              type="button"
              onClick={onClose}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex min-w-24 items-center justify-center gap-2 rounded-xl bg-cu-primary px-4 py-2 text-sm font-outfit font-bold text-white shadow-cu-sm transition-colors hover:bg-cu-primary-hover disabled:opacity-40"
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Invite
            </button>
          </div>
        </motion.form>
      </motion.div>
    </OverlayPortal>
  );
}

// ── Account picker modal ──────────────────────────────────────────────────────
function AccountPickerModal({
  accounts,
  onSelect,
  onAddAccount,
  onClose,
}: {
  accounts: SavedGitHubAccount[];
  onSelect: (login: string) => void;
  onAddAccount: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[var(--cu-z-modal)] flex items-center justify-center p-4"
      style={{ background: 'rgba(5,8,20,0.72)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={glass.modal}
      >
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '1px solid var(--cu-border)' }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconSurfaceClass}`}
            >
              <GitHubMark size={13} className="text-cu-text-primary" />
            </div>
            <h2 className="text-sm font-outfit font-bold text-cu-text-primary">Choose a GitHub account</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="py-1.5 max-h-[300px] overflow-y-auto">
          {accounts.map(account => (
            <button
              key={account.login}
              onClick={() => onSelect(account.login)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cu-hover transition-colors group text-left"
            >
              <Image
                src={account.avatarUrl}
                alt={account.login}
                width={36}
                height={36}
                className="h-9 w-9 flex-shrink-0 rounded-full ring-2 ring-cu-border/50"
                unoptimized
              />
              <div className="flex flex-col min-w-0 flex-1">
                {account.name && (
                  <span className="text-sm font-outfit font-semibold text-cu-text-primary truncate leading-tight">
                    {account.name}
                  </span>
                )}
                <span className="text-xs text-cu-text-tertiary font-outfit truncate">@{account.login}</span>
              </div>
              <span className="text-xs font-outfit font-semibold text-cu-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                Connect →
              </span>
            </button>
          ))}
        </div>

        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--cu-border)' }}>
          <button
            onClick={onAddAccount}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-outfit font-semibold text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-all"
            style={{ border: '1px solid var(--cu-border)' }}
          >
            <User size={13} className="text-cu-text-tertiary" />
            Use a different account
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 5;

function PaginationBar({
  page,
  total,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 pt-2">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.07]"
        style={glass.button}
      >
        <ChevronLeft size={14} className="text-slate-400" />
      </button>
      <span
        className="text-xs font-outfit text-slate-400 tabular-nums px-3.5 py-1.5 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        {page} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="p-2 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/[0.07]"
        style={glass.button}
      >
        <ChevronRight size={14} className="text-slate-400" />
      </button>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-[116px] rounded-2xl animate-pulse"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        />
      ))}
    </div>
  );
}

type IssueFilterOption = {
  value: string;
  label: string;
};

function IssueFilterDropdown({
  label,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  label: string;
  value: string;
  options: IssueFilterOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value) ?? options[0];

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      className="w-[min(16rem,calc(100vw-1rem))] overflow-hidden p-0 sm:w-[18rem]"
      trigger={(
        <button
          type="button"
          aria-label={ariaLabel}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-cu-border bg-cu-bg-secondary px-2.5 py-2 text-left text-xs font-outfit font-medium text-cu-text-secondary shadow-cu-sm transition-colors hover:bg-cu-hover hover:text-cu-text-primary focus:border-cu-primary focus:outline-none sm:px-3 sm:py-2.5 sm:text-sm"
        >
          <span className="min-w-0 truncate">
            {selected?.label ?? label}
          </span>
          <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
    >
      <div className="max-h-64 overflow-auto p-2">
        {options.map(option => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${isSelected
                  ? 'bg-cu-primary text-white'
                  : 'text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
                }`}
            >
              <span className="min-w-0 truncate">{option.label}</span>
              {isSelected && <Check size={14} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </Popover>
  );
}
function IssuesPanel({
  projectId,
  repoFullName,
  issues,
  loading,
  error,
  onCountChange,
  onRequireLogin,
  onRefresh,
}: {
  projectId: string;
  repoFullName: string;
  issues: GitHubIssue[];
  loading: boolean;
  error: string | null;
  onCountChange: (count: number | null) => void;
  onRequireLogin: () => void;
  onRefresh: () => void;
}) {
  const [selectedIssue, setSelectedIssue] = useState<GitHubIssue | null>(null);
  const [importedIssueNumbers, setImportedIssueNumbers] = useState<Set<number>>(() => new Set());
  const [stateFilter, setStateFilter] = useState<'all' | GitHubIssue['state']>('all');
  const [labelFilter, setLabelFilter] = useState('');

  const repoIssues = useMemo(() => {
    return (issues || []).filter(issue => !(issue as unknown as { pull_request?: unknown; pullRequest?: unknown }).pull_request && !(issue as unknown as { pull_request?: unknown; pullRequest?: unknown }).pullRequest);
  }, [issues]);

  const availableLabels = useMemo(
    () => Array.from(new Set(
      repoIssues.flatMap(issue => issue.labels.map(label => label.name)).filter(Boolean),
    )).sort((first, second) => first.localeCompare(second)),
    [repoIssues],
  );

  const filteredIssues = useMemo(
    () => repoIssues.filter(issue =>
      (stateFilter === 'all' || issue.state === stateFilter)
      && (!labelFilter || issue.labels.some(label => label.name === labelFilter)),
    ),
    [repoIssues, labelFilter, stateFilter],
  );

  const filtersActive = stateFilter !== 'all' || labelFilter !== '';

  useEffect(() => {
    onCountChange(repoIssues.length);
  }, [repoIssues, onCountChange]);

  useEffect(() => {
    let active = true;

    void fetchImportedGitHubIssueNumbers(projectId, repoFullName)
      .then(issueNumbers => {
        if (active) {
          setImportedIssueNumbers(current => new Set([...current, ...issueNumbers]));
        }
      })
      .catch(() => {
        // The issue list remains usable when linked task metadata is unavailable.
      });

    return () => {
      active = false;
    };
  }, [projectId, repoFullName]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-outfit font-bold text-cu-text-primary">Issues</h2>
          {!loading && !error && (
            <span className="text-sm text-cu-text-secondary font-outfit">
              ({filtersActive ? `${filteredIssues.length} of ` : ''}{issues.length})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className={`${iconButtonClass} inline-flex items-center justify-center self-start sm:self-auto`}
          title="Refresh issues"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="rounded-2xl border border-cu-border bg-cu-bg px-3 py-3 shadow-cu-sm">
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-cu-text-tertiary" />
          <span className="text-xs font-outfit font-semibold uppercase tracking-wide text-cu-text-tertiary">Filters</span>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setStateFilter('all');
                setLabelFilter('');
              }}
              className="ml-auto text-xs font-outfit font-semibold text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
          <IssueFilterDropdown
            label="All states"
            value={stateFilter}
            ariaLabel="Filter issues by state"
            onChange={(nextValue) => setStateFilter(nextValue as 'all' | GitHubIssue['state'])}
            options={[
              { value: 'all', label: 'All states' },
              { value: 'open', label: 'Open' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
          <IssueFilterDropdown
            label="All labels"
            value={labelFilter}
            ariaLabel="Filter issues by label"
            onChange={setLabelFilter}
            options={[
              { value: '', label: 'All labels' },
              ...availableLabels.map(label => ({ value: label, label })),
            ]}
          />
          <div className="sm:flex sm:justify-end">
            {filtersActive ? (
              <button
                type="button"
                onClick={() => {
                  setStateFilter('all');
                  setLabelFilter('');
                }}
              className={`${secondaryButtonClass} inline-flex w-full items-center justify-center py-2.5 text-sm sm:min-w-[5rem]`}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {loading && <SkeletonList />}

      {!loading && error && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)' }}
          >
            <AlertCircle size={16} className="text-red-400" />
          </div>
          <p className="text-xs text-slate-500 font-outfit">{error}</p>
          {(!hasConnectedGitHubAccount() || error.toLowerCase().includes('connect')) ? (
            <motion.button
              onClick={() => onRequireLogin()}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-white font-outfit font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.6), rgba(168,85,247,0.5))',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              <GitHubMark size={14} className="text-white" />
              Connect to GitHub
            </motion.button>
          ) : (
            <button onClick={onRefresh} className="text-xs text-indigo-400 font-outfit font-semibold hover:text-indigo-300 transition-colors">
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10">
          <AlertCircle size={20} className="text-cu-text-tertiary" />
          <p className="text-xs text-cu-text-secondary font-outfit">No issues found</p>
        </div>
      )}

      {!loading && !error && issues.length > 0 && filteredIssues.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10">
          <AlertCircle size={20} className="text-slate-300" />
          <p className="text-xs text-slate-400 font-outfit">No issues match the selected filters</p>
        </div>
      )}

      {!loading && !error && filteredIssues.length > 0 && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {filteredIssues.map(issue => (
            <IssueCard
              key={issue.id}
              issue={issue}
              onImport={setSelectedIssue}
              isImported={importedIssueNumbers.has(issue.number)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedIssue && (
          <ImportIssueModal
            issue={selectedIssue}
            projectId={projectId}
            repoFullName={repoFullName}
            onSuccess={() => {
              setImportedIssueNumbers(current => new Set(current).add(selectedIssue.number));
              setSelectedIssue(null);
            }}
            onClose={() => setSelectedIssue(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Connected Dashboard ───────────────────────────────────────────────────────
function ConnectedDashboard({
  projectId,
  connection,
  prs,
  commits,
  issues,
  loading,
  prError,
  commitError,
  issueError,
  user,
  onRefresh,
  onLogout,
  onChangeRepo,
  onInviteCollaborator,
  onPRUpdate,
  onIssueUpdate,
  automationRules,
  automationLogs,
  automationRulesLoading,
  automationLogsLoading,
  automationRulesError,
  automationLogsError,
  onCreateAutomationRule,
  onDeleteAutomationRule,
  onToggleAutomationRule,
  onRefreshAutomationRules,
  onRefreshAutomationLogs,
  canChangeRepo,
}: {
  projectId: string;
  connection: ProjectGitHubConnection;
  prs: GitHubPullRequest[];
  commits: GitHubCommit[];
  issues: GitHubIssue[];
  loading: boolean;
  prError: string | null;
  commitError: string | null;
  issueError: string | null;
  user: GitHubUser | null;
  onRefresh: () => void;
  onLogout: () => void;
  onChangeRepo: () => void;
  onInviteCollaborator: () => void;
  onPRUpdate: (update: GithubPRUpdate) => void;
  onIssueUpdate: (update: GithubIssueUpdate) => void;
  automationRules: GithubAutomationRule[];
  automationLogs: GithubAutomationLog[];
  automationRulesLoading: boolean;
  automationLogsLoading: boolean;
  automationRulesError: string | null;
  automationLogsError: string | null;
  onCreateAutomationRule: () => void;
  onDeleteAutomationRule: (ruleId: number) => void;
  onToggleAutomationRule: (ruleId: number, enabled: boolean) => void;
  onRefreshAutomationRules: () => void;
  onRefreshAutomationLogs: () => void;
  canChangeRepo: boolean;
}) {
  const needsGitHubConnect = !hasConnectedGitHubAccount();

  const [activeTab, setActiveTab] = useState<'pullRequests' | 'commits' | 'issues'>('pullRequests');
  const [issueCount, setIssueCount] = useState<number | null>(null);
  const [newPRNotice, setNewPRNotice] = useState<GithubPRUpdate | null>(null);
  const [latestCIUpdate, setLatestCIUpdate] = useState<GithubCIUpdate | null>(null);

  const handlePRUpdate = useCallback((update: GithubPRUpdate) => {
    if (update.type === 'opened') {
      setNewPRNotice(update);
      setActiveTab('pullRequests');
    }
    onPRUpdate(update);
  }, [onPRUpdate]);

  const handleSocketError = useCallback((message: string) => {
    console.warn('GitHub socket warning:', message);
  }, []);

  useGithubPRSocket(projectId, handlePRUpdate, handleSocketError);
  useGithubCISocket(projectId, useCallback((update: GithubCIUpdate) => {
    setLatestCIUpdate(update);
  }, []), handleSocketError);
  useGithubIssueSocket(projectId, useCallback((update: GithubIssueUpdate) => {
    onIssueUpdate(update);
  }, [onIssueUpdate]), handleSocketError);
  useGithubTaskBadgeSocket(projectId, useCallback((_update: GithubTaskBadgeUpdate) => {
  }, []), handleSocketError);

  const [prPage, setPRPage] = useState(1);
  const [commitPage, setCommitPage] = useState(1);
  const [prFilter, setPrFilter] = useState<'all' | 'open' | 'merged' | 'closed'>('all');

  const filteredPrs = useMemo(() => {
    return prs.filter((pr) => {
      if (prFilter === 'all') return true;
      const prState = (pr as unknown as { state?: string; rawState?: string }).state;
      const isMerged = Boolean(pr.merged_at) || (pr as unknown as { rawState?: string }).rawState === 'merged' || prState === 'merged';
      if (prFilter === 'merged') return isMerged;
      if (prFilter === 'open') return pr.state === 'open' && !isMerged;
      if (prFilter === 'closed') return pr.state === 'closed' && !isMerged;
      return true;
    });
  }, [prs, prFilter]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col gap-5">

      {/* ── Repo header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Repo badge */}
        <div
          className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: '0 0 24px rgba(99,102,241,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          <GitHubMark size={14} className="text-cu-text-primary" />
          <span className="text-xs font-outfit font-bold text-cu-text-primary truncate max-w-[180px] sm:max-w-[240px]">
            {connection.repoFullName}
          </span>
          <span className={`flex items-center gap-1 text-[10px] font-outfit px-1.5 py-0.5 rounded-full ${connection.private ? 'bg-cu-bg-tertiary text-cu-text-secondary' : 'bg-cu-primary/10 text-cu-primary'
            }`}>
            {connection.private ? <Lock size={8} /> : <Globe size={8} />}
            {connection.private ? 'Private' : 'Public'}
          </span>
          <span className="hidden sm:flex items-center gap-1 text-[10px] font-outfit text-cu-text-tertiary">
            <GitBranch size={10} />
            {connection.defaultBranch}
          </span>
        </div>

        <div className="flex-1" />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="p-2 rounded-xl transition-all text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover disabled:opacity-40"
            style={glass.button}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {canChangeRepo && (
            <>
              <button
                onClick={onInviteCollaborator}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-outfit font-semibold text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-all"
                style={glass.button}
              >
                <UserPlus size={13} />
                Invite
              </button>
              <button
                onClick={onChangeRepo}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-outfit font-semibold text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-all"
                style={glass.button}
              >
                <Link2 size={13} />
                Change repo
              </button>
            </>
          )}
          <AccountDropdown
            user={user}
            onLogout={onLogout}
            onChangeRepo={onChangeRepo}
            onInviteCollaborator={onInviteCollaborator}
            canChangeRepo={canChangeRepo}
          />
        </div>
      </div>

      <CIStatusBanner update={latestCIUpdate} repoFullName={connection.repoFullName} />

      <GitHubAutomationsPanel
        rules={automationRules}
        logs={automationLogs}
        loadingRules={automationRulesLoading}
        loadingLogs={automationLogsLoading}
        rulesError={automationRulesError}
        logsError={automationLogsError}
        onCreateRule={onCreateAutomationRule}
        onDeleteRule={onDeleteAutomationRule}
        onToggleRule={onToggleAutomationRule}
        onRefreshRules={onRefreshAutomationRules}
        onRefreshLogs={onRefreshAutomationLogs}
      />

      <AnimatePresence>
        {newPRNotice && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-3 rounded-2xl border border-cu-primary/20 bg-cu-primary/10 px-4 py-3 shadow-sm"
          >
            <div className="mt-0.5 rounded-lg bg-blue-100 p-1.5 text-blue-600">
              <GitPullRequest size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-outfit font-semibold text-cu-text-primary">
                New PR opened: #{newPRNotice.prNumber} {newPRNotice.prTitle}
              </p>
              <a
                href={newPRNotice.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs font-outfit font-semibold text-blue-600 hover:underline"
              >
                View pull request <ExternalLink size={11} />
              </a>
            </div>
            <button
              type="button"
              onClick={() => setNewPRNotice(null)}
              className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-cu-hover hover:text-slate-600"
              aria-label="Dismiss new pull request notification"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-cu-border pb-3">
        {([
          {
            id: 'pullRequests',
            label: 'Pull Requests',
            icon: <GitPullRequest size={13} />,
          },
          {
            id: 'commits',
            label: 'Commits',
            icon: <GitCommit size={13} />,
          },
          {
            id: 'issues',
            label: issueCount === null ? 'Issues' : `Issues (${issueCount})`,
            icon: <AlertCircle size={13} />,
          },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl px-4 py-2 text-sm font-outfit font-semibold transition-colors ${activeTab === tab.id
                ? 'bg-cu-primary text-white shadow-sm'
                : 'text-cu-text-secondary hover:bg-cu-hover hover:text-cu-text-primary'
              }`}
          >
            <span className="inline-flex items-center gap-2">
              <span>{tab.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6">

        {/* Pull Requests */}
        {activeTab === 'pullRequests' && (
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <GitPullRequest size={15} className="text-cu-text-secondary shrink-0" />
                <h2 className="text-sm font-outfit font-bold text-cu-text-primary">
                  Pull Requests
                  {!loading && !prError && (
                    <span className="ml-1.5 text-slate-400 font-normal">({filteredPrs.length})</span>
                  )}
                </h2>
                <a
                  href={`https://github.com/${connection.repoFullName}/pulls`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-500 font-outfit font-semibold hover:underline shrink-0"
                >
                  GitHub <ExternalLink size={10} />
                </a>
              </div>

              {/* State Filter Buttons */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                {(['all', 'open', 'merged', 'closed'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => {
                      setPrFilter(filterKey);
                      setPRPage(1);
                    }}
                    className={`px-2.5 py-1 text-xs font-outfit font-semibold rounded-lg capitalize transition-all ${
                      prFilter === filterKey
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-cu-text-tertiary hover:text-cu-text-primary hover:bg-white/[0.05]'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            {loading && <SkeletonList />}

            {!loading && prError && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <p className="text-xs text-slate-500 font-outfit">{prError}</p>
                {needsGitHubConnect || prError.toLowerCase().includes('connect') ? (
                  <button onClick={onChangeRepo} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Connect to GitHub</button>
                ) : (
                  <button onClick={onRefresh} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Retry</button>
                )}
              </div>
            )}

            {!loading && !prError && filteredPrs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10">
                <GitPullRequest size={20} className="text-slate-300" />
                <p className="text-xs text-slate-400 font-outfit">
                  {prFilter === 'all' ? 'No pull requests found' : `No ${prFilter} pull requests found`}
                </p>
              </div>
            )}

            {!loading && !prError && filteredPrs.length > 0 && (() => {
              const start = (prPage - 1) * PAGE_SIZE;
              const page = filteredPrs.slice(start, start + PAGE_SIZE);
              return (
                <div className="flex flex-col gap-3">
                  {page.map((pr, i) => (
                    <motion.div key={pr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <PRCard pr={pr} />
                    </motion.div>
                  ))}
                  <PaginationBar
                    page={prPage}
                    total={filteredPrs.length}
                    onPrev={() => setPRPage(p => Math.max(1, p - 1))}
                    onNext={() => setPRPage(p => Math.min(Math.ceil(filteredPrs.length / PAGE_SIZE), p + 1))}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* Commits */}
        {activeTab === 'commits' && (
          <div className="flex flex-col gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <GitCommit size={15} className="text-cu-text-secondary shrink-0" />
              <h2 className="text-sm font-outfit font-bold text-cu-text-primary">
                Commits
                {!loading && !commitError && (
                  <span className="ml-1.5 text-slate-400 font-normal">({commits.length})</span>
                )}
              </h2>
              <a
                href={`https://github.com/${connection.repoFullName}/commits`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-blue-500 font-outfit font-semibold hover:underline shrink-0"
              >
                GitHub <ExternalLink size={10} />
              </a>
            </div>

            {loading && <SkeletonList />}

            {!loading && commitError && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                  <AlertCircle size={16} className="text-red-500" />
                </div>
                <p className="text-xs text-slate-500 font-outfit">{commitError}</p>
                {needsGitHubConnect || commitError.toLowerCase().includes('connect') ? (
                  <button onClick={onChangeRepo} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Connect to GitHub</button>
                ) : (
                  <button onClick={onRefresh} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Retry</button>
                )}
              </div>
            )}

            {!loading && !commitError && commits.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10">
                <GitCommit size={20} className="text-slate-300" />
                <p className="text-xs text-slate-400 font-outfit">No commits found</p>
              </div>
            )}

            {!loading && !commitError && commits.length > 0 && (() => {
              const start = (commitPage - 1) * PAGE_SIZE;
              const page = commits.slice(start, start + PAGE_SIZE);
              return (
                <div className="flex flex-col gap-3">
                  {page.map((commit, i) => (
                    <motion.div key={commit.sha} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <CommitCard commit={commit} />
                    </motion.div>
                  ))}
                  <PaginationBar
                    page={commitPage}
                    total={commits.length}
                    onPrev={() => setCommitPage(p => Math.max(1, p - 1))}
                    onNext={() => setCommitPage(p => Math.min(Math.ceil(commits.length / PAGE_SIZE), p + 1))}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* Issues */}
        <div className={activeTab === 'issues' ? '' : 'hidden'}>
          <IssuesPanel
            projectId={projectId}
            repoFullName={connection.repoFullName}
            issues={issues}
            loading={loading}
            error={issueError}
            onCountChange={setIssueCount}
            onRequireLogin={onChangeRepo}
            onRefresh={onRefresh}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────
export default function GitHubProjectPage({ projectId }: { projectId: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [connection, setConnection] = useState<ProjectGitHubConnection | null>(null);
  const [routeState, setRouteState] = useState<GitHubRouteState>('initializing');
  const [routeError, setRouteError] = useState<string | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [prs, setPRs] = useState<GitHubPullRequest[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [prError, setPRError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [socketToken, setSocketToken] = useState<string | null>(null);
  const [automationRules, setAutomationRules] = useState<GithubAutomationRule[]>([]);
  const [automationLogs, setAutomationLogs] = useState<GithubAutomationLog[]>([]);
  const [automationRulesLoading, setAutomationRulesLoading] = useState(false);
  const [automationLogsLoading, setAutomationLogsLoading] = useState(false);
  const [automationRulesError, setAutomationRulesError] = useState<string | null>(null);
  const [automationLogsError, setAutomationLogsError] = useState<string | null>(null);
  const [showAutomationBuilder, setShowAutomationBuilder] = useState(false);
  const [canChangeRepo, setCanChangeRepo] = useState(false);
  const [isPostLogout, setIsPostLogout] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedGitHubAccount[]>([]);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [projectMembers, setProjectMembers] = useState<Member[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [allRepos, setAllRepos] = useState<GitHubRepository[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<GithubCollaboratorInviteResponse | null>(null);

  const resolveBackendConnectionAfterConflict = useCallback(async (): Promise<ProjectGitHubConnection | null> => {
    try {
      return await fetchProjectGitHubConnection(projectId);
    } catch {
      return null;
    }
  }, [projectId]);

  const initializeGitHubView = useCallback(async () => {
    setRouteState('initializing');
    setRouteError(null);
    setConnection(null);

    try {
      const token = await ensureValidToken({ allowCookieRefresh: true });
      setSocketToken(token);

      if (!token) {
        setRouteState('needsAppAuth');
        return;
      }

      const status = await fetchGitHubConnectionStatus().catch(() => ({ connected: false }));
      if (!status.connected) {
        setRouteState('needsGitHubAccount');
        return;
      }

      const backendConnection = await fetchProjectGitHubConnection(projectId);
      if (backendConnection) {
        setProjectGitHubConnection(projectId, backendConnection);
        setConnection(backendConnection);
        setRouteState('connected');
        return;
      }

      const legacyConnection = getProjectGitHubRepo(projectId);
      if (legacyConnection?.repoFullName) {
        try {
          const persistedConnection = await persistProjectGitHubConnection(projectId, legacyConnection.repoFullName);
          const mergedConnection = {
            ...persistedConnection,
            private: legacyConnection.private,
            defaultBranch: legacyConnection.defaultBranch || persistedConnection.defaultBranch,
          };
          setProjectGitHubConnection(projectId, mergedConnection);
          setConnection(mergedConnection);
          setRouteState('connected');
          return;
        } catch (error) {
          const existingConnection = await resolveBackendConnectionAfterConflict();
          if (existingConnection) {
            setProjectGitHubConnection(projectId, existingConnection);
            setConnection(existingConnection);
            setRouteState('connected');
            return;
          }
          throw error;
        }
      }

      setRouteState('needsRepository');
    } catch (error) {
      setRouteError(error instanceof Error ? error.message : 'The GitHub project connection failed to load.');
      setRouteState('error');
    }
  }, [projectId, resolveBackendConnectionAfterConflict]);

  useEffect(() => {
    queueMicrotask(() => void initializeGitHubView());
  }, [initializeGitHubView]);

  useEffect(() => {
    localStorage.removeItem('github_force_relogin');
    queueMicrotask(() => setSavedAccounts(getSavedGitHubAccounts()));
  }, []);

  useEffect(() => {
    const currentUser = getUserFromToken();
    if (!currentUser?.userId) return;
    fetchMembers(projectId)
      .then(members => {
        setProjectMembers(members);
        const me = members.find(m => getMemberUserId(m) === currentUser.userId);
        setCanChangeRepo(me?.role === 'OWNER' || me?.role === 'ADMIN');
      })
      .catch(() => { });
  }, [projectId]);

  const loadData = useCallback(async (_conn: ProjectGitHubConnection) => {
    setLoading(true);
    setPRError(null);
    setCommitError(null);
    setIssueError(null);

    let isGitHubConnected = false;
    try {
      const status = await fetchGitHubConnectionStatus();
      isGitHubConnected = status.connected;
    } catch {
      isGitHubConnected = false;
    }

    if (!isGitHubConnected) {
      setPRs([]);
      setCommits([]);
      setIssues([]);
      setUser(null);
      setPRError(githubConnectRequiredMessage);
      setCommitError(githubConnectRequiredMessage);
      setIssueError(githubConnectRequiredMessage);
      setLoading(false);
      return;
    }

    const [prResult, commitResult, issueResult, userResult] = await Promise.allSettled([
      fetchProjectPullRequests(projectId, _conn?.repoFullName),
      fetchProjectCommits(projectId, _conn?.repoFullName),
      fetchProjectIssues(projectId, _conn?.repoFullName),
      fetchGitHubUser(),
    ]);

    if (prResult.status === 'fulfilled') setPRs(prResult.value);
    else setPRError(prResult.reason instanceof Error ? prResult.reason.message : 'Failed to load pull requests');

    if (commitResult.status === 'fulfilled') setCommits(commitResult.value);
    else setCommitError(commitResult.reason instanceof Error ? commitResult.reason.message : 'Failed to load commits');

    if (issueResult.status === 'fulfilled') setIssues(issueResult.value);
    else setIssueError(issueResult.reason instanceof Error ? issueResult.reason.message : 'Failed to load issues');

    if (userResult.status === 'fulfilled') {
      const githubUser = userResult.value;
      setUser(githubUser);
      upsertSavedGitHubAccount({ login: githubUser.login, name: githubUser.name, avatarUrl: githubUser.avatar_url });
      setSavedAccounts(getSavedGitHubAccounts());
    }
    setLoading(false);
  }, [projectId]);

  const loadIssues = useCallback(async (_conn: ProjectGitHubConnection) => {
    let isGitHubConnected = false;
    try {
      const status = await fetchGitHubConnectionStatus();
      isGitHubConnected = status.connected;
    } catch {
      isGitHubConnected = false;
    }

    if (!isGitHubConnected) {
      setIssues([]);
      setIssueError(githubConnectRequiredMessage);
      return;
    }

    try {
      const latestIssues = await fetchProjectIssues(projectId, _conn?.repoFullName);
      setIssues(latestIssues);
      setIssueError(null);
    } catch (error) {
      setIssueError(error instanceof Error ? error.message : 'Failed to load issues');
    }
  }, [projectId]);

  useEffect(() => {
    if (connection) queueMicrotask(() => void loadData(connection));
  }, [connection, loadData]);

  const loadAutomationRules = useCallback(async () => {
    if (!connection) return;

    setAutomationRulesLoading(true);
    setAutomationRulesError(null);

    try {
      const rules = await fetchGitHubAutomationRules(projectId);
      setAutomationRules(rules);
    } catch (error) {
      setAutomationRulesError(error instanceof Error ? error.message : 'Failed to load automation rules');
    } finally {
      setAutomationRulesLoading(false);
    }
  }, [connection, projectId]);

  const loadAutomationLogs = useCallback(async () => {
    if (!connection) return;

    setAutomationLogsLoading(true);
    setAutomationLogsError(null);

    try {
      const logs = await fetchGitHubAutomationLogs(projectId);
      setAutomationLogs(logs);
    } catch (error) {
      setAutomationLogsError(error instanceof Error ? error.message : 'Failed to load automation logs');
    } finally {
      setAutomationLogsLoading(false);
    }
  }, [connection, projectId]);

  useEffect(() => {
    if (connection) {
      queueMicrotask(() => {
        void loadAutomationRules();
        void loadAutomationLogs();
      });
    } else {
      queueMicrotask(() => {
        setAutomationRules([]);
        setAutomationLogs([]);
        setAutomationRulesError(null);
        setAutomationLogsError(null);
      });
    }
  }, [connection, loadAutomationLogs, loadAutomationRules]);

  const loadRepos = useCallback(async () => {
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const status = await fetchGitHubConnectionStatus();
      if (!status.connected) {
        setAllRepos([]);
        setRepoError(githubConnectRequiredMessage);
        return;
      }
      const data = await fetchRepositories();
      setAllRepos(data);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('select_repo') !== '1') return;
    router.replace(`/github/${projectId}`);
    queueMicrotask(() => {
      setShowModal(true);
      void loadRepos();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectGitHub = (loginHint?: string) => {
    if (!GITHUB_CLIENT_ID) {
      toast('GitHub OAuth is not configured. Please set NEXT_PUBLIC_GITHUB_CLIENT_ID.', 'error');
      return;
    }
    const redirectUri = `${window.location.origin}/github/callback`;
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: 'repo user:email',
      state: projectId,
      redirect_uri: redirectUri,
    });
    if (loginHint !== undefined) params.set('login', loginHint);
    window.location.href = `https://github.com/login/oauth/authorize?${params}`;
  };

  const handleInitiateConnect = () => {
    if (savedAccounts.length > 0) setShowAccountPicker(true);
    else handleConnectGitHub();
  };

  const handleOpenModal = async () => {
    let isGitHubConnected = false;
    try {
      const status = await fetchGitHubConnectionStatus();
      isGitHubConnected = status.connected;
    } catch {
      isGitHubConnected = false;
    }

    if (!isGitHubConnected) {
      if (savedAccounts.length > 0) setShowAccountPicker(true);
      else handleConnectGitHub();
      return;
    }
    setShowModal(true);
    await loadRepos();
  };

  const handleSelectRepo = async (repo: GitHubRepository) => {
    setLoadingRepos(true);
    setRepoError(null);
    setPRs([]);
    setCommits([]);
    setIssues([]);
    setPRError(null);
    setCommitError(null);
    setIssueError(null);

    try {
      const persistedConnection = await persistProjectGitHubConnection(projectId, repo.full_name);
      const newConn: ProjectGitHubConnection = {
        ...persistedConnection,
        repoId: persistedConnection.repoId || repo.id,
        repoName: repo.name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        ownerLogin: repo.owner.login,
      };
      setProjectGitHubConnection(projectId, newConn);
      setConnection(newConn);
      setRouteState('connected');
      setIsPostLogout(false);
      setShowModal(false);
      setRepoSearch('');
      void loadData(newConn);
    } catch (error) {
      const existingConnection = await resolveBackendConnectionAfterConflict();
      if (existingConnection) {
        setProjectGitHubConnection(projectId, existingConnection);
        setConnection(existingConnection);
        setRouteState('connected');
        setIsPostLogout(false);
        setShowModal(false);
        setRepoSearch('');
        void loadData(existingConnection);
        return;
      }

      setRepoError(error instanceof Error ? error.message : 'Failed to link repository to this project.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const handleOpenInviteModal = () => {
    setInviteError(null);
    setInviteResult(null);
    setShowInviteModal(true);
  };

  const handleInviteCollaborator = async (identifier: string, permission: GithubCollaboratorPermission) => {
    setInviteLoading(true);
    setInviteError(null);
    setInviteResult(null);

    try {
      const result = await inviteGitHubCollaborator(projectId, {
        identifier: identifier.trim(),
        permission,
      });
      setInviteResult(result);
      toast(result.githubStatus === 201 ? 'GitHub invitation sent' : 'GitHub collaborator updated', 'success');
    } catch (error) {
      setInviteError(getApiErrorMessage(error, 'Failed to invite GitHub collaborator.'));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/api/github/revoke');
      // Fetch the updated user profile from the backend to clear GitHub identity fields in local cache.
      const profileRes = await api.get('/api/user/profile');
      if (profileRes.data) {
        localStorage.setItem('userProfile', JSON.stringify(profileRes.data));
      } else {
        localStorage.removeItem('userProfile');
      }
    } catch {
      // Fallback: manually delete GitHub identity fields from userProfile in localStorage if request fails.
      const profile = localStorage.getItem('userProfile');
      if (profile) {
        try {
          const parsed = JSON.parse(profile);
          delete parsed.githubUsername;
          delete parsed.githubEmail;
          localStorage.setItem('userProfile', JSON.stringify(parsed));
        } catch {
          localStorage.removeItem('userProfile');
        }
      }
    }
    clearProjectGitHubRepo(projectId);
    setIsPostLogout(true);
    setConnection(null);
    setRouteState('needsGitHubAccount');
    setRouteError(null);
    setUser(null);
    setPRs([]);
    setCommits([]);
    setAutomationRules([]);
    setAutomationLogs([]);
    setAutomationRulesError(null);
    setAutomationLogsError(null);
    setShowAutomationBuilder(false);
  };

  const handleAutomationRuleCreated = (rule: GithubAutomationRule) => {
    setAutomationRules((current) => [rule, ...current.filter((existing) => existing.id !== rule.id)]);
  };

  const handleDeleteAutomationRule = async (ruleId: number) => {
    try {
      await deleteGitHubAutomationRule(projectId, ruleId);
      setAutomationRules((current) => current.filter((rule) => rule.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete GitHub automation rule:', error);
      setAutomationRulesError(error instanceof Error ? error.message : 'Failed to delete automation rule');
    }
  };

  const handleToggleAutomationRule = async (ruleId: number, enabled: boolean) => {
    try {
      const updated = await setGitHubAutomationRuleEnabled(projectId, ruleId, enabled);
      setAutomationRules((current) => current.map((rule) => (rule.id === ruleId ? updated : rule)));
    } catch (error) {
      console.error('Failed to toggle GitHub automation rule:', error);
      setAutomationRulesError(error instanceof Error ? error.message : 'Failed to update automation rule');
    }
  };

  const handlePRUpdate = useCallback(async (update: GithubPRUpdate) => {
    if (!connection) return;

    if (update.type === 'opened') {
      try {
        await loadData(connection);
        setPRError(null);
      } catch (error) {
        setPRError(error instanceof Error
          ? error.message
          : `Received PR update #${update.prNumber}, but could not refresh the details.`);
      }
      return;
    }

    setPRs((current) => current.map((pr) => {
      if (pr.number !== update.prNumber) return pr;
      return {
        ...pr,
        state: 'closed',
        merged_at: update.type === 'merged' ? (pr.merged_at ?? new Date().toISOString()) : null,
        updated_at: new Date().toISOString(),
      };
    }));
  }, [connection, loadData]);

  const handleIssueUpdate = useCallback(() => {
    if (!connection) return;

    void loadIssues(connection);
  }, [connection, loadIssues]);

  const handleRefreshDashboard = useCallback(async () => {
    if (!connection) return;

    try {
      await syncProjectGitHub(projectId);
    } catch {
      // The local dashboard can still refresh from cached/project data when sync is unavailable.
    }

    await loadData(connection);
    void loadAutomationRules();
    void loadAutomationLogs();
  }, [connection, loadAutomationLogs, loadAutomationRules, loadData, projectId]);

  const filteredRepos = allRepos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  const connectedDashboard = connection ? (
    <ConnectedDashboard
      key={connection.repoFullName}
      projectId={projectId}
      connection={connection}
      prs={prs}
      commits={commits}
      issues={issues}
      loading={loading}
      prError={prError}
      commitError={commitError}
      issueError={issueError}
      user={user}
      onRefresh={() => void handleRefreshDashboard()}
      onLogout={() => void handleLogout()}
      onChangeRepo={handleOpenModal}
      onInviteCollaborator={handleOpenInviteModal}
      onPRUpdate={(update) => void handlePRUpdate(update)}
      onIssueUpdate={() => void handleIssueUpdate()}
      automationRules={automationRules}
      automationRulesLoading={automationRulesLoading}
      automationRulesError={automationRulesError}
      onCreateAutomationRule={() => setShowAutomationBuilder(true)}
      onDeleteAutomationRule={(ruleId) => void handleDeleteAutomationRule(ruleId)}
      onToggleAutomationRule={(ruleId, enabled) => void handleToggleAutomationRule(ruleId, enabled)}
      onRefreshAutomationRules={() => void loadAutomationRules()}
      automationLogs={automationLogs}
      automationLogsLoading={automationLogsLoading}
      automationLogsError={automationLogsError}
      onRefreshAutomationLogs={() => void loadAutomationLogs()}
      canChangeRepo={canChangeRepo}
    />
  ) : null;

  const routeContent = (() => {
    if (routeState === 'initializing') {
      return <InitializingView />;
    }

    if (routeState === 'needsAppAuth') {
      return <AppAuthRequiredView onLogin={() => router.replace('/login')} />;
    }

    if (routeState === 'needsGitHubAccount') {
      return (
        <DisconnectedView
          key="disconnected"
          onConnect={handleInitiateConnect}
          onLogout={() => void handleLogout()}
          isPostLogout={isPostLogout}
        />
      );
    }

    if (routeState === 'needsRepository') {
      return <RepositoryRequiredView onSelectRepo={() => void handleOpenModal()} loading={loadingRepos} />;
    }

    if (routeState === 'error') {
      return (
        <GitHubRouteErrorView
          message={routeError ?? 'The GitHub project data failed to load.'}
          onRetry={() => void initializeGitHubView()}
        />
      );
    }

    if (connection) {
      return socketToken ? (
        <StompProvider token={socketToken}>{connectedDashboard}</StompProvider>
      ) : connectedDashboard;
    }

    return (
      <GitHubRouteErrorView
        message="The GitHub project connection is missing. Retry to resolve the linked repository."
        onRetry={() => void initializeGitHubView()}
      />
    );
  })();

  return (
    <div className={`w-full px-6 py-6 ${routeState === 'connected' ? '' : 'min-h-[calc(100vh-130px)] flex flex-col items-center justify-center'}`}>
      <AnimatePresence mode="wait">
        {routeContent}
      </AnimatePresence>


        <AnimatePresence>
          {showModal && (
            <RepoModal
              repos={filteredRepos}
              search={repoSearch}
              loading={loadingRepos}
              error={repoError}
              onSearch={setRepoSearch}
              onSelect={handleSelectRepo}
              onClose={() => { setShowModal(false); setRepoSearch(''); }}
              onRefresh={() => void loadRepos()}
            />
          )}
        </AnimatePresence>

      <AnimatePresence>
        {showAutomationBuilder && connection && (
          <AutomationRuleBuilder
            projectId={projectId}
            onCreated={handleAutomationRuleCreated}
            onClose={() => setShowAutomationBuilder(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInviteModal && connection && (
          <InviteCollaboratorModal
            repoFullName={connection.repoFullName}
            members={projectMembers}
            loading={inviteLoading}
            error={inviteError}
            result={inviteResult}
            onSubmit={(identifier, permission) => void handleInviteCollaborator(identifier, permission)}
            onClose={() => setShowInviteModal(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAccountPicker && (
          <AccountPickerModal
            accounts={savedAccounts}
            onSelect={login => { setShowAccountPicker(false); handleConnectGitHub(login); }}
            onAddAccount={() => { setShowAccountPicker(false); handleConnectGitHub(''); }}
            onClose={() => setShowAccountPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
