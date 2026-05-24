'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Globe, Lock, RefreshCw, Search, X, Check, Link2,
  LogOut, User, ExternalLink, GitPullRequest, ChevronDown, AlertCircle, GitCommit,
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  getProjectGitHubRepo,
  setProjectGitHubRepo,
  clearProjectGitHubRepo,
  getGitHubToken,
  clearGitHubToken,
  fetchRepositoriesWithToken,
  fetchGitHubUser,
  fetchPullRequests,
  fetchCommits,
  type GitHubRepository,
  type GitHubPullRequest,
  type GitHubCommit,
  type GitHubUser,
  type ProjectGitHubConnection,
} from '@/services/githubService';

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function prStatus(pr: GitHubPullRequest): { label: string; color: string; dot: string } {
  if (pr.draft) return { label: 'Draft', color: 'text-slate-500 bg-slate-100 border-slate-200', dot: 'bg-slate-400' };
  if (pr.merged_at) return { label: 'Merged', color: 'text-purple-700 bg-purple-50 border-purple-200', dot: 'bg-purple-500' };
  if (pr.state === 'closed') return { label: 'Closed', color: 'text-red-700 bg-red-50 border-red-200', dot: 'bg-red-500' };
  return { label: 'Open', color: 'text-green-700 bg-green-50 border-green-200', dot: 'bg-green-500' };
}

// ── GitHub SVG mark ───────────────────────────────────────────────────────────
function GitHubMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 98 96" fill="currentColor" className={className}>
      <path fillRule="evenodd" clipRule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z" />
    </svg>
  );
}

// ── Disconnected state ────────────────────────────────────────────────────────
function DisconnectedView({ onConnect }: { onConnect: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center gap-6 max-w-md w-full text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
        <GitHubMark size={40} className="text-white" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-outfit font-bold text-slate-800">Connect to GitHub</h2>
        <p className="text-sm text-slate-500 font-outfit leading-relaxed">
          Link this project to a GitHub repository to track pull requests and activity.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full text-left bg-slate-50 rounded-2xl p-4 border border-slate-100">
        {['View last 10 pull requests', 'Track open, merged & closed PRs', 'See branch and author details'].map(item => (
          <div key={item} className="flex items-center gap-2.5">
            <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Check size={10} className="text-green-600" strokeWidth={3} />
            </div>
            <span className="text-sm text-slate-600 font-outfit">{item}</span>
          </div>
        ))}
      </div>
      <motion.button
        onClick={onConnect}
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.97 }}
        className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-slate-900 text-white font-outfit font-bold text-sm shadow-[0_4px_20px_rgba(0,0,0,0.25)] hover:bg-slate-800 transition-colors"
      >
        <GitHubMark size={18} className="text-white" />
        Connect to GitHub
      </motion.button>
      {!GITHUB_CLIENT_ID && (
        <p className="text-xs text-amber-600 font-outfit bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
          Set <code className="font-mono">NEXT_PUBLIC_GITHUB_CLIENT_ID</code> to enable GitHub OAuth.
        </p>
      )}
    </motion.div>
  );
}

