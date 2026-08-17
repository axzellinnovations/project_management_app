import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TopBar from './TopBar';
import { useProjectContext } from '@/hooks/useProjectContext';

const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/summary/42',
}));

jest.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ profilePicUrl: null }),
}));

jest.mock('@/hooks/useProjectContext', () => ({
  subscribeToBrowserStorage: () => () => undefined,
  useProjectContext: jest.fn(),
}));

jest.mock('@/hooks/useProjectTabs', () => ({
  useProjectTabs: () => ({
    tabs: [],
    activeTab: 'summary',
    getTabHref: () => '/summary/42',
    isProjectPage: true,
  }),
}));

jest.mock('@/lib/auth', () => ({
  getUserFromToken: () => ({ username: 'Taylor' }),
  getValidToken: () => 'token',
  getUserIdFromToken: () => 7,
}));

jest.mock('@/lib/navigation-context', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('@/services/projects-service', () => ({
  fetchRecentProjects: jest.fn(() => Promise.resolve([])),
  updateProjectDetails: jest.fn(),
}));

jest.mock('./topbar/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notifications" />,
}));

jest.mock('./topbar/TabBar', () => ({
  TabBar: () => <div data-testid="tabs" />,
}));

jest.mock('./topbar/GlobalSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="global-search" />,
}));

jest.mock('@/components/shared/ProjectTypeIcon', () => ({
  ProjectTypeIcon: () => <span data-testid="project-type-icon" />,
}));

jest.mock('@/components/ui/Modal', () => ({
  Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (
    open ? <div role="dialog">{children}</div> : null
  ),
}));

const mockedUseProjectContext = useProjectContext as jest.MockedFunction<typeof useProjectContext>;

describe('TopBar Figma navigation', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockedUseProjectContext.mockReturnValue({
      projectId: '42',
      projectName: 'Atlas',
      projectType: 'KANBAN',
      isAgile: false,
      isFavorite: false,
      figmaUrl: 'https://www.figma.com/file/abc123/My-Design',
      projectOwnerId: 7,
      setFigmaUrl: jest.fn(),
      mutateProject: jest.fn(),
      toggleFavorite: jest.fn(),
      switchProject: jest.fn(),
    });
  });

  it('opens the saved Figma link inside Planora instead of a new browser tab', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);

    render(<TopBar />);

    fireEvent.click(screen.getByRole('button', { name: /open figma in planora/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/project/42/figma'));
    expect(openSpy).not.toHaveBeenCalled();

    openSpy.mockRestore();
  });
});
