import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import GitHubProjectPage from './GitHubProjectPage';
import { ensureValidToken, getUserFromToken } from '@/lib/auth';
import { fetchMembers } from '@/services/members-service';
import {
  fetchGitHubConnectionStatus,
  fetchGitHubUser,
  fetchProjectGitHubConnection,
  fetchProjectPullRequests,
  fetchProjectCommits,
  fetchProjectIssues,
  fetchGitHubAutomationRules,
  fetchGitHubAutomationLogs,
  getProjectGitHubRepo,
  getSavedGitHubAccounts,
  inviteGitHubCollaborator,
  persistProjectGitHubConnection,
  setProjectGitHubConnection,
  type ProjectGitHubConnection,
} from '@/services/github-service';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt?: string }) => (
    <span role="img" aria-label={alt ?? ''} data-src={src} />
  ),
}));

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = ({
        children,
        layout: _layout,
        transition: _transition,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        variants: _variants,
        whileHover: _whileHover,
        whileTap: _whileTap,
        whileDrag: _whileDrag,
        whileFocus: _whileFocus,
        whileInView: _whileInView,
        viewport: _viewport,
        onViewportEnter: _onViewportEnter,
        onViewportLeave: _onViewportLeave,
        ...props
      }: { children?: ReactNode; [key: string]: unknown }) => {
        const Tag = tag as 'div';
        return <Tag {...props}>{children}</Tag>;
      };
      Component.displayName = `motion.${tag}`;
      return Component;
    },
  }),
}));

jest.mock('@/lib/auth', () => ({
  ensureValidToken: jest.fn(),
  getUserFromToken: jest.fn(),
}));

jest.mock('@/services/members-service', () => ({
  fetchMembers: jest.fn(),
}));

jest.mock('@/services/github-service', () => ({
  clearProjectGitHubRepo: jest.fn(),
  deleteGitHubAutomationRule: jest.fn(),
  fetchCommits: jest.fn(),
  fetchGitHubAutomationLogs: jest.fn(),
  fetchGitHubAutomationRules: jest.fn(),
  fetchGitHubConnectionStatus: jest.fn(),
  fetchGitHubUser: jest.fn(),
  fetchImportedGitHubIssueNumbers: jest.fn(() => Promise.resolve([])),
  fetchIssues: jest.fn(),
  inviteGitHubCollaborator: jest.fn(),
  fetchProjectCommits: jest.fn(),
  fetchProjectGitHubConnection: jest.fn(),
  fetchProjectIssues: jest.fn(),
  fetchProjectPullRequests: jest.fn(),
  fetchRepositories: jest.fn(() => Promise.resolve([])),
  getProjectGitHubRepo: jest.fn(),
  getSavedGitHubAccounts: jest.fn(),
  hasConnectedGitHubAccount: jest.fn(() => true),
  persistProjectGitHubConnection: jest.fn(),
  setGitHubAutomationRuleEnabled: jest.fn(),
  setProjectGitHubConnection: jest.fn(),
  syncProjectGitHub: jest.fn(),
  upsertSavedGitHubAccount: jest.fn(),
}));

jest.mock('@/components/providers/GlobalNotificationProvider', () => ({
  useGlobalNotifications: () => ({
    notifications: [],
    markAsRead: jest.fn(),
  }),
}));

jest.mock('@/ws/stomp-provider', () => ({
  StompProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useStomp: () => ({ subscribe: jest.fn(() => null) }),
}));

jest.mock('@/hooks/useGithubPRSocket', () => ({
  useGithubPRSocket: jest.fn(),
}));

jest.mock('@/hooks/useGithubCISocket', () => ({
  useGithubCISocket: jest.fn(),
}));

jest.mock('@/hooks/useGithubIssueSocket', () => ({
  useGithubIssueSocket: jest.fn(),
}));

jest.mock('@/hooks/useGithubTaskBadgeSocket', () => ({
  useGithubTaskBadgeSocket: jest.fn(),
}));

jest.mock('@/components/github/CIStatusBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="ci-status-banner" />,
}));

jest.mock('@/components/github/GitHubAutomationsPanel', () => ({
  __esModule: true,
  default: () => <div data-testid="github-automations-panel" />,
}));

jest.mock('@/components/github/AutomationRuleBuilder', () => ({
  __esModule: true,
  default: () => <div data-testid="automation-rule-builder" />,
}));

jest.mock('@/components/github/ImportIssueModal', () => ({
  __esModule: true,
  default: () => <div data-testid="import-issue-modal" />,
}));

jest.mock('@/components/ui/OverlayPortal', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui', () => ({
  Popover: ({ trigger, children }: { trigger: ReactNode; children: ReactNode }) => (
    <div>
      {trigger}
      {children}
    </div>
  ),
  toast: jest.fn(),
}));

