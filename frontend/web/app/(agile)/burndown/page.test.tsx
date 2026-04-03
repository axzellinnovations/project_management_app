import { render, screen, waitFor } from '@testing-library/react';
import BurndownPage from './page';
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
  },
}));

// Mock chart to avoid Recharts errors in JSDOM
jest.mock('./components/BurndownChart', () => ({
  __esModule: true,
  default: () => <div data-testid="burndown-chart">Chart</div>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('BurndownPage', () => {
  it('renders burndown data correctly after fetching', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/sprints/active/')) {
        return Promise.resolve({ data: { id: 1, name: 'Sprint 1', startDate: '2026-04-01', endDate: '2026-04-14' } });
      }
      if (url.includes('/api/tasks/sprint/')) {
        return Promise.resolve({ data: [{ id: 101, storyPoints: 5, status: 'DONE', completedAt: '2026-04-03' }] });
      }
      return Promise.reject(new Error('error'));
    });

    render(<BurndownPage />);

    await waitFor(() => {
      expect(screen.getByTestId('burndown-chart')).toBeInTheDocument();
      expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    });
  });
});
