import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/axios';
import { getCurrentUserId } from '../auth/storage';

const REPO_PREFIX = 'github_repo_';
const BACKEND_GITHUB_TOKEN_SENTINEL = 'backend-managed';
const SAVED_ACCOUNTS_PREFIX = 'planora:github:saved-accounts:';

async function userScopedKey(prefix: string, suffix = ''): Promise<string> {
  const userId = await getCurrentUserId();
  return `${prefix}${userId ?? 'anonymous'}${suffix}`;
}

async function projectRepoCacheKey(projectId: string): Promise<string> {
  return userScopedKey(`${REPO_PREFIX}`, `:${projectId}`);
}

// ── Backend-managed GitHub connection ─────────────────────────────────────────
export async function getGitHubToken(): Promise<string | null> {
  const data = await fetchGitHubConnectionStatus();
  return data.connected ? BACKEND_GITHUB_TOKEN_SENTINEL : null;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  username?: string;
}

export async function fetchGitHubConnectionStatus(): Promise<GitHubConnectionStatus> {
  const { data } = await api.get<GitHubConnectionStatus>('/api/github/status');
  return data;
}

export async function startMobileGitHubOAuth(
  destination: 'PROFILE' | 'PROJECT',
  projectId?: string,
  loginHint?: string,
): Promise<{ authorizationUrl: string; expiresInSeconds: number }> {
  const { data } = await api.post<{ authorizationUrl: string; expiresInSeconds: number }>(
    '/api/github/mobile/oauth/start',
    {
      destination,
      ...(projectId ? { projectId: Number(projectId) } : {}),
      ...(loginHint?.trim() ? { loginHint: loginHint.trim() } : {}),
    },
  );
  return data;
}

export async function saveGitHubToken(_token: string): Promise<void> {
  // GitHub access tokens are stored by the backend. Kept as a no-op for the screen flow.
}

export async function clearGitHubToken(): Promise<void> {
  await api.post('/api/github/revoke');
}

export interface SavedGitHubAccount {
  login: string;
  name: string | null;
  avatarUrl: string;
}

export async function getSavedGitHubAccounts(): Promise<SavedGitHubAccount[]> {
  const key = await userScopedKey(SAVED_ACCOUNTS_PREFIX);
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? JSON.parse(value) as SavedGitHubAccount[] : [];
  } catch {
    return [];
  }
}

export async function saveGitHubAccount(user: GitHubUser): Promise<void> {
  const key = await userScopedKey(SAVED_ACCOUNTS_PREFIX);
  const current = await getSavedGitHubAccounts();
  const next: SavedGitHubAccount = { login: user.login, name: user.name, avatarUrl: user.avatar_url };
  await AsyncStorage.setItem(key, JSON.stringify([next, ...current.filter(item => item.login !== user.login)]));
}

export async function clearGitHubAccountCache(): Promise<void> {
  const key = await userScopedKey(SAVED_ACCOUNTS_PREFIX);
  await AsyncStorage.removeItem(key);
}

export async function fetchGitHubOAuthConfig(): Promise<{ configured: boolean; clientId: string; redirectUri: string }> {
  const { data } = await api.get<{ configured: boolean; clientId: string; redirectUri: string }>('/api/github/oauth-config');
  return data;
}

// ── Project repo connection ────────────────────────────────────────────────────
export interface ProjectGitHubConnection {
  integrationId?: number;
  repoFullName: string;
  ownerLogin: string;
  repoName: string;
  defaultBranch: string;
  private: boolean;
  repositoryUrl?: string;
  active?: boolean;
}

export interface BackendProjectGitHubRepository {
  integrationId: number;
  projectId: number;
  repositoryFullName: string;
  repositoryUrl?: string;
  tokenType?: string;
  active: boolean;
}

function connectionFromBackend(repo: BackendProjectGitHubRepository): ProjectGitHubConnection {
  const [ownerLogin = '', repoName = ''] = repo.repositoryFullName.split('/');
  return {
    integrationId: repo.integrationId,
    repoFullName: repo.repositoryFullName,
    ownerLogin,
    repoName,
    defaultBranch: 'main',
    private: false,
    repositoryUrl: repo.repositoryUrl,
    active: repo.active,
  };
}

