import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MembersPage from './page';
import axios from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

const mockUseParams = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt || ''} />,
}));

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

jest.mock('@/components/shared/BottomSheet', () => ({
  __esModule: true,
  default: ({ isOpen, title, children }: { isOpen: boolean; title: string; children: React.ReactNode }) =>
    isOpen ? (
      <div data-testid="bottom-sheet">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null,
}));

jest.mock('@/lib/auth', () => ({
  getUserFromToken: jest.fn(),
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

type Member = {
  id: number;
  role: string;
  user: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    profilePicUrl?: string;
  };
  taskCount: number;
  status: string;
  lastActive?: string;
};

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetUserFromToken = getUserFromToken as jest.Mock;

const membersFixture: Member[] = [
  {
    id: 1,
    role: 'OWNER',
    user: { userId: 101, username: 'alice', fullName: 'Alice Owner', email: 'alice@example.com' },
    taskCount: 5,
    status: 'Active',
    lastActive: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 2,
    role: 'MEMBER',
    user: { userId: 102, username: 'bob', fullName: 'Bob Member', email: 'bob@example.com' },
    taskCount: 2,
    status: 'Active',
    lastActive: '2026-04-01T11:00:00.000Z',
  },
];

const pendingFixture = [
  {
    id: 10,
    email: 'pending@example.com',
    invitedAt: '2026-04-01T12:00:00.000Z',
    status: 'Pending',
  },
];

const usersFixture = [
  {
    userId: 101,
    username: 'alice',
    email: 'alice@example.com',
    fullName: 'Alice Owner',
    profilePicUrl: '/avatars/alice.png',
  },
  {
    userId: 102,
    username: 'bob',
    email: 'bob@example.com',
    fullName: 'Bob Member',
    profilePicUrl: '/avatars/bob.png',
  },
];

const mockGetHandlers = ({
  members = membersFixture,
  pending = pendingFixture,
  users = usersFixture,
}: {
  members?: Member[];
  pending?: Array<{ id: number; email: string; invitedAt: string; status: string }>;
  users?: typeof usersFixture;
}) => {
  mockedAxios.get.mockImplementation((url: string) => {
    if (url === '/api/projects/7/members') {
      return Promise.resolve({ data: members });
    }
    if (url === '/api/projects/7/pending-invites') {
      return Promise.resolve({ data: pending });
    }
    if (url === '/api/auth/users') {
      return Promise.resolve({ data: users });
    }
    return Promise.resolve({ data: [] });
  });
};

describe('members root page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ projectId: '7', id: '7' });
    mockedGetUserFromToken.mockReturnValue({ userId: 101, email: 'alice@example.com' });
    mockGetHandlers({});
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.patch.mockResolvedValue({ data: {} });
  });

  it('shows loading skeleton while members request is pending', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => undefined));

    const { container } = render(<MembersPage />);

    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('renders members and supports search and pending tab filtering', async () => {
    render(<MembersPage />);

    await screen.findByText('Bob Member');
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search members…'), {
      target: { value: 'bob' },
    });

    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.queryByText('Alice Owner')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search members…'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Pending/i })[0]);

    expect(screen.getByText('Pending Invites')).toBeInTheDocument();
    expect(screen.getByText('pending@example.com')).toBeInTheDocument();
  });

  it('renders empty state when no members and no pending invites exist', async () => {
    mockGetHandlers({ members: [], pending: [], users: [] });

    render(<MembersPage />);

    await screen.findByText('No members found');
    expect(screen.getByRole('button', { name: 'Invite Member' })).toBeInTheDocument();
  });

  it('validates invite form for duplicate member and duplicate pending email', async () => {
    render(<MembersPage />);

    await screen.findByText('Alice Owner');

    fireEvent.click(screen.getAllByRole('button', { name: /Invite/i })[0]);
    const inviteSheet = screen.getByTestId('bottom-sheet');

    fireEvent.change(within(inviteSheet).getByPlaceholderText('colleague@company.com'), {
      target: { value: 'bob@example.com' },
    });
    fireEvent.change(within(inviteSheet).getByRole('combobox'), {
      target: { value: 'MEMBER' },
    });
    fireEvent.click(within(inviteSheet).getByRole('button', { name: 'Send Invite' }));

    await waitFor(() => {
      expect(screen.getAllByText('This user is already a member of the project.').length).toBeGreaterThan(0);
    });

    fireEvent.change(within(inviteSheet).getByPlaceholderText('colleague@company.com'), {
      target: { value: 'pending@example.com' },
    });
    fireEvent.click(within(inviteSheet).getByRole('button', { name: 'Send Invite' }));

    await waitFor(() => {
      expect(screen.getAllByText('An invitation has already been sent to this email.').length).toBeGreaterThan(0);
    });
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('surfaces role change errors when role update request fails', async () => {
    mockedAxios.patch.mockRejectedValueOnce({
      response: { data: { message: 'Role update denied' } },
    });

    render(<MembersPage />);

    await screen.findByText('Bob Member');

    fireEvent.click(screen.getByRole('button', { name: /^Member$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Admin$/i }));

    await waitFor(() => {
      expect(screen.getByText('Role update denied')).toBeInTheDocument();
    });
  });
});