const mockedEnsureValidToken = ensureValidToken as jest.MockedFunction<typeof ensureValidToken>;
const mockedGetUserFromToken = getUserFromToken as jest.MockedFunction<typeof getUserFromToken>;
const mockedFetchMembers = fetchMembers as jest.MockedFunction<typeof fetchMembers>;
const mockedFetchGitHubConnectionStatus = fetchGitHubConnectionStatus as jest.MockedFunction<typeof fetchGitHubConnectionStatus>;
const mockedFetchGitHubUser = fetchGitHubUser as jest.MockedFunction<typeof fetchGitHubUser>;
const mockedFetchProjectGitHubConnection = fetchProjectGitHubConnection as jest.MockedFunction<typeof fetchProjectGitHubConnection>;
const mockedFetchProjectPullRequests = fetchProjectPullRequests as jest.MockedFunction<typeof fetchProjectPullRequests>;
const mockedFetchProjectCommits = fetchProjectCommits as jest.MockedFunction<typeof fetchProjectCommits>;
const mockedFetchProjectIssues = fetchProjectIssues as jest.MockedFunction<typeof fetchProjectIssues>;
const mockedFetchGitHubAutomationRules = fetchGitHubAutomationRules as jest.MockedFunction<typeof fetchGitHubAutomationRules>;
const mockedFetchGitHubAutomationLogs = fetchGitHubAutomationLogs as jest.MockedFunction<typeof fetchGitHubAutomationLogs>;
const mockedGetProjectGitHubRepo = getProjectGitHubRepo as jest.MockedFunction<typeof getProjectGitHubRepo>;
const mockedGetSavedGitHubAccounts = getSavedGitHubAccounts as jest.MockedFunction<typeof getSavedGitHubAccounts>;
const mockedInviteGitHubCollaborator = inviteGitHubCollaborator as jest.MockedFunction<typeof inviteGitHubCollaborator>;
const mockedPersistProjectGitHubConnection = persistProjectGitHubConnection as jest.MockedFunction<typeof persistProjectGitHubConnection>;
const mockedSetProjectGitHubConnection = setProjectGitHubConnection as jest.MockedFunction<typeof setProjectGitHubConnection>;

const backendConnection: ProjectGitHubConnection = {
  repoId: 42,
  integrationId: 42,
  repoName: 'web',
  repoFullName: 'planora/web',
  repositoryUrl: 'https://github.com/planora/web',
  private: false,
  defaultBranch: 'main',
  ownerLogin: 'planora',
  connectedAt: '2026-07-06T10:00:00',
  active: true,
  source: 'backend',
};

function arrangeDefaults() {
  mockedEnsureValidToken.mockResolvedValue('access-token');
  mockedGetUserFromToken.mockReturnValue({ email: 'owner@example.com', userId: 10 });
  mockedFetchMembers.mockReturnValue(new Promise(() => undefined));
  mockedFetchGitHubConnectionStatus.mockResolvedValue({ connected: true });
  mockedFetchProjectGitHubConnection.mockResolvedValue(backendConnection);
  mockedFetchProjectPullRequests.mockResolvedValue([]);
  mockedFetchProjectCommits.mockResolvedValue([]);
  mockedFetchProjectIssues.mockResolvedValue([]);
  mockedFetchGitHubUser.mockResolvedValue({
    login: 'octo',
    name: 'Octo',
    avatar_url: '',
    html_url: 'https://github.com/octo',
    public_repos: 1,
    followers: 1,
  });
  mockedFetchGitHubAutomationRules.mockResolvedValue([]);
  mockedFetchGitHubAutomationLogs.mockResolvedValue([]);
  mockedGetProjectGitHubRepo.mockReturnValue(null);
  mockedGetSavedGitHubAccounts.mockReturnValue([]);
  mockedInviteGitHubCollaborator.mockResolvedValue({
    projectId: 7,
    integrationId: 42,
    repositoryFullName: 'planora/web',
    githubUsername: 'octocat',
    permission: 'push',
    githubStatus: 201,
    status: 'INVITATION_CREATED',
    message: 'GitHub collaborator invitation created',
  });
}

