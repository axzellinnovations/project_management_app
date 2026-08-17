import { gitHubApi, tasksApi } from './api-contract';
import api from '@/lib/axios';
import { getApiErrorStatus } from '@/lib/api-error';
import type {
  GithubRepository as BackendGithubRepository,
  GithubPr as BackendGithubPr,
  GithubCommit as BackendGithubCommit,
  GithubIssue as BackendGithubIssue,
  GithubStats,
  PageResponse,
  LinkRepositoryRequest,
  GithubCollaboratorInviteRequest,
  GithubCollaboratorInviteResponse,
  CreateIssueRequest,
} from './api-contract';

export type {
  BackendGithubRepository,
  BackendGithubPr,
  BackendGithubCommit,
  BackendGithubIssue,
  GithubStats,
  PageResponse,
  LinkRepositoryRequest,
  GithubCollaboratorInviteRequest,
  GithubCollaboratorInviteResponse,
  CreateIssueRequest,
};

// ── Repository endpoints ────────────────────────────────────────────────────

export async function linkRepository(request: LinkRepositoryRequest): Promise<BackendGithubRepository> {
  return gitHubApi.linkRepository(request);
}

export async function unlinkRepository(integrationId: number, projectId: number): Promise<void> {
  return gitHubApi.unlinkRepository(integrationId, projectId);
}

export async function getLinkedRepositories(projectId: number): Promise<BackendGithubRepository[]> {
  return gitHubApi.getLinkedRepositories(projectId);
}

export async function inviteGitHubCollaborator(
  projectId: string | number,
  request: GithubCollaboratorInviteRequest,
): Promise<GithubCollaboratorInviteResponse> {
  return gitHubApi.inviteCollaborator(Number(projectId), request);
}

// ── Pull Request endpoints ──────────────────────────────────────────────────

export async function getPullRequests(
  projectId: number,
  options: { state?: 'open' | 'closed' | 'merged' | 'all'; page?: number; size?: number } = {}
): Promise<PageResponse<BackendGithubPr>> {
  return gitHubApi.getPullRequests(projectId, options);
}

export async function linkTaskToPr(
  projectId: number,
  prId: number,
  taskId: number
): Promise<void> {
  return gitHubApi.linkTaskToPr(projectId, prId, taskId);
}

// ── Commit endpoints ────────────────────────────────────────────────────────

export async function getCommits(
  projectId: number,
  options: { page?: number; size?: number } = {}
): Promise<PageResponse<BackendGithubCommit>> {
  return gitHubApi.getCommits(projectId, options);
}

// ── Issue endpoints ─────────────────────────────────────────────────────────

export async function getIssues(
  projectId: number,
  options: { state?: 'open' | 'closed' | 'all'; page?: number; size?: number } = {}
): Promise<PageResponse<BackendGithubIssue>> {
  return gitHubApi.getIssues(projectId, options);
}

export async function createIssue(
  projectId: number,
  request: CreateIssueRequest
): Promise<BackendGithubIssue> {
  return gitHubApi.createIssue(projectId, request);
}

// ── Stats & Sync ────────────────────────────────────────────────────────────

export async function getStats(projectId: number): Promise<GithubStats> {
  return gitHubApi.getStats(projectId);
}

export async function syncProject(projectId: number): Promise<void> {
  return gitHubApi.syncProject(projectId);
}

// ── GitHub account and repository browsing endpoints ───────────────────────

export interface GitHubOwner {
  login: string;
}

/** A repository returned by GitHub's account-level repositories endpoint. */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubOwner;
  default_branch: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
  followers: number;
}

export interface GitHubConnectionStatus {
  connected: boolean;
}

export interface GitHubLabel {
  id?: number;
  name: string;
  color: string;
}

export interface GitHubIssueAssignee {
  login: string;
  avatar_url: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  labels: GitHubLabel[];
  assignees: Array<GitHubIssueAssignee | string>;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  comments: number;
  body?: string;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  merged_at: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  draft: boolean;
  user: { login: string; avatar_url: string; html_url: string };
  labels: GitHubLabel[];
  head: { ref: string };
  base: { ref: string };
}

export interface GitHubCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string; html_url: string } | null;
}