export async function getProjectGitHubRepo(projectId: string): Promise<ProjectGitHubConnection | null> {
  const cacheKey = await projectRepoCacheKey(projectId);
  try {
    const { data } = await api.get<BackendProjectGitHubRepository[]>(`/api/github/project/${projectId}/repos`);
    const active = (data ?? []).find(repo => repo.active);
    if (active) {
      const connection = connectionFromBackend(active);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(connection));
      return connection;
    }
    await AsyncStorage.removeItem(cacheKey);
    return null;
  } catch {
    // Fall back to the previous local cache for offline or older backend states.
  }

  const json = await AsyncStorage.getItem(cacheKey);
  return json ? (JSON.parse(json) as ProjectGitHubConnection) : null;
}

export async function setProjectGitHubRepo(projectId: string, repo: GitHubRepository): Promise<ProjectGitHubConnection> {
  let data: BackendProjectGitHubRepository;
  try {
    ({ data } = await api.post<BackendProjectGitHubRepository>('/api/github/link', {
      projectId: Number(projectId),
      repositoryFullName: repo.full_name,
      tokenType: 'OAUTH',
    }));
  } catch (error: any) {
    if (error?.response?.status !== 409) throw error;
    const linked = await api.get<BackendProjectGitHubRepository[]>(`/api/github/project/${projectId}/repos`);
    const existing = linked.data.find(item => item.repositoryFullName.toLowerCase() === repo.full_name.toLowerCase());
    if (!existing) throw error;
    data = existing;
  }
  const conn: ProjectGitHubConnection = {
    ...connectionFromBackend(data),
    defaultBranch: repo.default_branch,
    private: repo.private,
  };
  await AsyncStorage.setItem(await projectRepoCacheKey(projectId), JSON.stringify(conn));
  return conn;
}

export async function unlinkProjectGitHubRepository(projectId: string, integrationId: number): Promise<void> {
  await api.delete(`/api/github/link/${integrationId}`, { params: { projectId } });
}

export async function clearProjectGitHubRepo(projectId: string): Promise<void> {
  try {
    const current = await getProjectGitHubRepo(projectId);
    if (current?.integrationId) {
      await api.delete(`/api/github/link/${current.integrationId}`, { params: { projectId } });
    }
  } catch {
    // Local cleanup should still happen if backend unlink fails.
  }
  await AsyncStorage.removeItem(await projectRepoCacheKey(projectId));
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  owner?: { login: string };
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  merged_at: string | null;
  draft: boolean;
  updated_at: string;
  html_url: string;
  head: { ref: string };
  base: { ref: string };
  user: { login: string; avatar_url: string };
  labels: { id: number; name: string; color: string }[];
}

interface BackendProjectPullRequest {
  id: number;
  githubPrNumber?: number;
  number?: number;
  title: string;
  state: string;
  mergedAt?: string | null;
  merged_at?: string | null;
  githubCreatedAt?: string;
  created_at?: string;
  githubUpdatedAt?: string;
  updated_at?: string;
  githubUrl?: string;
  html_url?: string;
  authorLogin?: string;
  user?: { login: string; avatar_url: string };
  headBranch?: string;
  baseBranch?: string;
  head?: { ref: string };
  base?: { ref: string };
  draft?: boolean;
  labels?: { id?: number; name: string; color: string }[];
}

