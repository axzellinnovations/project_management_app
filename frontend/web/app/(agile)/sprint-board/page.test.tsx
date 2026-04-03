import { render, screen, waitFor } from '@testing-library/react';
import SprintBoardPage from './page';
import api from '@/lib/axios';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/sprint-board'),
  useParams: jest.fn(() => ({ id: '123' })),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('./components/SprintBoardHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="board-header">Header</div>,
}));

jest.mock('./components/SprintColumn', () => ({
  __esModule: true,
  default: ({ column }: any) => <div data-testid="board-column">{column.name}</div>,
}));

jest.mock('../../nav/Sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar">Sidebar</div>,
}));

jest.mock('../../nav/TopBar', () => ({
  __esModule: true,
  default: () => <div data-testid="topbar">TopBar</div>,
}));

jest.mock('@/lib/navigation-context', () => ({
  useNavigation: jest.fn(() => ({
    isSidebarOpen: true,
    toggleSidebar: jest.fn(),
    closeSidebar: jest.fn(),
  })),
  NavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('SprintBoardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading initially and then columns', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/projects/123')) {
        return Promise.resolve({ data: { id: 123, type: 'AGILE' } });
      }
      if (url.includes('/api/sprints/project/123')) {
        return Promise.resolve({ data: [{ id: 1, name: 'Active Sprint', status: 'ACTIVE' }] });
      }
      if (url.includes('/api/sprintboards/sprint/1')) {
        return Promise.resolve({ data: { id: 10, columns: [{ id: 100, name: 'To Do', columnStatus: 'TODO', tasks: [] }] } });
      }
      return Promise.resolve({ data: [] });
    });

    render(<SprintBoardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('board-column')).toBeInTheDocument();
      expect(screen.getByText('To Do')).toBeInTheDocument();
    });
  });

  it('shows non-active sprint state message when no active sprint for project', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/projects/123')) {
        return Promise.resolve({ data: { id: 123, type: 'AGILE' } });
      }
      if (url.includes('/api/sprints/project/123')) {
        return Promise.resolve({ data: [{ id: 1, name: 'Completed Sprint', status: 'COMPLETED' }] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<SprintBoardPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active sprint/i)).toBeInTheDocument();
    });
  });
});