export interface ProjectGitHubConnection {
  repoId: number;
  integrationId?: number;
  repoName: string;
  repoFullName: string;
  repositoryUrl?: string;
  private: boolean;
  defaultBranch: string;
  ownerLogin: string;
  connectedAt: string;
  active?: boolean;
  source?: 'backend' | 'legacy';
}

function splitRepoFullName(repoFullName: string): { ownerLogin: string; repoName: string } {
  const [ownerLogin = '', repoName = ''] = repoFullName.split('/', 2);
  return { ownerLogin, repoName };
}

export function backendRepositoryToProjectConnection(
  repository: BackendGithubRepository,
): ProjectGitHubConnection {
  const { ownerLogin, repoName } = splitRepoFullName(repository.repositoryFullName);

  return {
    repoId: repository.integrationId,
    integrationId: repository.integrationId,
    repoName,
    repoFullName: repository.repositoryFullName,
    repositoryUrl: repository.repositoryUrl,
    private: false,
    defaultBranch: 'main',
    ownerLogin,
    connectedAt: new Date().toISOString(),
    active: repository.active,
    source: 'backend',
  };
}

export function accountRepositoryToProjectConnection(
  repo: GitHubRepository,
): ProjectGitHubConnection {
  return {
    repoId: repo.id,
    repoName: repo.name,
    repoFullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    ownerLogin: repo.owner.login,
    connectedAt: new Date().toISOString(),
    source: 'legacy',
  };
}

export function projectConnectionToLinkRequest(
  projectId: string | number,
  connection: Pick<ProjectGitHubConnection, 'repoFullName'>,
): LinkRepositoryRequest {
  return {
    projectId: Number(projectId),
    repositoryFullName: connection.repoFullName,
  };
}

export function backendPrToGitHubPullRequest(pr: BackendGithubPr): GitHubPullRequest {
  const prLike = pr as unknown as {
    author?: string;
    htmlUrl?: string;
    avatarUrl?: string;
    draft?: boolean;
    labels?: GitHubLabel[];
  };
  const authorLogin = pr.authorLogin ?? prLike.author ?? 'unknown';
  const htmlUrl = pr.githubUrl ?? prLike.htmlUrl ?? '';
  const isMerged = pr.state === 'merged' || Boolean(pr.mergedAt);
  const avatarUrl = prLike.avatarUrl || (authorLogin && authorLogin !== 'unknown' ? `https://github.com/${authorLogin}.png` : '');

  return {
    id: pr.id,
    number: pr.githubPrNumber,
    title: pr.title || 'Untitled PR',
    state: isMerged ? 'closed' : ((pr.state as 'open' | 'closed') || 'open'),
    merged_at: pr.mergedAt ?? (isMerged ? (pr.githubUpdatedAt || pr.githubCreatedAt || new Date().toISOString()) : null),
    created_at: pr.githubCreatedAt ?? '',
    updated_at: pr.githubUpdatedAt ?? pr.githubCreatedAt ?? '',
    html_url: htmlUrl,
    draft: Boolean(prLike.draft),
    user: {
      login: authorLogin,
      avatar_url: avatarUrl,
      html_url: authorLogin && authorLogin !== 'unknown' ? `https://github.com/${authorLogin}` : '',
    },
    labels: Array.isArray(prLike.labels) ? prLike.labels : [],
    head: { ref: pr.headBranch ?? '' },
    base: { ref: pr.baseBranch ?? '' },
  };
}

export function backendCommitToGitHubCommit(commit: BackendGithubCommit): GitHubCommit {
  const commitLike = commit as BackendGithubCommit & {
    author?: string;
    authorName?: string;
    committedAt?: string;
    htmlUrl?: string;
  };
  const authorLogin = commit.authorName ?? commitLike.author ?? 'unknown';
  const htmlUrl = commit.commitUrl ?? commitLike.htmlUrl ?? '';
  const date = commit.authoredAt ?? commitLike.committedAt ?? '';

  return {
    sha: commit.sha,
    html_url: htmlUrl,
    commit: {
      message: commit.message ?? '',
      author: {
        name: authorLogin,
        date: date,
      },
    },
    author: {
      login: authorLogin,
      avatar_url: '',
      html_url: authorLogin && authorLogin !== 'unknown' ? `https://github.com/${authorLogin}` : '',
    },
  };
}