// ── PR Card ───────────────────────────────────────────────────────────────────
function PRCard({ pr }: { pr: GitHubPullRequest }) {
  const status = prStatus(pr);
  return (
    <motion.a
      href={pr.html_url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(0,0,0,0.10)' }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-colors group"
    >
      {/* Top row: number + status + date */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs font-outfit font-bold text-slate-400">
          <GitPullRequest size={12} />
          #{pr.number}
        </span>
        <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-outfit font-semibold border ${status.color}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
          {status.label}
        </span>
        <span className="ml-auto text-[11px] text-slate-400 font-outfit shrink-0">
          {timeAgo(pr.updated_at)}
        </span>
      </div>

      {/* Title */}
      <p className="text-sm font-outfit font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
        {pr.title}
      </p>

      {/* Branch row */}
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-outfit">
        <GitBranch size={11} />
        <span className="font-semibold text-slate-500">{pr.head.ref}</span>
        <span>→</span>
        <span>{pr.base.ref}</span>
      </div>

      {/* Author + labels */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Image
            src={pr.user.avatar_url}
            alt={pr.user.login}
            width={18}
            height={18}
            className="rounded-full"
            unoptimized
          />
          <span className="text-[11px] text-slate-500 font-outfit">@{pr.user.login}</span>
        </div>
        {pr.labels.slice(0, 3).map(label => (
          <span
            key={label.id}
            className="px-1.5 py-0.5 rounded-full text-[10px] font-outfit font-semibold"
            style={{
              backgroundColor: `#${label.color}22`,
              color: `#${label.color}`,
              border: `1px solid #${label.color}44`,
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
  const firstLine = commit.commit.message.split('\n')[0];
  const shortSha = commit.sha.slice(0, 7);
  const authorName = commit.author?.login ?? commit.commit.author.name;
  const avatarUrl = commit.author?.avatar_url ?? null;

  return (
    <motion.a
      href={commit.html_url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 28px rgba(0,0,0,0.10)' }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex flex-col gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-colors group"
    >
      {/* SHA + date */}
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
          <GitCommit size={11} />
          {shortSha}
        </span>
        <span className="ml-auto text-[11px] text-slate-400 font-outfit shrink-0">
          {timeAgo(commit.commit.author.date)}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm font-outfit font-semibold text-slate-800 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
        {firstLine}
      </p>

      {/* Author */}
      <div className="flex items-center gap-1.5">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={authorName} width={18} height={18} className="rounded-full" unoptimized />
        ) : (
          <div className="w-[18px] h-[18px] rounded-full bg-slate-200 flex items-center justify-center shrink-0">
            <User size={10} className="text-slate-400" />
          </div>
        )}
        <span className="text-[11px] text-slate-500 font-outfit">@{authorName}</span>
      </div>
    </motion.a>
  );
}

// ── Account dropdown ──────────────────────────────────────────────────────────
function AccountDropdown({
  user,
  onLogout,
  onChangeRepo,
}: {
  user: GitHubUser | null;
  onLogout: () => void;
  onChangeRepo: () => void;
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
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm"
      >
        {user?.avatar_url ? (
          <Image src={user.avatar_url} alt={user.login} width={20} height={20} className="rounded-full" unoptimized />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center">
            <User size={11} className="text-slate-500" />
          </div>
        )}
        <span className="text-xs font-outfit font-semibold text-slate-700">
          {user?.login ?? 'Account'}
        </span>
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-60 bg-white border border-slate-200 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden z-[300]"
          >
            {/* Account info */}
            <div className="px-4 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                {user?.avatar_url ? (
                  <Image src={user.avatar_url} alt={user.login} width={36} height={36} className="rounded-full" unoptimized />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center">
                    <User size={16} className="text-slate-400" />
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-outfit font-bold text-slate-800 truncate">
                    {user?.name ?? user?.login ?? '—'}
                  </span>
                  <span className="text-xs text-slate-400 font-outfit truncate">@{user?.login}</span>
                </div>
              </div>
              {user && (
                <a
                  href={user.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 flex items-center gap-1.5 text-xs text-blue-500 font-outfit font-semibold hover:underline"
                >
                  <ExternalLink size={11} />
                  View GitHub profile
                </a>
              )}
            </div>

            {/* Actions */}
            <div className="py-1.5">
              <button
                onClick={() => { setOpen(false); onChangeRepo(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-outfit font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <Link2 size={14} className="text-slate-400" />
                Change repository
              </button>
              <button
                onClick={() => { setOpen(false); onLogout(); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-outfit font-semibold text-red-600 hover:bg-red-50 transition-colors text-left"
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="bg-white rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.18)] w-full max-w-lg overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <GitHubMark size={18} className="text-slate-800" />
            <span className="font-outfit font-bold text-slate-800 text-base">Select a repository</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRefresh} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40" title="Refresh">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <Search size={14} className="text-slate-400 shrink-0" />
            <input autoFocus type="text" placeholder="Search repositories…" value={search} onChange={e => onSearch(e.target.value)}
              className="flex-1 text-sm font-outfit bg-transparent outline-none text-slate-700 placeholder:text-slate-400" />
            {search && <button onClick={() => onSearch('')} className="text-slate-400 hover:text-slate-600"><X size={13} /></button>}
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <div className="w-8 h-8 rounded-xl bg-slate-100 animate-pulse" />
              <span className="text-sm text-slate-400 font-outfit">Loading repositories…</span>
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center">
                <X size={16} className="text-red-500" />
              </div>
              <p className="text-sm text-slate-600 font-outfit">{error}</p>
              <button onClick={onRefresh} className="text-sm text-blue-600 font-outfit font-semibold hover:underline">Try again</button>
            </div>
          )}
          {!loading && !error && repos.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12">
              <span className="text-sm text-slate-400 font-outfit">No repositories found</span>
            </div>
          )}
          {!loading && !error && repos.length > 0 && (
            <ul className="py-1.5">
              {repos.map(repo => (
                <li key={repo.id}>
                  <button onClick={() => onSelect(repo)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:bg-slate-200 transition-colors">
                      <GitHubMark size={14} className="text-slate-600" />
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-outfit font-semibold text-slate-800 truncate">{repo.full_name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-slate-400 font-outfit"><GitBranch size={10} />{repo.default_branch}</span>
                        <span className={`flex items-center gap-1 text-[11px] font-outfit ${repo.private ? 'text-slate-400' : 'text-blue-400'}`}>
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
  );
}

// ── Shared skeleton loader ────────────────────────────────────────────────────
function SkeletonList() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-[120px] rounded-2xl bg-slate-100 animate-pulse" />
      ))}
    </div>
  );
}

// ── Connected dashboard ───────────────────────────────────────────────────────
function ConnectedDashboard({
  connection,
  prs,
  commits,
  loading,
  prError,
  commitError,
  user,
  onRefresh,
  onLogout,
  onChangeRepo,
}: {
  connection: ProjectGitHubConnection;
  prs: GitHubPullRequest[];
  commits: GitHubCommit[];
  loading: boolean;
  prError: string | null;
  commitError: string | null;
  user: GitHubUser | null;
  onRefresh: () => void;
  onLogout: () => void;
  onChangeRepo: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full flex flex-col gap-5"
    >
      {/* ── Top bar (unchanged) ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 shadow-sm">
          <GitHubMark size={14} className="text-white" />
          <span className="text-xs font-outfit font-bold text-white truncate max-w-[220px]">
            {connection.repoFullName}
          </span>
          <span className={`flex items-center gap-1 text-[10px] font-outfit px-1.5 py-0.5 rounded-full ${
            connection.private ? 'bg-slate-700 text-slate-300' : 'bg-blue-500/20 text-blue-300'
          }`}>
            {connection.private ? <Lock size={8} /> : <Globe size={8} />}
            {connection.private ? 'Private' : 'Public'}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-outfit text-slate-400">
            <GitBranch size={10} />
            {connection.defaultBranch}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm text-slate-500 hover:text-slate-700 disabled:opacity-40"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={onChangeRepo}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm text-xs font-outfit font-semibold text-slate-700"
          >
            <Link2 size={13} />
            Change repo
          </button>
          <AccountDropdown user={user} onLogout={onLogout} onChangeRepo={onChangeRepo} />
        </div>
      </div>

      {/* ── Two-column content ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-6">

        {/* ── Left: Pull Requests ──────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <GitPullRequest size={15} className="text-slate-500 shrink-0" />
            <h2 className="text-sm font-outfit font-bold text-slate-700">
              Pull Requests
              {!loading && !prError && (
                <span className="ml-1.5 text-slate-400 font-normal">({prs.length})</span>
              )}
            </h2>
            <a
              href={`https://github.com/${connection.repoFullName}/pulls`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 text-xs text-blue-500 font-outfit font-semibold hover:underline shrink-0"
            >
              GitHub <ExternalLink size={10} />
            </a>
          </div>

          {loading && <SkeletonList />}

          {!loading && prError && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertCircle size={16} className="text-red-500" />
              </div>
              <p className="text-xs text-slate-500 font-outfit">{prError}</p>
              <button onClick={onRefresh} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Retry</button>
            </div>
          )}

          {!loading && !prError && prs.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <GitPullRequest size={20} className="text-slate-300" />
              <p className="text-xs text-slate-400 font-outfit">No pull requests found</p>
            </div>
          )}

          {!loading && !prError && prs.length > 0 && (
            <div className="flex flex-col gap-3">
              {prs.map((pr, i) => (
                <motion.div key={pr.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <PRCard pr={pr} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* ── Right: Commits ───────────────────────────────────────── */}
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-center gap-2">
            <GitCommit size={15} className="text-slate-500 shrink-0" />
            <h2 className="text-sm font-outfit font-bold text-slate-700">
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
              <button onClick={onRefresh} className="text-xs text-blue-600 font-outfit font-semibold hover:underline">Retry</button>
            </div>
          )}

          {!loading && !commitError && commits.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <GitCommit size={20} className="text-slate-300" />
              <p className="text-xs text-slate-400 font-outfit">No commits found</p>
            </div>
          )}

          {!loading && !commitError && commits.length > 0 && (
            <div className="flex flex-col gap-3">
              {commits.map((commit, i) => (
                <motion.div key={commit.sha} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <CommitCard commit={commit} />
                </motion.div>
              ))}
            </div>
          )}
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
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [prs, setPRs] = useState<GitHubPullRequest[]>([]);
  const [commits, setCommits] = useState<GitHubCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [prError, setPRError] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Repo modal state
  const [showModal, setShowModal] = useState(false);
  const [allRepos, setAllRepos] = useState<GitHubRepository[]>([]);
  const [repoSearch, setRepoSearch] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);

  useEffect(() => {
    setConnection(getProjectGitHubRepo(projectId));
  }, [projectId]);

  const loadData = useCallback(async (conn: ProjectGitHubConnection) => {
    const token = getGitHubToken();
    if (!token) return;
    setLoading(true);
    setPRError(null);
    setCommitError(null);
    const [prResult, commitResult, userResult] = await Promise.allSettled([
      fetchPullRequests(token, conn.ownerLogin, conn.repoName),
      fetchCommits(token, conn.ownerLogin, conn.repoName),
      fetchGitHubUser(token),
    ]);
    if (prResult.status === 'fulfilled') setPRs(prResult.value);
    else setPRError(prResult.reason instanceof Error ? prResult.reason.message : 'Failed to load pull requests');
    if (commitResult.status === 'fulfilled') setCommits(commitResult.value);
    else setCommitError(commitResult.reason instanceof Error ? commitResult.reason.message : 'Failed to load commits');
    if (userResult.status === 'fulfilled') setUser(userResult.value);
    setLoading(false);
  }, []);

  // Auto-load data when connection is set
  useEffect(() => {
    if (connection) void loadData(connection);
  }, [connection, loadData]);

  const loadRepos = useCallback(async () => {
    const token = getGitHubToken();
    if (!token) return;
    setLoadingRepos(true);
    setRepoError(null);
    try {
      const data = await fetchRepositoriesWithToken(token);
      setAllRepos(data);
    } catch (err) {
      setRepoError(err instanceof Error ? err.message : 'Failed to load repositories');
    } finally {
      setLoadingRepos(false);
    }
  }, []);

  // After returning from GitHub OAuth
  useEffect(() => {
    if (searchParams.get('select_repo') !== '1') return;
    router.replace(`/github/${projectId}`);
    setShowModal(true);
    void loadRepos();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnectGitHub = () => {
    if (!GITHUB_CLIENT_ID) {
      alert('GitHub OAuth is not configured.\nPlease set NEXT_PUBLIC_GITHUB_CLIENT_ID.');
      return;
    }
    const redirectUri = `${window.location.origin}/github/callback`;
    window.location.href =
      `https://github.com/login/oauth/authorize` +
      `?client_id=${GITHUB_CLIENT_ID}&scope=repo&state=${projectId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}`;
  };

  const handleOpenModal = async () => {
    const token = getGitHubToken();
    if (!token) { handleConnectGitHub(); return; }
    setShowModal(true);
    await loadRepos();
  };

  const handleSelectRepo = (repo: GitHubRepository) => {
    setProjectGitHubRepo(projectId, repo);
    const newConn = getProjectGitHubRepo(projectId)!;
    setConnection(newConn);
    setShowModal(false);
    setRepoSearch('');
    void loadData(newConn);
  };

  const handleLogout = async () => {
    const token = getGitHubToken();
    if (token) {
      try {
        await fetch('/api/github/revoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } catch { /* ignore */ }
    }
    clearGitHubToken();
    clearProjectGitHubRepo(projectId);
    setConnection(null);
    setUser(null);
    setPRs([]);
    setCommits([]);
  };

  const filteredRepos = allRepos.filter(r =>
    r.full_name.toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <div className={`w-full px-6 py-6 ${connection ? '' : 'min-h-[calc(100vh-130px)] flex flex-col items-center justify-center'}`}>
      <AnimatePresence mode="wait">
        {connection ? (
          <ConnectedDashboard
            key="dashboard"
            connection={connection}
            prs={prs}
            commits={commits}
            loading={loading}
            prError={prError}
            commitError={commitError}
            user={user}
            onRefresh={() => void loadData(connection)}
            onLogout={() => void handleLogout()}
            onChangeRepo={handleOpenModal}
          />
        ) : (
          <DisconnectedView key="disconnected" onConnect={handleConnectGitHub} />
        )}
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
    </div>
  );
}
