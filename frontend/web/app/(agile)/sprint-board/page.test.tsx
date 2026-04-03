import { render, screen, waitFor } from '@testing-library/react';
import SprintBoardPage from './page';
import api from '@/lib/axios';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
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
  default: ({ column }: { column: { name: string } }) => <div data-testid="board-column">{column.name}</div>,
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
      if (url.includes('/api/sprints/active/')) {
        return Promise.resolve({ data: { id: 1, name: 'Active Sprint' } });
      }
      if (url.includes('/api/sprintboards/sprint/')) {
        return Promise.resolve({ data: { id: 10, columns: [{ id: 100, name: 'To Do' }] } });
      }
      return Promise.reject(new Error('error'));
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
      if (url.includes('/api/sprints/active/')) {
        return Promise.resolve({ status: 204 }); // No Content
      }
      return Promise.reject(new Error('error'));
    });

    render(<SprintBoardPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active sprint found for this project/i)).toBeInTheDocument();
    });
  });
});
