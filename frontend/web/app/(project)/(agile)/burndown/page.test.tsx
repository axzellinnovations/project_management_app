import { render, screen, waitFor } from '@testing-library/react';
import BurndownPage from './page';
import api from '@/lib/axios';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
  usePathname: jest.fn(() => '/burndown'),
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
      if (url.includes('/api/sprints/project/')) {
        return Promise.resolve({ 
          data: [{ id: 1, name: 'Sprint 1', startDate: '2026-04-01', endDate: '2026-04-14', status: 'ACTIVE' }] 
        });
      }
      if (url.includes('/api/burndown/sprint/')) {
        return Promise.resolve({ 
          data: {  
            id: 1, 
            sprintName: 'Sprint 1', 
            totalStoryPoints: 10, 
            dataPoints: [
              { day: '2026-04-01', remainingPoints: 10, idealPoints: 10 },
              { day: '2026-04-02', remainingPoints: 5, idealPoints: 5 }
            ] 
          } 
        });
      }
      return Promise.reject(new Error('error'));
    });

    render(<BurndownPage />);

    await waitFor(() => {
      expect(screen.getByTestId('burndown-chart')).toBeInTheDocument();
t selection area or just check that it's present (getAllByText)
      expect(screen.getAllByText('Sprint 1').length).toBeGreaterThan(0);
    });
  });
});
