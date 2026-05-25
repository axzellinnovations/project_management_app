/**
 * GitHub integration service — backend-driven only.
 *
 * All GitHub API communication happens through the Planora backend.
 * The frontend never calls github.com directly and never handles tokens.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8080'

// ── Backend DTO types ─────────────────────────────────────────────────────────

export interface GithubRepositoryDTO {
  repoId: number
  name: string
  fullName: string
  privateRepo: boolean
  defaultBranch: string
  ownerLogin: string
  description: string | null
}

export interface GithubIntegrationStatus {
  connected: boolean
  repoFullName?: string
  connectedAt?: string
}

export interface GithubIssueDTO {
  id: number
  issueNumber: number
  title: string
  state: 'open' | 'closed'
  htmlUrl: string
  author: string
  body: string | null
  createdAt: string | null
  closedAt: string | null
}

export interface GithubStatsDTO {
  connected: boolean
  repoFullName?: string
  defaultBranch?: string
  openPrCount: number
  mergedPrCount: number
  totalCommits: number
  openIssues: number
  closedIssues: number
  latestCiStatus: string | null
  connectedAt?: string
}

// ── Legacy shape aliases (used by TaskGitHubSection and similar consumers) ────

/** @deprecated Use GithubRepositoryDTO */
export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  owner: { login: string }
  default_branch: string
}

/** @deprecated Token management now happens on the backend */
export interface ProjectGitHubConnection {
  repoId: number
  repoName: string
  repoFullName: string
  private: boolean
  defaultBranch: string
  ownerLogin: string
  connectedAt: string
}

// ── Repository listing ────────────────────────────────────────────────────────

export async function fetchRepositories(projectId?: number): Promise<GithubRepositoryDTO[]> {
  const url = projectId != null
    ? `${API_BASE}/api/github/repositories?projectId=${projectId}`
    : `${API_BASE}/api/github/repositories`

  const res = await fetch(url, { credentials: 'include' })

  if (res.status === 401) throw new Error('Unauthorized: Please log in again.')
  if (res.status === 429) throw new Error('Rate limit exceeded. Please try again later.')
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to fetch repositories')
  }
  return res.json()
}

// ── Integration management ────────────────────────────────────────────────────

export async function connectRepository(
  projectId: number,
  repoFullName: string,
  token: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/github/integrations`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: String(projectId), repoFullName, token }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to connect repository')
  }
}

export async function disconnectRepository(projectId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/github/integrations/project/${projectId}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to disconnect repository')
}

export async function getProjectIntegration(
  projectId: number,
): Promise<GithubIntegrationStatus> {
  const res = await fetch(
    `${API_BASE}/api/github/integrations/project/${projectId}`,
    { credentials: 'include' },
  )
  if (!res.ok) return { connected: false }
  return res.json()
}

// ── Issues ────────────────────────────────────────────────────────────────────

export async function fetchProjectIssues(projectId: number): Promise<GithubIssueDTO[]> {
  const res = await fetch(
    `${API_BASE}/api/github/projects/${projectId}/issues`,
    { credentials: 'include' },
  )
  if (!res.ok) return []
  return res.json()
}

export async function createProjectIssue(
  projectId: number,
  title: string,
  body?: string,
): Promise<GithubIssueDTO> {
  const res = await fetch(`${API_BASE}/api/github/projects/${projectId}/issues`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body: body ?? '' }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Failed to create issue')
  }
  return res.json()
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function fetchProjectStats(projectId: number): Promise<GithubStatsDTO> {
  const res = await fetch(
    `${API_BASE}/api/github/projects/${projectId}/stats`,
    { credentials: 'include' },
  )
  if (!res.ok) return { connected: false, openPrCount: 0, mergedPrCount: 0, totalCommits: 0, openIssues: 0, closedIssues: 0, latestCiStatus: null }
  return res.json()
}

export async function triggerProjectSync(projectId: number): Promise<void> {
  await fetch(`${API_BASE}/api/github/projects/${projectId}/sync`, {
    method: 'POST',
    credentials: 'include',
  })
}

// ── Deprecated stubs — kept so existing imports do not break ─────────────────
// These functions previously managed GitHub tokens in localStorage.
// Tokens are now stored server-side only. These stubs are no-ops.

/** @deprecated Token is now stored in the backend. Returns null. */
export function getGitHubToken(): string | null {
  return null
}

/** @deprecated Token is now stored in the backend. Has no effect. */
export function setGitHubToken(_token: string): void {
  // no-op: backend manages the token
}

/** @deprecated Token is now stored in the backend. Has no effect. */
export function clearGitHubToken(): void {
  // no-op
}

/** @deprecated Use getProjectIntegration() instead. Returns null. */
export function getProjectGitHubRepo(
  _projectId: string | number,
): ProjectGitHubConnection | null {
  return null
}

/** @deprecated Use connectRepository() instead. Has no effect. */
export function setProjectGitHubRepo(
  _projectId: string | number,
  _repo: GitHubRepository,
): void {
  // no-op: integration is now managed via backend API
}

/** @deprecated Use disconnectRepository() instead. Has no effect. */
export function clearProjectGitHubRepo(_projectId: string | number): void {
  // no-op
}