describe('GitHubProjectPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    arrangeDefaults();
  });

  it('renders an in-page loading state during initialization', () => {
    mockedEnsureValidToken.mockReturnValue(new Promise(() => undefined) as ReturnType<typeof ensureValidToken>);

    render(<GitHubProjectPage projectId="7" />);

    expect(screen.getByText('Loading GitHub view')).toBeInTheDocument();
  });

  it('renders app auth required when Planora auth cannot be restored', async () => {
    mockedEnsureValidToken.mockResolvedValue(null);

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('Sign in required')).toBeInTheDocument();
  });

  it('renders GitHub account connect state when GitHub is disconnected', async () => {
    mockedFetchGitHubConnectionStatus.mockResolvedValue({ connected: false });

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findAllByText('Connect to GitHub')).not.toHaveLength(0);
    expect(mockedFetchProjectGitHubConnection).not.toHaveBeenCalled();
  });

  it('renders repository selection state when no project repository is linked', async () => {
    mockedFetchProjectGitHubConnection.mockResolvedValue(null);

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('Choose a repository')).toBeInTheDocument();
  });

  it('loads backend linked repository and renders the dashboard', async () => {
    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('planora/web')).toBeInTheDocument();
    expect(screen.getByTestId('github-automations-panel')).toBeInTheDocument();
    expect(mockedSetProjectGitHubConnection).toHaveBeenCalledWith('7', backendConnection);
    await waitFor(() => expect(mockedFetchProjectPullRequests).toHaveBeenCalledWith('7', 'planora/web'));
  });

  it('migrates a legacy localStorage repository into the backend integration', async () => {
    const legacyConnection: ProjectGitHubConnection = {
      repoId: 99,
      repoName: 'mobile',
      repoFullName: 'planora/mobile',
      private: true,
      defaultBranch: 'develop',
      ownerLogin: 'planora',
      connectedAt: '2026-07-05T10:00:00',
      source: 'legacy',
    };
    const migratedConnection: ProjectGitHubConnection = {
      ...backendConnection,
      repoFullName: 'planora/mobile',
      repoName: 'mobile',
    };
    mockedFetchProjectGitHubConnection.mockResolvedValue(null);
    mockedGetProjectGitHubRepo.mockReturnValue(legacyConnection);
    mockedPersistProjectGitHubConnection.mockResolvedValue(migratedConnection);

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('planora/mobile')).toBeInTheDocument();
    expect(mockedPersistProjectGitHubConnection).toHaveBeenCalledWith('7', 'planora/mobile');
  });

  it('recovers a conflicting legacy migration by refetching linked repositories', async () => {
    mockedFetchProjectGitHubConnection
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(backendConnection);
    mockedGetProjectGitHubRepo.mockReturnValue({
      ...backendConnection,
      source: 'legacy',
    });
    mockedPersistProjectGitHubConnection.mockRejectedValue(new Error('Repository already linked'));

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('planora/web')).toBeInTheDocument();
    expect(mockedFetchProjectGitHubConnection).toHaveBeenCalledTimes(2);
  });

  it('shows a visible route error when linked repository fetch fails', async () => {
    mockedFetchProjectGitHubConnection.mockRejectedValue(new Error('Backend unavailable'));

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('Unable to load GitHub view')).toBeInTheDocument();
    expect(screen.getByText('Backend unavailable')).toBeInTheDocument();
  });

  it('allows owner/admin users to invite a GitHub collaborator', async () => {
    mockedFetchMembers.mockResolvedValue([{
      id: 1,
      role: 'OWNER',
      user: { userId: 10, username: 'owner', email: 'owner@example.com' },
    }, {
      id: 2,
      role: 'MEMBER',
      user: {
        userId: 11,
        username: 'octocat',
        email: 'octocat@planora.test',
        githubUsername: 'octocat',
        githubEmail: 'octocat@users.noreply.github.com',
      },
    }, {
      id: 3,
      role: 'MEMBER',
      user: { userId: 12, username: 'nohub', email: 'nohub@planora.test' },
    }] as Awaited<ReturnType<typeof fetchMembers>>);

    render(<GitHubProjectPage projectId="7" />);

    const inviteButton = await screen.findByRole('button', { name: /^Invite$/ });
    fireEvent.click(inviteButton);
    expect(screen.getByText('@octocat')).toBeInTheDocument();
    expect(screen.getAllByText('Connect GitHub in profile first.').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /octocat/i }));
    const inviteButtons = screen.getAllByRole('button', { name: /^Invite$/ });
    fireEvent.click(inviteButtons[inviteButtons.length - 1]);

    await waitFor(() => expect(mockedInviteGitHubCollaborator).toHaveBeenCalledWith('7', {
      identifier: 'octocat',
      permission: 'push',
    }));
    expect(await screen.findByText('Invitation sent to @octocat.')).toBeInTheDocument();
  });

  it('renders existing collaborator success when GitHub updates access', async () => {
    mockedFetchMembers.mockResolvedValueOnce([{
      id: 1,
      role: 'OWNER',
      user: {
        userId: 10,
        username: 'owner',
        email: 'owner@example.com',
        githubUsername: 'ownerhub',
        githubEmail: 'owner@users.noreply.github.com',
      },
    }] as Awaited<ReturnType<typeof fetchMembers>>);
    mockedInviteGitHubCollaborator.mockResolvedValueOnce({
      projectId: 7,
      integrationId: 42,
      repositoryFullName: 'planora/web',
      githubUsername: 'octocat',
      permission: 'maintain',
      githubStatus: 204,
      status: 'COLLABORATOR_UPDATED',
      message: 'GitHub collaborator already has access or permission was updated',
    });

    render(<GitHubProjectPage projectId="7" />);

    fireEvent.click(await screen.findByRole('button', { name: /^Invite$/ }));
    fireEvent.change(screen.getByPlaceholderText('octocat or teammate@example.com'), {
      target: { value: 'octocat' },
    });
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'maintain' },
    });
    const inviteButtons = screen.getAllByRole('button', { name: /^Invite$/ });
    fireEvent.click(inviteButtons[inviteButtons.length - 1]);

    await waitFor(() => expect(mockedInviteGitHubCollaborator).toHaveBeenCalledWith('7', {
      identifier: 'octocat',
      permission: 'maintain',
    }));
    expect(await screen.findByText('@octocat already has access or was updated.')).toBeInTheDocument();
  });

  it('renders backend invite errors in the modal', async () => {
    mockedFetchMembers.mockResolvedValueOnce([{
      id: 1,
      role: 'OWNER',
      user: {
        userId: 10,
        username: 'owner',
        email: 'owner@example.com',
        githubUsername: 'ownerhub',
        githubEmail: 'owner@users.noreply.github.com',
      },
    }] as Awaited<ReturnType<typeof fetchMembers>>);
    mockedInviteGitHubCollaborator.mockRejectedValueOnce({
      response: {
        data: {
          message: 'GitHub username required for private-email accounts.',
        },
      },
    });

    render(<GitHubProjectPage projectId="7" />);

    fireEvent.click(await screen.findByRole('button', { name: /^Invite$/ }));
    fireEvent.change(screen.getByPlaceholderText('octocat or teammate@example.com'), {
      target: { value: 'private-email@example.com' },
    });
    const inviteButtons = screen.getAllByRole('button', { name: /^Invite$/ });
    fireEvent.click(inviteButtons[inviteButtons.length - 1]);

    expect(await screen.findByText('GitHub username required for private-email accounts.')).toBeInTheDocument();
  });

  it('renders pull requests with status badges and filters by state', async () => {
    mockedFetchProjectPullRequests.mockResolvedValue([
      {
        id: 101,
        number: 1,
        title: 'Open Feature PR',
        state: 'open',
        merged_at: null,
        created_at: '2026-07-06T10:00:00Z',
        updated_at: '2026-07-06T10:00:00Z',
        html_url: 'https://github.com/planora/web/pull/1',
        draft: false,
        user: { login: 'alice', avatar_url: 'https://github.com/alice.png', html_url: 'https://github.com/alice' },
        labels: [],
        head: { ref: 'feat/open' },
        base: { ref: 'main' },
      },
      {
        id: 102,
        number: 2,
        title: 'Merged Fix PR',
        state: 'closed',
        merged_at: '2026-07-06T11:00:00Z',
        created_at: '2026-07-06T09:00:00Z',
        updated_at: '2026-07-06T11:00:00Z',
        html_url: 'https://github.com/planora/web/pull/2',
        draft: false,
        user: { login: 'bob', avatar_url: 'https://github.com/bob.png', html_url: 'https://github.com/bob' },
        labels: [],
        head: { ref: 'fix/merged' },
        base: { ref: 'main' },
      },
    ]);

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('Open Feature PR')).toBeInTheDocument();
    expect(screen.getByText('Merged Fix PR')).toBeInTheDocument();
    expect(screen.getAllByText('Open').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Merged').length).toBeGreaterThan(0);

    // Filter to merged
    fireEvent.click(screen.getByRole('button', { name: /^merged$/i }));
    expect(screen.queryByText('Open Feature PR')).not.toBeInTheDocument();
    expect(screen.getByText('Merged Fix PR')).toBeInTheDocument();

    // Filter to open
    const openFilterButtons = screen.getAllByRole('button', { name: /^open$/i });
    fireEvent.click(openFilterButtons[0]);
    expect(screen.getByText('Open Feature PR')).toBeInTheDocument();
    expect(screen.queryByText('Merged Fix PR')).not.toBeInTheDocument();
  });

  it('hides collaborator invite controls for regular project members', async () => {
    mockedFetchMembers.mockResolvedValue([{ userId: 10, role: 'MEMBER' }] as Awaited<ReturnType<typeof fetchMembers>>);

    render(<GitHubProjectPage projectId="7" />);

    expect(await screen.findByText('planora/web')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Invite$/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Invite collaborator')).not.toBeInTheDocument();
  });
});