function normalizeBackendIssueLabels(labels: BackendGithubIssue['labels']): GitHubLabel[] {
  if (!Array.isArray(labels)) return [];

  return (labels as unknown[]).map((label, index) => {
    if (typeof label === 'string') {
      return { id: index, name: label, color: '64748b' };
    }

    const labelLike = label as { id?: number; name?: string; color?: string };
    return {
      id: labelLike.id ?? index,
      name: labelLike.name ?? '',
      color: labelLike.color ?? '64748b',
    };
  }).filter(label => label.name);
}

export function backendIssueToGitHubIssue(issue: BackendGithubIssue): GitHubIssue {
  const issueLike = issue as BackendGithubIssue & {
    number?: number;
    htmlUrl?: string;
    createdAt?: string;
    updatedAt?: string;
    comments?: number;
    assignees?: Array<GitHubIssueAssignee | string>;
  };
  const number = issue.githubIssueNumber ?? issueLike.number ?? 0;
  const htmlUrl = issue.githubUrl ?? issueLike.htmlUrl ?? '';
  const createdAt = issue.githubCreatedAt ?? issueLike.createdAt ?? '';
  const updatedAt = issue.githubUpdatedAt ?? issueLike.updatedAt ?? createdAt;
  const rawState = (issue.state || 'open').toLowerCase();
  const state: 'open' | 'closed' = rawState === 'closed' ? 'closed' : 'open';

  return {
    id: issue.id,
    number,
    title: issue.title,
    body: issue.body ?? undefined,
    state,
    labels: normalizeBackendIssueLabels(issue.labels),
    assignees: Array.isArray(issueLike.assignees) ? issueLike.assignees : [],
    createdAt,
    updatedAt,
    htmlUrl,
    comments: issueLike.comments ?? 0,
  };
}

export type GithubAutomationTrigger =
  | 'PR_MERGED'
  | 'PR_OPENED'
  | 'CI_FAILED'
  | 'ISSUE_OPENED'
  | 'ISSUE_LABELED'
  | 'RELEASE_PUBLISHED';

export type GithubAutomationAction =
  | 'MOVE_TASK_TO_COLUMN'
  | 'CREATE_TASK'
  | 'SEND_NOTIFICATION';

export interface GithubAutomationRule {
  id: number;
  projectId: number;
  trigger: GithubAutomationTrigger;
  action: GithubAutomationAction;
  enabled: boolean;
  config: Record<string, string>;
}

export type GithubAutomationOutcome = 'SUCCESS' | 'SKIPPED' | 'ERROR';

export interface GithubAutomationLog {
  id: number;
  ruleId: number;
  trigger: GithubAutomationTrigger;
  action: GithubAutomationAction;
  context: string;
  outcome: GithubAutomationOutcome;
  message: string;
  executedAt: string;
}

interface GitHubApiIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar_url: string }>;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  html_url: string;
  htmlUrl?: string;
  comments: number;
}

export async function fetchRepositories(): Promise<GitHubRepository[]> {
  return gitHubApi.fetchRepositories() as Promise<GitHubRepository[]>;
}

export async function fetchIssues(
  repoFullName: string,
  state: 'open' | 'closed' | 'all' = 'all',
  label?: string,
): Promise<GitHubIssue[]> {
  const response = await api.get<GitHubApiIssue[]>('/api/github/issues', {
    params: { repoFullName, state, label: label?.trim() || undefined },
  });

  return response.data.map(issue => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    body: issue.body ?? undefined,
    state: issue.state,
    labels: issue.labels,
    assignees: issue.assignees,
    createdAt: issue.created_at || issue.createdAt || '',
    updatedAt: issue.updated_at || issue.updatedAt || '',
    htmlUrl: issue.html_url || issue.htmlUrl || '',
    comments: issue.comments,
  }));
}

export async function fetchGitHubUser(): Promise<GitHubUser> {
  const { data } = await api.get<GitHubUser>('/api/github/user');
  return data;
}

