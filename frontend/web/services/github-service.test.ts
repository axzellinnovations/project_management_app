import {
  accountRepositoryToProjectConnection,
  backendCommitToGitHubCommit,
  backendIssueToGitHubIssue,
  backendPrToGitHubPullRequest,
  backendRepositoryToProjectConnection,
  persistProjectGitHubConnection,
  projectConnectionToLinkRequest,
  type BackendGithubCommit,
  type BackendGithubIssue,
  type BackendGithubPr,
  type BackendGithubRepository,
  type GitHubRepository,
} from './github-service';
import { gitHubApi } from './api-contract';

describe('github-service adapters', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('converts a backend project repository into a page connection', () => {
    const repository: BackendGithubRepository = {
      integrationId: 42,
      projectId: 7,
      repositoryFullName: 'planora/web',
      repositoryUrl: 'https://github.com/planora/web',
      tokenType: 'OAUTH',
      active: true,
    };

    expect(backendRepositoryToProjectConnection(repository)).toMatchObject({
      repoId: 42,
      integrationId: 42,
      repoName: 'web',
      repoFullName: 'planora/web',
      repositoryUrl: 'https://github.com/planora/web',
      ownerLogin: 'planora',
      private: false,
      defaultBranch: 'main',
      active: true,
      source: 'backend',
    });
  });

  it('converts an account repository into a legacy page connection', () => {
    const repository: GitHubRepository = {
      id: 99,
      name: 'api',
      full_name: 'planora/api',
      private: true,
      owner: { login: 'planora' },
      default_branch: 'main',
    };

    expect(accountRepositoryToProjectConnection(repository)).toMatchObject({
      repoId: 99,
      repoName: 'api',
      repoFullName: 'planora/api',
      ownerLogin: 'planora',
      private: true,
      defaultBranch: 'main',
      source: 'legacy',
    });
  });

  it('builds a backend link request from a legacy connection', () => {
    expect(projectConnectionToLinkRequest('7', { repoFullName: 'planora/mobile' })).toEqual({
      projectId: 7,
      repositoryFullName: 'planora/mobile',
    });
  });

  it('adapts backend pull request DTOs for existing PR cards', () => {
    const pr: BackendGithubPr = {
      id: 5,
      integrationId: 42,
      githubPrNumber: 123,
      title: 'Ship GitHub page',
      body: null,
      state: 'merged',
      authorLogin: 'octo',
      headBranch: 'fix/github-page',
      baseBranch: 'main',
      githubUrl: 'https://github.com/planora/web/pull/123',
      linkedTaskId: null,
      githubCreatedAt: '2026-07-06T10:00:00',
      githubUpdatedAt: '2026-07-06T11:00:00',
      mergedAt: '2026-07-06T11:30:00',
    };

    expect(backendPrToGitHubPullRequest(pr)).toMatchObject({
      id: 5,
      number: 123,
      title: 'Ship GitHub page',
      state: 'closed',
      merged_at: '2026-07-06T11:30:00',
      html_url: 'https://github.com/planora/web/pull/123',
      user: {
        login: 'octo',
        avatar_url: 'https://github.com/octo.png',
      },
      head: { ref: 'fix/github-page' },
      base: { ref: 'main' },
    });
  });

  it('adapts backend commit DTOs for existing commit cards', () => {
    const commit: BackendGithubCommit = {
      id: 8,
      integrationId: 42,
      sha: 'abcdef123456',
      shortSha: 'abcdef1',
      message: 'Fix blank GitHub page',
      authorName: 'Dana',
      authorEmail: 'dana@example.com',
      commitUrl: 'https://github.com/planora/web/commit/abcdef1',
      linkedTaskId: null,
      authoredAt: '2026-07-06T12:00:00',
    };

    expect(backendCommitToGitHubCommit(commit)).toMatchObject({
      sha: 'abcdef123456',
      html_url: 'https://github.com/planora/web/commit/abcdef1',
      commit: {
        message: 'Fix blank GitHub page',
        author: { name: 'Dana', date: '2026-07-06T12:00:00' },
      },
      author: { login: 'Dana' },
    });
  });

  it('adapts backend issue DTOs for existing issue cards', () => {
    const issue: BackendGithubIssue = {
      id: 11,
      integrationId: 42,
      githubIssueNumber: 77,
      title: 'Blank GitHub page',
      body: 'Nothing renders',
      state: 'open',
      authorLogin: 'octo',
      githubUrl: 'https://github.com/planora/web/issues/77',
      labels: ['bug', 'frontend'],
      linkedTaskId: null,
      githubCreatedAt: '2026-07-06T09:00:00',
      githubUpdatedAt: '2026-07-06T10:00:00',
    };

    expect(backendIssueToGitHubIssue(issue)).toMatchObject({
      id: 11,
      number: 77,
      title: 'Blank GitHub page',
      state: 'open',
      htmlUrl: 'https://github.com/planora/web/issues/77',
      labels: [
        { name: 'bug', color: '64748b' },
        { name: 'frontend', color: '64748b' },
      ],
      comments: 0,
    });
  });

  it('treats an already-linked repository conflict as the existing connection', async () => {
    const repository: BackendGithubRepository = {
      integrationId: 42,
      projectId: 7,
      repositoryFullName: 'planora/web',
      repositoryUrl: 'https://github.com/planora/web',
      tokenType: 'OAUTH',
      active: true,
    };
    jest.spyOn(gitHubApi, 'linkRepository').mockRejectedValue({
      response: {
        status: 409,
        data: { error: 'CONFLICT', message: "Repository 'planora/web' is already linked to this project" },
      },
    });
    jest.spyOn(gitHubApi, 'getLinkedRepositories').mockResolvedValue([repository]);

    await expect(persistProjectGitHubConnection('7', 'Planora/Web')).resolves.toMatchObject({
      integrationId: 42,
      repoFullName: 'planora/web',
      source: 'backend',
    });
    expect(gitHubApi.getLinkedRepositories).toHaveBeenCalledWith(7);
  });

  it('keeps surfacing a repository conflict when the linked repo cannot be found', async () => {
    const conflict = {
      response: {
        status: 409,
        data: { error: 'CONFLICT', message: "Repository 'planora/api' is already linked to this project" },
      },
    };
    jest.spyOn(gitHubApi, 'linkRepository').mockRejectedValue(conflict);
    jest.spyOn(gitHubApi, 'getLinkedRepositories').mockResolvedValue([]);

    await expect(persistProjectGitHubConnection(7, 'planora/api')).rejects.toBe(conflict);
  });
});
