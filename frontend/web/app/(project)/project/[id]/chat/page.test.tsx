import { fireEvent, render, screen } from '@testing-library/react';
import ChatInterface from './page';
import { useChat } from './components/useChat';

const mockUseParams = jest.fn();
const mockUseSearchParams = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  useSearchParams: () => mockUseSearchParams(),
}));

jest.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

jest.mock('./components/useChat', () => ({
  useChat: jest.fn(),
}));

jest.mock('./components/chatSidebar', () => ({
  ChatSidebar: () => <div data-testid="chat-sidebar">Sidebar</div>,
}));

jest.mock('./components/chatMessage', () => ({
  ChatMessages: () => <div data-testid="chat-messages">Messages</div>,
}));

jest.mock('./components/chatInput', () => ({
  ChatInput: ({ disabled, onSendMessage }: { disabled?: boolean; onSendMessage: (msg: string) => void }) => (
    <div data-testid="chat-input" data-disabled={disabled ? 'true' : 'false'}>
      <button onClick={() => onSendMessage('hello from input')}>Send via input</button>
    </div>
  ),
}));

jest.mock('./components/threadPanel', () => ({
  ThreadPanel: () => <div data-testid="thread-panel">Thread</div>,
}));

const mockedUseChat = useChat as jest.Mock;

const createChatState = (overrides: Record<string, unknown> = {}) => ({
  currentUser: 'alice',
  currentUserAliases: ['alice', 'alice@example.com'],
  users: ['alice', 'bob'],
  userProfilePics: {},
  rooms: [{ id: 1, name: 'engineering', pinnedMessageId: null }],
  roomMessages: {},
  messages: [],
  privateMessages: {},
  selectedUser: null,
  selectedRoomId: null,
  privateUnseenCounts: {},
  roomUnseenCounts: {},
  privateLastMessages: {},
  roomLastMessages: {},
  teamUnseenCount: 0,
  teamLastMessage: null,
  onlineUsers: ['alice', 'bob'],
  teamTypingUsers: [],
  roomTypingUsers: {},
  privateTypingUsers: [],
  featureFlags: {
    phaseDEnabled: true,
    phaseEEnabled: true,
    webhooksEnabled: true,
    telemetryEnabled: true,
  },
  searchResults: [],
  isSearchLoading: false,
  commandNotice: '',
  messageReactions: {},
  activeThreadRoot: null,
  threadMessages: [],
  selectPrivateUser: jest.fn(),
  selectRoom: jest.fn(),
  sendMessage: jest.fn(),
  sendRoomMessage: jest.fn(),
  sendThreadReply: jest.fn(),
  openThread: jest.fn(),
  closeThread: jest.fn(),
  editMessage: jest.fn(),
  deleteMessage: jest.fn(),
  toggleReaction: jest.fn(),
  loadPrivateHistory: jest.fn().mockResolvedValue(undefined),
  loadRoomHistory: jest.fn().mockResolvedValue(undefined),
  createRoom: jest.fn().mockResolvedValue(null),
  deleteRoom: jest.fn(),
  updateRoomMeta: jest.fn(),
  pinRoomMessage: jest.fn(),
  sendTyping: jest.fn(),
  searchMessages: jest.fn().mockResolvedValue(undefined),
  trackTelemetry: jest.fn(),
  addTeam: jest.fn(),
  isLoading: false,
  isSocketConnected: true,
  error: '',
  retryConnection: jest.fn(),
  roomMentionCounts: {},
  teamMentionCount: 0,
  ...overrides,
});

describe('chat page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseParams.mockReturnValue({ id: '42' });
    mockUseSearchParams.mockReturnValue({
      get: jest.fn().mockReturnValue(null),
    });
  });

  it('renders chat UI with sidebar, messages, and input components', () => {
    mockedUseChat.mockReturnValue(createChatState());

    render(<ChatInterface />);

    expect(screen.getByTestId('chat-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('chat-messages')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
    expect(screen.getByText('Team Chat')).toBeInTheDocument();
  });

  it('shows disconnected banner and triggers reconnect action', () => {
    const retryConnection = jest.fn();
    mockedUseChat.mockReturnValue(
      createChatState({
        isSocketConnected: false,
        retryConnection,
      })
    );

    render(<ChatInterface />);

    expect(screen.getByText('Disconnected — messages may not be delivered')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    expect(retryConnection).toHaveBeenCalledTimes(1);
  });

  it('shows error banner and keeps chat input disabled while error exists', () => {
    const retryConnection = jest.fn();
    mockedUseChat.mockReturnValue(
      createChatState({
        error: 'Connection failed. Is the backend running?',
        retryConnection,
      })
    );

    render(<ChatInterface />);

    expect(screen.getByText('Connection failed. Is the backend running?')).toBeInTheDocument();
    expect(screen.getByText('Retry the connection to continue chatting.')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input')).toHaveAttribute('data-disabled', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retryConnection).toHaveBeenCalledTimes(1);
  });

  it('does not show red error banner for reconnecting states', () => {
    mockedUseChat.mockReturnValue(
      createChatState({
        isSocketConnected: false,
        error: 'Realtime chat is reconnecting. Please wait a moment and try again.',
      })
    );

    render(<ChatInterface />);

    expect(screen.getByText('Disconnected — messages may not be delivered')).toBeInTheDocument();
    expect(screen.queryByText('Retry the connection to continue chatting.')).not.toBeInTheDocument();
  });

  it('supports message search interaction when phase D feature is enabled', () => {
    const searchMessages = jest.fn().mockResolvedValue(undefined);
    mockedUseChat.mockReturnValue(
      createChatState({
        searchMessages,
        searchResults: [
          {
            messageId: 900,
            context: 'ROOM',
            roomId: 1,
            sender: 'bob',
            content: 'release checklist complete',
          },
        ],
      })
    );

    render(<ChatInterface />);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle message search' }));
    fireEvent.change(screen.getByLabelText('Search all chat messages'), {
      target: { value: 'release' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit search' }));

    expect(searchMessages).toHaveBeenCalledWith('release');
    expect(screen.getByText('release checklist complete')).toBeInTheDocument();
  });

  it('renders loading skeleton branch before main chat UI', () => {
    mockedUseChat.mockReturnValue(createChatState({ isLoading: true }));

    const { container } = render(<ChatInterface />);

    expect(screen.queryByTestId('chat-sidebar')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