export async function fetchGitHubConnectionStatus(): Promise<GitHubConnectionStatus> {
  const { data } = await api.get<GitHubConnectionStatus>('/api/github/status');
  return data;
}

export async function fetchPullRequests(owner: string, repo: string): Promise<GitHubPullRequest[]> {
  const { data } = await api.get<GitHubPullRequest[]>('/api/github/pull-requests', {
    params: { owner, repo },
  });
  return data;
}

export async function fetchPullRequest(
  owner: string,
  repo: string,
  prNumber: number,
): Promise<GitHubPullRequest> {
  const { data } = await api.get<GitHubPullRequest>(`/api/github/pull-requests/${prNumber}`, {
    params: { owner, repo },
  });
  return data;
}

export async function fetchCommits(owner: string, repo: string): Promise<GitHubCommit[]> {
  const { data } = await api.get<GitHubCommit[]>('/api/github/commits', {
    params: { owner, repo },
  });
  return data;
}

// ── GitHub account connection status ───────────────────────────────────────

export function hasConnectedGitHubAccount(): boolean {
  if (typeof window === 'undefined') return false;
  const profile = localStorage.getItem('userProfile');
  if (profile) {
    try {
      const parsed = JSON.parse(profile);
      if (parsed && parsed.githubUsername) return true;
    } catch {
      // Ignore malformed cached profile data.
    }
  }
  return false;
}

// ── Per-project GitHub repo connection ─────────────────────────────────────

