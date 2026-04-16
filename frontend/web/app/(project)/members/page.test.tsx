import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import MembersPage from './page';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockGetSearchParam = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
  useSearchParams: () => ({
    get: mockGetSearchParam,
  }),
}));

describe('members root route compatibility wrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSearchParam.mockReturnValue(null);
    window.localStorage.clear();
  });

  it('redirects to canonical members route using query projectId', async () => {
    mockGetSearchParam.mockImplementation((key: string) => (key === 'projectId' ? '7' : null));

    render(<MembersPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/members/7');
    });
  });

  it('falls back to currentProjectId from localStorage', async () => {
    window.localStorage.setItem('currentProjectId', '12');

    render(<MembersPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/members/12');
    });
  });

  it('prefers query projectId over localStorage value', async () => {
    mockGetSearchParam.mockImplementation((key: string) => (key === 'projectId' ? '41' : null));
    window.localStorage.setItem('currentProjectId', '9');

    render(<MembersPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/members/41');
    });
  });

  it('shows fallback empty state when no project context is available', async () => {
    render(<MembersPage />);

    expect(await screen.findByText('Select a project first')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Dashboard' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard');
  });
});
