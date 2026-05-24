export interface GitHubOwner {
  login: string
}

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  private: boolean
  owner: GitHubOwner
  default_branch: string
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  html_url: string
  public_repos: number
  followers: number
}

export interface GitHubLabel {
  id: number
  name: string
  color: string
}

export interface GitHubPullRequest {
  id: number
  number: number
  title: string
  state: 'open' | 'closed'
  merged_at: string | null
  created_at: string
  updated_at: string
  html_url: string
  draft: boolean
  user: { login: string; avatar_url: string; html_url: string }
  labels: GitHubLabel[]
  head: { ref: string }
  base: { ref: string }
}

export interface ProjectGitHubConnection {
  repoId: number
  repoName: string
  repoFullName: string
  private: boolean
  defaultBranch: string
  ownerLogin: string
  connectedAt: string
}

export async function fetchRepositories(): Promise<GitHubRepository[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080'

  const response = await fetch(`${baseUrl}/api/github/repositories`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (response.status === 401) {
    throw new Error('Unauthorized: Please log in again.')
  }

  if (response.status === 429) {
    throw new Error('Rate limit exceeded. Please try again later.')
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch repositories')
  }

  return response.json()
}

export async function fetchRepositoriesWithToken(token: string): Promise<GitHubRepository[]> {
  const response = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (response.status === 401) {
    throw new Error('Invalid GitHub token. Please reconnect your account.')
  }

  if (!response.ok) {
    throw new Error('Failed to fetch repositories from GitHub')
  }

  return response.json()
}

export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })
  if (!response.ok) throw new Error('Failed to fetch GitHub user')
  return response.json()
}

export async function fetchPullRequests(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubPullRequest[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=10&sort=updated&direction=desc`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  )
  if (response.status === 404) throw new Error('Repository not found or no access')
  if (!response.ok) throw new Error('Failed to fetch pull requests')
  return response.json()
}

export interface GitHubCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    author: { name: string; date: string }
  }
  author: { login: string; avatar_url: string; html_url: string } | null
}

export async function fetchCommits(
  token: string,
  owner: string,
  repo: string,
): Promise<GitHubCommit[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits?per_page=10`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  )
  if (response.status === 404) throw new Error('Repository not found or no access')
  if (!response.ok) throw new Error('Failed to fetch commits')
  return response.json()
}

// ── GitHub token (stored per browser session) ────────────────────────────────

export function getGitHubToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('github_access_token')
}

export function setGitHubToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('github_access_token', token)
}

export function clearGitHubToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('github_access_token')
}

// ── Per-project GitHub repo connection ───────────────────────────────────────

export function getProjectGitHubRepo(projectId: string | number): ProjectGitHubConnection | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(`github_project_${projectId}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ProjectGitHubConnection
  } catch {
    return null
  }
}

export function setProjectGitHubRepo(projectId: string | number, repo: GitHubRepository): void {
  if (typeof window === 'undefined') return
  const connection: ProjectGitHubConnection = {
    repoId: repo.id,
    repoName: repo.name,
    repoFullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    ownerLogin: repo.owner.login,
    connectedAt: new Date().toISOString(),
  }
  localStorage.setItem(`github_project_${projectId}`, JSON.stringify(connection))
}

export function clearProjectGitHubRepo(projectId: string | number): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(`github_project_${projectId}`)
}
