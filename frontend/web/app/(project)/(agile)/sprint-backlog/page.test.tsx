import { render, screen, waitFor } from '@testing-library/react';
import SprintBacklogPage from './page';
import api from '@/lib/axios';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('@/lib/axios', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  },
}));

// Mock child components to simplify unit test
jest.mock('./components/BacklogCard', () => ({
  __esModule: true,
  default: ({ sprint }: { sprint: { name: string } }) => <div data-testid="sprint-card">{sprint.name}</div>,
}));

jest.mock('./components/ProductBacklogSection', () => ({
  __esModule: true,
  default: () => <div data-testid="product-backlog">Product Backlog</div>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('SprintBacklogPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially and then displays sprints', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/sprints/project/')) {
        return Promise.resolve({ data: [{ id: 1, name: 'Sprint 1', status: 'NOT_STARTED' }] });
      }
      if (url.includes('/api/tasks/project/')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/api/projects/') && url.includes('/members')) {
        return Promise.resolve({
          data: [
            {
              user: { userId: 1, email: 'user@example.com' },
              role: 'OWNER',
            },
          ],
        });
      }
      if (/\/api\/projects\/\d+$/.test(url)) {
        return Promise.resolve({ data: { id: 123, projectKey: 'TEST', name: 'Test Project', type: 'AGILE' } });
      }
      if (url.includes('/api/labels/project/')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.reject(new Error('not found'));
    });

    render(<SprintBacklogPage />);

    await waitFor(() => {
      expect(screen.getByTestId('sprint-card')).toBeInTheDocument();
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });
  });

  it('shows error message if no projectId is provided', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: () => null,
    });

    render(<SprintBacklogPage />);

    expect(await screen.findByText('No project selected.')).toBeInTheDocument();
  });
});
