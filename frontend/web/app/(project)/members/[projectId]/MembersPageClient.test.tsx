import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MembersPageClient from './MembersPageClient';
import axios from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

jest.mock('next/image', () => ({
  __esModule: true,
  /* eslint-disable-next-line @next/next/no-img-element */
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img {...props} alt={props.alt || ''} />,
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
    role: 'ADMIN',
    user: { userId: 201, username: 'alice', fullName: 'Alice Admin', email: 'alice@example.com' },
    taskCount: 8,
    status: 'Active',
    lastActive: '2026-04-01T10:00:00.000Z',
  },
  {
    id: 2,
    role: 'MEMBER',
    user: { userId: 202, username: 'bob', fullName: 'Bob Member', email: 'bob@example.com' },
    taskCount: 3,
    status: 'Active',
    lastActive: '2026-04-01T11:00:00.000Z',
  },
  {
    id: 3,
    role: 'VIEWER',
    user: { userId: 203, username: 'carol', fullName: 'Carol Viewer', email: 'carol@example.com' },
    taskCount: 0,
    status: 'Active',
    lastActive: '2026-04-01T12:00:00.000Z',
  },
];

const pendingFixture = [
  {
    id: 300,
    email: 'invitee@example.com',
    invitedAt: '2026-04-01T14:00:00.000Z',
    status: 'Pending',
    role: 'MEMBER',
  },
];

const usersFixture = [
  {
    userId: 201,
    username: 'alice',
    fullName: 'Alice Admin',
    email: 'alice@example.com',
    profilePicUrl: '/avatars/alice.png',
  },
  {
    userId: 202,
    username: 'bob',
    fullName: 'Bob Member',
    email: 'bob@example.com',
    profilePicUrl: '/avatars/bob.png',
  },
];

const setupGetMocks = ({
  members = membersFixture,
  pending = pendingFixture,
  users = usersFixture,
}: {
  members?: Member[];
  pending?: Array<{ id: number; email: string; invitedAt: string; status: string; role: string }>;
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

describe('MembersPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetUserFromToken.mockReturnValue({ userId: 201, email: 'alice@example.com' });
    setupGetMocks({});
    mockedAxios.patch.mockResolvedValue({ data: {} });
    mockedAxios.post.mockResolvedValue({ data: {} });
    mockedAxios.delete.mockResolvedValue({ data: {} });
  });

  it('renders loading state then members table and stats', async () => {
    render(<MembersPageClient projectId="7" />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await screen.findByText('Team Members');
    expect(screen.getByText('Manage your team and their permissions')).toBeInTheDocument();
    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.getByText('Total Members')).toBeInTheDocument();
  });

  it('supports search and role/status filter combinations', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Alice Admin');

    fireEvent.change(screen.getByPlaceholderText('Search members by name or email...'), {
      target: { value: 'bob' },
    });

    expect(screen.getByText('Bob Member')).toBeInTheDocument();
    expect(screen.queryByText('Alice Admin')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search members by name or email...'), {
      target: { value: '' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Filters' }));

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'VIEWER' } });

    expect(screen.getByText('Carol Viewer')).toBeInTheDocument();
    expect(screen.queryByText('Bob Member')).not.toBeInTheDocument();
  });

  it('shows admin-only role options and updates role successfully', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Bob Member');

    const roleSelect = screen.getAllByDisplayValue('MEMBER')[0];

    expect(within(roleSelect).queryByRole('option', { name: 'OWNER' })).not.toBeInTheDocument();
    expect(within(roleSelect).queryByRole('option', { name: 'ADMIN' })).not.toBeInTheDocument();
    expect(within(roleSelect).getByRole('option', { name: 'MEMBER' })).toBeInTheDocument();
    expect(within(roleSelect).getByRole('option', { name: 'VIEWER' })).toBeInTheDocument();

    fireEvent.change(roleSelect, { target: { value: 'VIEWER' } });

    await waitFor(() => {
      expect(mockedAxios.patch).toHaveBeenCalledWith('/api/projects/7/members/202/role', {
        role: 'VIEWER',
        userId: 202,
      });
      expect(screen.getByText('Role updated successfully!')).toBeInTheDocument();
    });
  });

  it('removes a member after confirmation modal acceptance', async () => {
    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Bob Member');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    const removeHeading = screen.getByText('Remove Member');
    expect(removeHeading).toBeInTheDocument();
    const removeModal = removeHeading.closest('div');
    expect(removeModal).toBeTruthy();
    fireEvent.click(within(removeModal as HTMLElement).getByRole('button', { name: /^Remove$/ }));

    await waitFor(() => {
      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/projects/7/members/202');
      expect(screen.queryByText('Bob Member')).not.toBeInTheDocument();
    });
  });

  it('handles invite modal success and failure scenarios', async () => {
    mockedAxios.post
      .mockRejectedValueOnce({ response: { data: { message: 'Invite failed' } } })
      .mockResolvedValueOnce({ data: {} });

    render(<MembersPageClient projectId="7" />);

    await screen.findByText('Team Members');

    fireEvent.click(screen.getByRole('button', { name: 'Invite Member' }));

    const inviteHeader = screen.getByText('Invite Team Member');
    const inviteModal = inviteHeader.closest('div');
    expect(inviteModal).toBeTruthy();

    fireEvent.change(within(inviteModal as HTMLElement).getByRole('textbox'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(within(inviteModal as HTMLElement).getByRole('combobox'), {
      target: { value: 'MEMBER' },
    });
    fireEvent.click(within(inviteModal as HTMLElement).getByRole('button', { name: /Send Invite/i }));

    await screen.findByText('Invite failed');

    fireEvent.click(within(inviteModal as HTMLElement).getByRole('button', { name: /Send Invite/i }));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenLastCalledWith('/api/projects/7/invitations', {
        email: 'newuser@example.com',
        role: 'MEMBER',
      });
    });
  });
});
