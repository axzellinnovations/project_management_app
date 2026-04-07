import { render, screen, waitFor } from '@testing-library/react';
import CalendarPage from './page';
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

jest.mock('./components/MonthCalendarView', () => ({
  __esModule: true,
  default: () => <div data-testid="month-view">Month View</div>,
}));

const mockedApi = api as jest.Mocked<typeof api>;
const mockedUseSearchParams = useSearchParams as jest.Mock;

describe('CalendarPage', () => {
  it('renders correctly and fetches events', async () => {
    mockedUseSearchParams.mockReturnValue({
      get: (key: string) => (key === 'projectId' ? '123' : null),
    });

    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/api/tasks/calendar/')) {
        return Promise.resolve({ data: [{ id: 101, title: 'Meeting', startDate: '2026-04-03' }] });
      }
      return Promise.reject(new Error('error'));
    });

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByTestId('month-view')).toBeInTheDocument();
    });
  });
});