export function getProjectGitHubRepo(projectId: string | number): ProjectGitHubConnection | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(`github_project_${projectId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ProjectGitHubConnection;
    return { ...parsed, source: parsed.source ?? 'legacy' };
  } catch {
    return null;
  }
}

export function setProjectGitHubRepo(projectId: string | number, repo: GitHubRepository): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`github_project_${projectId}`, JSON.stringify(accountRepositoryToProjectConnection(repo)));
}

export function setProjectGitHubConnection(projectId: string | number, connection: ProjectGitHubConnection): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`github_project_${projectId}`, JSON.stringify(connection));
}

export function clearProjectGitHubRepo(projectId: string | number): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`github_project_${projectId}`);
}

export async function fetchProjectGitHubConnection(
  projectId: string | number,
): Promise<ProjectGitHubConnection | null> {
  const repositories = await getLinkedRepositories(Number(projectId));
  const activeRepository = repositories.find(repository => repository.active);
  return activeRepository ? backendRepositoryToProjectConnection(activeRepository) : null;
}

const inFlightLinkOperations = new Map<string, Promise<ProjectGitHubConnection>>();

export async function persistProjectGitHubConnection(
  projectId: string | number,
  repoFullName: string,
): Promise<ProjectGitHubConnection> {
  const numericProjectId = Number(projectId);
  const normalizedRepo = repoFullName.trim().toLowerCase();
  const key = `${numericProjectId}:${normalizedRepo}`;

  const existingInFlight = inFlightLinkOperations.get(key);
  if (existingInFlight) {
    return existingInFlight;
  }

  const operation = (async () => {
    try {
      const linkedRepository = await linkRepository({
        projectId: numericProjectId,
        repositoryFullName: repoFullName,
      });
      return backendRepositoryToProjectConnection(linkedRepository);
    } catch (error) {
      if (getApiErrorStatus(error) !== 409) {
        throw error;
      }

      const linkedRepositories = await getLinkedRepositories(numericProjectId);
      const existingRepository = linkedRepositories.find(
        (repository) => repository.repositoryFullName.toLowerCase() === normalizedRepo,
      );

      if (!existingRepository) {
        throw error;
      }

      return backendRepositoryToProjectConnection(existingRepository);
    }
  })();

  inFlightLinkOperations.set(key, operation);
  try {
    return await operation;
  } finally {
    inFlightLinkOperations.delete(key);
  }
}

export async function fetchProjectPullRequests(
  projectId: string | number,
  repoFullName?: string,
): Promise<GitHubPullRequest[]> {
  try {
    const response = await getPullRequests(Number(projectId), { state: 'all', page: 0, size: 100 });
    const prs = (response.content || []).map(backendPrToGitHubPullRequest);
    if (prs.length > 0 || !repoFullName) {
      return prs;
    }
  } catch (error) {
    if (!repoFullName) throw error;
  }

  if (repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    if (owner && repo) {
      try {
        return await fetchPullRequests(owner, repo);
      } catch {
        return [];
      }
    }
  }

  return [];
}

export async function fetchProjectCommits(
  projectId: string | number,
  repoFullName?: string,
): Promise<GitHubCommit[]> {
  try {
    const response = await getCommits(Number(projectId), { page: 0, size: 100 });
    const commits = (response.content || []).map(backendCommitToGitHubCommit);
    if (commits.length > 0 || !repoFullName) {
      return commits;
    }
  } catch (error) {
    if (!repoFullName) throw error;
  }

  if (repoFullName) {
    const [owner, repo] = repoFullName.split('/');
    if (owner && repo) {
      try {
        return await fetchCommits(owner, repo);
      } catch {
        return [];
      }
    }
  }

  return [];
}

export async function fetchProjectIssues(
  projectId: string | number,
  repoFullName?: string,
): Promise<GitHubIssue[]> {
  try {
    const response = await getIssues(Number(projectId), { state: 'all', page: 0, size: 100 });
    const issues = (response.content || []).map(backendIssueToGitHubIssue);
    if (issues.length > 0 || !repoFullName) {
      return issues;
    }
  } catch (error) {
    if (!repoFullName) throw error;
  }

  if (repoFullName) {
    try {
      return await fetchIssues(repoFullName);
    } catch {
      return [];
    }
  }

  return [];
}

export async function syncProjectGitHub(projectId: string | number): Promise<void> {
  await syncProject(Number(projectId));
}

export async function fetchGitHubAutomationRules(
  projectId: string | number,
): Promise<GithubAutomationRule[]> {
  return gitHubApi.getAutomationRules(projectId) as Promise<GithubAutomationRule[]>;
}

export async function fetchGitHubAutomationLogs(
  projectId: string | number,
): Promise<GithubAutomationLog[]> {
  return gitHubApi.getAutomationLogs(projectId) as Promise<GithubAutomationLog[]>;
}

export async function fetchImportedGitHubIssueNumbers(
  projectId: string | number,
  repoFullName: string,
): Promise<number[]> {
  const data = await tasksApi.listByProject(projectId);
  const content = data.content || [];
  const normalizedRepoName = repoFullName.toLowerCase();
  const tasks = content as Array<{ githubRepoFullName?: string; githubIssueNumber?: number }>;

  return tasks
    .filter(task => task.githubRepoFullName?.toLowerCase() === normalizedRepoName)
    .map(task => task.githubIssueNumber)
    .filter((number): number is number => typeof number === 'number');
}

export async function createGitHubAutomationRule(
  projectId: string | number,
  payload: {
    trigger: GithubAutomationTrigger;
    action: GithubAutomationAction;
    config: Record<string, string>;
  },
): Promise<GithubAutomationRule> {
  return gitHubApi.createAutomationRule(projectId, payload) as Promise<GithubAutomationRule>;
}

export async function deleteGitHubAutomationRule(
  projectId: string | number,
  ruleId: number,
): Promise<void> {
  await gitHubApi.deleteAutomationRule(projectId, ruleId);
}

export async function setGitHubAutomationRuleEnabled(
  projectId: string | number,
  ruleId: number,
  enabled: boolean,
): Promise<GithubAutomationRule> {
  return gitHubApi.setAutomationRuleEnabled(projectId, ruleId, enabled) as Promise<GithubAutomationRule>;
}

// ── Saved GitHub accounts (account picker) ─────────────────────────────────

export interface SavedGitHubAccount {
  login: string;
  name: string | null;
  avatarUrl: string;
}

const SAVED_ACCOUNTS_KEY = 'planora:github:saved-accounts';

export function getSavedGitHubAccounts(): SavedGitHubAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_ACCOUNTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function upsertSavedGitHubAccount(account: SavedGitHubAccount): void {
  const accounts = getSavedGitHubAccounts();
  const index = accounts.findIndex(savedAccount => savedAccount.login === account.login);
  if (index >= 0) accounts[index] = account;
  else accounts.unshift(account);
  localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}