function normalizePullRequest(pr: BackendProjectPullRequest): GitHubPullRequest {
  const prLike = pr as unknown as { author?: string };
  const authorLogin = pr.authorLogin ?? prLike.author ?? pr.user?.login ?? 'unknown';
  return {
    id: pr.id,
    number: pr.githubPrNumber ?? pr.number ?? 0,
    title: pr.title || 'Untitled PR',
    state: pr.state === 'merged' ? 'closed' : (pr.state || 'open'),
    merged_at: pr.mergedAt ?? pr.merged_at ?? null,
    draft: pr.draft ?? false,
    updated_at: pr.githubUpdatedAt ?? pr.updated_at ?? pr.githubCreatedAt ?? pr.created_at ?? '',
    html_url: pr.githubUrl ?? pr.html_url ?? '',
    head: { ref: pr.headBranch ?? pr.head?.ref ?? '' },
    base: { ref: pr.baseBranch ?? pr.base?.ref ?? '' },
    user: pr.user ?? { login: authorLogin, avatar_url: '' },
    labels: (pr.labels ?? []).map((label, index) => ({ id: label.id ?? index, name: label.name, color: label.color })),
  };
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

interface BackendProjectCommit {
  sha: string;
  message?: string;
  authorName?: string;
  authoredAt?: string;
  commitUrl?: string;
  html_url?: string;
  commit?: GitHubCommit['commit'];
  author?: GitHubCommit['author'];
}

function normalizeCommit(commit: BackendProjectCommit): GitHubCommit {
  const commitLike = commit as BackendProjectCommit & { author?: string };
  const authorLogin = commit.authorName ?? commitLike.author ?? commit.author?.login ?? 'unknown';
  return {
    sha: commit.sha,
    html_url: commit.commitUrl ?? commit.html_url ?? '',
    commit: commit.commit ?? {
      message: commit.message ?? '',
      author: { name: authorLogin, date: commit.authoredAt ?? '' },
    },
    author: commit.author ?? (authorLogin !== 'unknown' ? { login: authorLogin, avatar_url: '' } : null),
  };
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  updated_at: string;
  user: { login: string; avatar_url: string };
  labels: { id: number; name: string; color: string }[];
  comments: number;
  body?: string;
  assignees: ({ login: string; avatar_url: string } | string)[];
}

interface BackendGitHubIssue {
  id: number;
  number?: number;
  githubIssueNumber?: number;
  title: string;
  state: 'open' | 'closed';
  labels?: { id?: number; name: string; color: string }[];
  comments?: number;
  authorLogin?: string;
  html_url?: string;
  htmlUrl?: string;
  githubUrl?: string;
  updated_at?: string;
  updatedAt?: string;
  githubUpdatedAt?: string;
  body?: string;
  assignees?: ({ login: string; avatar_url: string } | string)[];
}

function normalizeIssue(issue: BackendGitHubIssue): GitHubIssue {
  const login = issue.authorLogin || 'github';
  const number = issue.number ?? issue.githubIssueNumber ?? 0;

  return {
    id: issue.id,
    number,
    title: issue.title,
    state: issue.state,
    html_url: issue.html_url || issue.htmlUrl || issue.githubUrl || '',
    updated_at: issue.updated_at || issue.updatedAt || issue.githubUpdatedAt || new Date().toISOString(),
    user: { login, avatar_url: '' },
    labels: (issue.labels || []).map((label, index) => ({
      id: label.id ?? index,
      name: label.name,
      color: label.color,
    })),
    comments: issue.comments ?? 0,
    body: issue.body,
    assignees: issue.assignees ?? [],
  };
}

// ── Backend GitHub API helpers ───────────────────────────────────────────────
export async function fetchGitHubUser(_token?: string): Promise<GitHubUser> {
  const { data } = await api.get<GitHubUser>('/api/github/user');
  return data;
}

export async function fetchRepositoriesWithToken(_token?: string): Promise<GitHubRepository[]> {
  const { data } = await api.get<GitHubRepository[]>('/api/github/repositories');
  return data;
}

export async function fetchPullRequests(_token: string | undefined, owner: string, repo: string): Promise<GitHubPullRequest[]> {
  const { data } = await api.get<GitHubPullRequest[]>('/api/github/pull-requests', {
    params: { owner, repo },
  });
  return data;
}

export async function fetchCommits(_token: string | undefined, owner: string, repo: string): Promise<GitHubCommit[]> {
  const { data } = await api.get<GitHubCommit[]>('/api/github/commits', {
    params: { owner, repo },
  });
  return data;
}

export async function fetchIssues(
  repoFullName: string,
  _token?: string,
  state: 'open' | 'closed' | 'all' = 'all',
  label?: string,
): Promise<GitHubIssue[]> {
  const { data } = await api.get<BackendGitHubIssue[]>('/api/github/issues', {
    params: { repoFullName, state, label: label?.trim() || undefined },
  });
  return data.map(normalizeIssue);
}

function readPageContent<T>(payload: T[] | { content?: T[] } | { items?: T[] }): T[] {
  if (Array.isArray(payload)) return payload;
  if ('content' in payload) return payload.content ?? [];
  if ('items' in payload) return payload.items ?? [];
  return [];
}

export async function fetchProjectPullRequests(projectId: string, state = 'all'): Promise<GitHubPullRequest[]> {
  const { data } = await api.get<BackendProjectPullRequest[] | { content?: BackendProjectPullRequest[] }>(
    `/api/github/project/${projectId}/pull-requests`,
    { params: { state, size: 50 } },
  );
  return readPageContent(data).map(normalizePullRequest);
}

export async function fetchProjectCommits(projectId: string): Promise<GitHubCommit[]> {
  const { data } = await api.get<BackendProjectCommit[] | { content?: BackendProjectCommit[] }>(
    `/api/github/project/${projectId}/commits`,
    { params: { size: 50 } },
  );
  return readPageContent(data).map(normalizeCommit);
}

export async function fetchProjectIssues(projectId: string, state = 'all'): Promise<GitHubIssue[]> {
  const { data } = await api.get<GitHubIssue[] | { content?: BackendGitHubIssue[] }>(
    `/api/github/project/${projectId}/issues`,
    { params: { state, size: 50 } },
  );
  return readPageContent(data as BackendGitHubIssue[] | { content?: BackendGitHubIssue[] }).map(normalizeIssue);
}

export async function syncProjectGitHub(projectId: string): Promise<void> {
  await api.post(`/api/github/project/${projectId}/sync`);
}

export interface GitHubStats {
  totalPullRequests: number;
  openPullRequests: number;
  mergedPullRequests: number;
  closedPullRequests: number;
  totalCommits: number;
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  linkedRepositories: number;
}

export async function fetchProjectGitHubStats(projectId: string): Promise<GitHubStats> {
  const { data } = await api.get<GitHubStats>(`/api/github/project/${projectId}/stats`);
  return data;
}

export interface GitHubNotification {
  id: number;
  message: string;
  type?: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export function isRepositoryNotification(notification: GitHubNotification, repoFullName: string): boolean {
  const repo = repoFullName.trim().toLowerCase();
  const link = notification.link?.toLowerCase() ?? '';
  return Boolean(repo && link.includes(`github.com/${repo}/`));
}

export async function fetchGitHubNotifications(repoFullName: string): Promise<GitHubNotification[]> {
  const { data } = await api.get<{ notifications?: GitHubNotification[] }>('/api/notifications');
  return (data.notifications ?? []).filter(item => isRepositoryNotification(item, repoFullName));
}

export async function markGitHubNotificationRead(id: number): Promise<void> {
  await api.patch(`/api/notifications/${id}/read`);
}

export async function markAllGitHubNotificationsRead(notifications: GitHubNotification[]): Promise<void> {
  await Promise.all(notifications.filter(item => !item.read).map(item => markGitHubNotificationRead(item.id)));
}

export async function fetchImportedGitHubIssueNumbers(projectId: string, repoFullName: string): Promise<number[]> {
  const { data } = await api.get<any>(`/api/tasks/project/${projectId}`, { params: { page: 0, size: 500 } });
  const tasks = Array.isArray(data) ? data : (data.content ?? []);
  return tasks
    .filter((task: any) => task.githubRepoFullName?.toLowerCase() === repoFullName.toLowerCase())
    .map((task: any) => task.githubIssueNumber)
    .filter((number: unknown): number is number => typeof number === 'number');
}

export async function importGitHubIssue(projectId: string, repoFullName: string, issueNumber: number): Promise<number> {
  const { data } = await api.post<{ imported?: number[]; skipped?: number[] }>('/api/github/issues/import', {
    projectId: Number(projectId), repoFullName, issueNumbers: [issueNumber],
  });
  const taskId = data.imported?.[0];
  if (typeof taskId !== 'number') {
    throw new Error(data.skipped?.includes(issueNumber) ? 'This issue has already been imported.' : 'The issue could not be imported.');
  }
  return taskId;
}

export type CollaboratorPermission = 'pull' | 'triage' | 'push' | 'maintain';
export interface CollaboratorInviteResult { identifier: string; permission: string; githubStatus: number; message?: string }

export async function inviteGitHubCollaborator(
  projectId: string,
  identifier: string,
  permission: CollaboratorPermission,
): Promise<CollaboratorInviteResult> {
  const { data } = await api.post<CollaboratorInviteResult>(`/api/github/project/${projectId}/collaborators`, {
    identifier: identifier.trim(), permission,
  });
  return data;
}

export type CiStatus = 'PASSING' | 'FAILED' | 'RUNNING' | null;
export interface TaskGitHubSummary {
  taskId: number; githubBranch: string | null; prCount: number; ciStatus: CiStatus;
  pullRequests?: LinkedPullRequest[]; commits?: LinkedCommit[];
}
export interface LinkedPullRequest {
  id: number; prNumber: number; title: string; state: string; ciStatus: CiStatus;
  reviewStatus: string | null; headBranch: string; baseBranch: string; htmlUrl: string;
  author: string; createdAt: string; updatedAt: string; mergedAt: string | null;
}
export interface LinkedCommit {
  id: number; sha: string; fullSha?: string; message: string; author: string;
  committedAt: string; htmlUrl: string; ciStatus: CiStatus; referencedTaskNumbers?: number[];
}

export async function fetchTaskGitHubSummary(taskId: number, repoFullName?: string): Promise<TaskGitHubSummary> {
  const { data } = await api.get<TaskGitHubSummary>(`/api/tasks/${taskId}/github`, { params: { repoFullName } });
  return data;
}

export async function fetchTaskPullRequests(taskId: number, repoFullName?: string): Promise<LinkedPullRequest[]> {
  const { data } = await api.get<LinkedPullRequest[]>(`/api/tasks/${taskId}/pull-requests`, { params: { repoFullName } });
  return data ?? [];
}

export async function fetchTaskCommits(taskId: number, repoFullName?: string): Promise<LinkedCommit[]> {
  const { data } = await api.get<LinkedCommit[]>(`/api/tasks/${taskId}/commits`, { params: { repoFullName, limit: 10 } });
  return data ?? [];
}

export async function updateTaskGitHubBranch(taskId: number, branch: string): Promise<TaskGitHubSummary> {
  const { data } = await api.patch<TaskGitHubSummary>(`/api/tasks/${taskId}/github/branch`, { branch });
  return data;
}

export async function createGitHubIssueFromTask(input: {
  taskId: number; repoFullName: string; title: string; body?: string; labels?: string[];
}): Promise<GitHubIssue> {
  const { data } = await api.post<BackendGitHubIssue>('/api/github/issues/create', {
    repoFullName: input.repoFullName,
    title: input.title.trim(),
    body: input.body?.trim() || undefined,
    labels: input.labels ?? [],
    assignees: [],
    taskId: input.taskId,
  });
  return normalizeIssue(data);
}

export function validateGitHubBranch(value: string): string | null {
  const branch = value.trim();
  if (!branch) return 'Branch name cannot be empty';
  if (branch.length > 255) return 'Branch name is too long';
  if (/\s/.test(branch)) return 'Branch name cannot contain spaces';
  if (branch.startsWith('.') || branch.startsWith('-')) return 'Branch name cannot start with . or -';
  if (branch.endsWith('.lock')) return 'Branch name cannot end with .lock';
  if (branch.includes('..')) return 'Branch name cannot contain ..';
  if (!/^[a-zA-Z0-9._/\-]+$/.test(branch)) return 'Branch name contains unsupported characters';
  return null;
}

// ── Token exchange (backend uses root .env client secret) ─────────────────────
export async function exchangeCodeForToken(code: string, redirectUri?: string): Promise<string | null> {
  const { data } = await api.post<{ success?: boolean }>('/api/github/token', { code, redirectUri });
  return data.success ? BACKEND_GITHUB_TOKEN_SENTINEL : null;
}
