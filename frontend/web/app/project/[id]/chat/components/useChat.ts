import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';
import {
  ChatFeatureFlags,
  ChatMessage,
  ChatReactionSummary,
  ChatRoom,
  ChatSearchResult,
  DirectChatSummary,
  PresenceResponse,
  RoomChatSummary,
  TeamChatSummary,
  UnreadBadgeSummary
} from './chat';

interface RoomEvent {
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  roomId: number;
  room?: ChatRoom;
}

interface AuthUserSummary {
  email?: string;
  username?: string;
}

interface PresenceEvent {
  type: 'ONLINE' | 'OFFLINE' | 'PING';
  user?: string;
  onlineUsers?: string[];
}

interface TypingEvent {
  sender: string;
  scope: 'TEAM' | 'ROOM' | 'PRIVATE';
  roomId?: number;
  recipient?: string;
  typing: boolean;
}

interface MentionEvent {
  type: 'MENTIONED';
  projectId: number;
  messageId?: number;
  sender: string;
  scope: 'TEAM' | 'ROOM' | 'PRIVATE' | 'THREAD' | string;
  roomId?: number;
  preview?: string;
}

const MAX_REACTION_HYDRATION_MESSAGES = 20;
const REACTION_RETRY_BACKOFF_MS = 10000;
const DEFAULT_FEATURE_FLAGS: ChatFeatureFlags = {
  phaseDEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_D_ENABLED !== 'false',
  phaseEEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_E_ENABLED !== 'false',
  webhooksEnabled: process.env.NEXT_PUBLIC_CHAT_WEBHOOKS_ENABLED !== 'false',
  telemetryEnabled: process.env.NEXT_PUBLIC_CHAT_TELEMETRY_ENABLED !== 'false'
};

const normalizeIdentity = (value?: string | null): string => (value || '').trim().toLowerCase();

const localPart = (value: string): string => {
  const normalized = normalizeIdentity(value);
  if (!normalized.includes('@')) {
    return normalized;
  }

  return normalized.split('@')[0];
};

const isSameIdentity = (left?: string | null, right?: string | null): boolean => {
  const normalizedLeft = normalizeIdentity(left);
  const normalizedRight = normalizeIdentity(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return localPart(normalizedLeft) === localPart(normalizedRight);
};

const mergeMessage = (list: ChatMessage[], incoming: ChatMessage): ChatMessage[] => {
  if (!incoming.id) {
    return [...list, incoming];
  }

  const index = list.findIndex(item => item.id === incoming.id);
  if (index === -1) {
    return [...list, incoming];
  }

  const next = [...list];
  next[index] = { ...next[index], ...incoming };
  return next;
};

const normalizeRoom = (room: ChatRoom): ChatRoom => ({
  ...room,
  id: Number(room.id),
  projectId: Number(room.projectId),
  archived: Boolean(room.archived),
  pinnedMessageId: room.pinnedMessageId ?? null
});

export const useChat = (projectId: string) => {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<string>('');
  const [currentUserAliases, setCurrentUserAliases] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({});

  const [privateUnseenCounts, setPrivateUnseenCounts] = useState<Record<string, number>>({});
  const [roomUnseenCounts, setRoomUnseenCounts] = useState<Record<number, number>>({});
  const [privateLastMessages, setPrivateLastMessages] = useState<Record<string, ChatMessage | null>>({});
  const [roomLastMessages, setRoomLastMessages] = useState<Record<number, ChatMessage | null>>({});
  const [teamUnseenCount, setTeamUnseenCount] = useState<number>(0);
  const [teamLastMessage, setTeamLastMessage] = useState<ChatMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [teamTypingUsers, setTeamTypingUsers] = useState<string[]>([]);
  const [roomTypingUsers, setRoomTypingUsers] = useState<Record<number, string[]>>({});
  const [privateTypingUsers, setPrivateTypingUsers] = useState<string[]>([]);
  const [roomMentionCounts, setRoomMentionCounts] = useState<Record<number, number>>({});
  const [teamMentionCount, setTeamMentionCount] = useState<number>(0);
  const [unreadBadge, setUnreadBadge] = useState<UnreadBadgeSummary>({ teamUnread: 0, roomsUnread: 0, directsUnread: 0, totalUnread: 0 });
  const [featureFlags, setFeatureFlags] = useState<ChatFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [searchResults, setSearchResults] = useState<ChatSearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);

  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string>>({});

  const [activeThreadRoot, setActiveThreadRoot] = useState<ChatMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<ChatMessage[]>([]);

  const [messageReactions, setMessageReactions] = useState<Record<number, ChatReactionSummary[]>>({});

  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [commandNotice, setCommandNotice] = useState('');
  const [hasRestoredSelection, setHasRestoredSelection] = useState(false);

  const stompClientRef = useRef<CompatClient | null>(null);
  const loadedReactionMessageIdsRef = useRef<Set<number>>(new Set());
  const reactionFetchBackoffUntilRef = useRef<number>(0);
  const selectedUserRef = useRef<string | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);
  const activeThreadRootRef = useRef<ChatMessage | null>(null);
  const hasRestoredSelectionRef = useRef(false);

  const selectionStorageKey = `chat-selection:${projectId}`;

  const markTeamAsRead = useCallback(async () => {
    try {
      await fetch(`/api/projects/${projectId}/chat/team/read`, {
        method: 'POST',
        headers: tokenHeader()
      });
    } catch (markError) {
      console.error('Failed to mark team chat as read', markError);
    }
  }, [projectId]);

  const showCommandNotice = useCallback((message: string) => {
    setCommandNotice(message);
    window.setTimeout(() => setCommandNotice(''), 4500);
  }, []);

  const addTeam = useCallback((teamName: string) => {
    setUsers(prev => {
      if (!teamName.trim() || prev.includes(teamName)) {
        return prev;
      }
      return [...prev, teamName];
    });
  }, []);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    activeThreadRootRef.current = activeThreadRoot;
  }, [activeThreadRoot]);

  const tokenHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('token')}`
  });

  const isStompConnected = () => Boolean(stompClientRef.current?.connected);

  const loadPresence = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/presence`, {
        headers: tokenHeader()
      });
      if (!response.ok) {
        return;
      }

      const data: PresenceResponse = await response.json();
      setOnlineUsers((data.onlineUsers || []).map(user => user.toLowerCase()));
    } catch (presenceError) {
      console.error('Failed to load presence', presenceError);
    }
  }, [projectId]);

  const trackTelemetry = useCallback(async (eventName: string, scope: string, metadata?: string) => {
    if (!featureFlags.phaseEEnabled || !featureFlags.telemetryEnabled) {
      return;
    }

    try {
      await fetch(`/api/projects/${projectId}/chat/telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ eventName, scope, metadata: metadata || '' })
      });
    } catch (telemetryError) {
      console.error('Failed to send telemetry', telemetryError);
    }
  }, [projectId, featureFlags.phaseEEnabled, featureFlags.telemetryEnabled]);

  const loadFeatureFlags = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/features`, {
        headers: tokenHeader()
      });
      if (!response.ok) {
        return;
      }

      const flags: ChatFeatureFlags = await response.json();
      setFeatureFlags({
        phaseDEnabled: Boolean(flags.phaseDEnabled),
        phaseEEnabled: Boolean(flags.phaseEEnabled),
        webhooksEnabled: Boolean(flags.webhooksEnabled),
        telemetryEnabled: Boolean(flags.telemetryEnabled)
      });
    } catch (flagError) {
      console.error('Failed to load chat feature flags', flagError);
    }
  }, [projectId]);

  const searchMessages = useCallback(async (query: string) => {
    const normalized = query.trim();
    if (!featureFlags.phaseDEnabled || !normalized) {
      setSearchResults([]);
      return;
    }

    setIsSearchLoading(true);
    try {
      const params = new URLSearchParams({ query: normalized, limit: '30' });
      const response = await fetch(`/api/projects/${projectId}/chat/search?${params.toString()}`, {
        headers: tokenHeader()
      });
      if (!response.ok) {
        setSearchResults([]);
        return;
      }

      const results: ChatSearchResult[] = await response.json();
      setSearchResults(results || []);
      trackTelemetry('chat_search_executed', 'chat', `queryLength=${normalized.length};results=${(results || []).length}`);
    } catch (searchError) {
      console.error('Failed to search messages', searchError);
      setSearchResults([]);
    } finally {
      setIsSearchLoading(false);
    }
  }, [featureFlags.phaseDEnabled, projectId, trackTelemetry]);

  const loadUnreadBadge = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/unread-badge`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        return;
      }

      const badge: UnreadBadgeSummary = await response.json();
      setUnreadBadge({
        teamUnread: Number(badge.teamUnread) || 0,
        roomsUnread: Number(badge.roomsUnread) || 0,
        directsUnread: Number(badge.directsUnread) || 0,
        totalUnread: Number(badge.totalUnread) || 0
      });
    } catch (badgeError) {
      console.error('Failed to load unread badge', badgeError);
    }
  }, [projectId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!isStompConnected()) {
      return;
    }

    if (selectedRoomIdRef.current !== null && Number.isFinite(selectedRoomIdRef.current)) {
      stompClientRef.current?.send(
        `/app/project/${projectId}/typing`,
        {},
        JSON.stringify({ scope: 'ROOM', roomId: selectedRoomIdRef.current, isTyping })
      );
      return;
    }

    if (selectedUserRef.current) {
      stompClientRef.current?.send(
        `/app/project/${projectId}/typing`,
        {},
        JSON.stringify({ scope: 'PRIVATE', recipient: selectedUserRef.current, isTyping })
      );
      return;
    }

    stompClientRef.current?.send(
      `/app/project/${projectId}/typing`,
      {},
      JSON.stringify({ scope: 'TEAM', isTyping })
    );
  }, [projectId]);

  const updateMessageEverywhere = useCallback((incoming: ChatMessage) => {
    const mergeTopLevel = (list: ChatMessage[], inc: ChatMessage) => {
      if (!inc.id) return list;
      const index = list.findIndex(item => item.id === inc.id);
      if (index !== -1) {
        const next = [...list];
        next[index] = { ...next[index], ...inc };
        return next;
      }
      if (inc.parentMessageId) {
        return list;
      }
      return [...list, inc];
    };

    setMessages(prev => mergeTopLevel(prev, incoming));

    setPrivateMessages(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        next[key] = mergeTopLevel(next[key] || [], incoming);
      });
      return next;
    });

    setRoomMessages(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const roomId = Number(key);
        next[roomId] = mergeTopLevel(next[roomId] || [], incoming);
      });
      return next;
    });

    setThreadMessages(prev => mergeMessage(prev, incoming));
  }, []);

  const loadMessageReactions = useCallback(async (messageId: number) => {
    if (Date.now() < reactionFetchBackoffUntilRef.current) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${messageId}/reactions`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        if (response.status >= 500) {
          reactionFetchBackoffUntilRef.current = Date.now() + REACTION_RETRY_BACKOFF_MS;
        }
        return;
      }

      const reactions = await response.json();
      setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
    } catch (loadError) {
      console.error('Failed to load message reactions', loadError);
    }
  }, [projectId]);

  const hydrateReactions = useCallback((messageList: ChatMessage[]) => {
    const recentMessages = messageList.slice(-MAX_REACTION_HYDRATION_MESSAGES);

    recentMessages
      .filter(message => typeof message.id === 'number')
      .forEach(message => {
        const id = message.id as number;
        if (loadedReactionMessageIdsRef.current.has(id)) {
          return;
        }

        loadedReactionMessageIdsRef.current.add(id);
        loadMessageReactions(id);
      });
  }, [loadMessageReactions]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasRestoredSelection) {
      return;
    }

    const selection = selectedRoomId !== null && Number.isFinite(selectedRoomId)
      ? { type: 'room', value: selectedRoomId }
      : selectedUser
      ? { type: 'private', value: selectedUser }
      : { type: 'team', value: null };

    window.sessionStorage.setItem(selectionStorageKey, JSON.stringify(selection));
  }, [selectedRoomId, selectedUser, selectionStorageKey, hasRestoredSelection]);

  const fetchAllUsers = useCallback(async (token: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return [] as string[];
      }

      const data = await response.json();
      const normalizedUsers = data.map((user: string) => user.toLowerCase());
      setUsers(normalizedUsers);
      return normalizedUsers;
    } catch (fetchError) {
      console.error('Error fetching users:', fetchError);
      return [] as string[];
    }
  }, [projectId]);

  const fetchUserProfilePics = useCallback(async (token: string) => {
    try {
      const response = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      const data = await response.json();
      const pics: Record<string, string> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.forEach((u: any) => {
        if (u.profilePicUrl && u.username) {
          pics[u.username.toLowerCase()] = u.profilePicUrl;
        }
      });
      setUserProfilePics(pics);
    } catch (fetchError) {
      console.error('Error fetching profile pictures:', fetchError);
    }
  }, []);

  const fetchCanonicalUsernameAlias = useCallback(async (token: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return null;
      }

      const current: AuthUserSummary = await response.json();
      const username = current?.username?.trim().toLowerCase();
      return username || null;
    } catch (fetchError) {
      console.error('Error fetching canonical username alias:', fetchError);
      return null;
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/rooms`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        return [] as ChatRoom[];
      }

      const data = await response.json();
      const normalizedRooms: ChatRoom[] = (data || [])
        .map((room: ChatRoom) => normalizeRoom(room))
        .filter((room: ChatRoom) => Number.isFinite(room.id));

      setRooms(normalizedRooms);
      return normalizedRooms;
    } catch (fetchError) {
      console.error('Error fetching rooms:', fetchError);
      return [] as ChatRoom[];
    }
  }, [projectId]);

  const loadSummaries = useCallback(async (token: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/summaries`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      const directSummaries: DirectChatSummary[] = data.directMessages || [];
      const roomSummaries: RoomChatSummary[] = data.rooms || [];
      const teamSummary: TeamChatSummary | null = data.team || null;

      setTeamUnseenCount(Number(teamSummary?.unseenCount) || 0);
      setTeamLastMessage(
        teamSummary?.lastMessage
          ? {
              sender: teamSummary.lastMessageSender || '',
              content: teamSummary.lastMessage,
              timestamp: teamSummary.lastMessageTimestamp || undefined
            }
          : null
      );

      setPrivateUnseenCounts(
        Object.fromEntries(directSummaries.map(summary => [summary.username.toLowerCase(), Number(summary.unseenCount) || 0]))
      );
      setRoomUnseenCounts(
        Object.fromEntries(roomSummaries.map(summary => [Number(summary.roomId), Number(summary.unseenCount) || 0]))
      );

      const directUnread = directSummaries.reduce((acc, summary) => acc + (Number(summary.unseenCount) || 0), 0);
      const roomUnread = roomSummaries.reduce((acc, summary) => acc + (Number(summary.unseenCount) || 0), 0);
      const teamUnread = Number(teamSummary?.unseenCount) || 0;
      setUnreadBadge({
        teamUnread,
        roomsUnread: roomUnread,
        directsUnread: directUnread,
        totalUnread: teamUnread + roomUnread + directUnread
      });

      setPrivateLastMessages(
        Object.fromEntries(
          directSummaries.map(summary => [
            summary.username.toLowerCase(),
            summary.lastMessage
              ? {
                  sender: summary.lastMessageSender || summary.username.toLowerCase(),
                  content: summary.lastMessage,
                  timestamp: summary.lastMessageTimestamp || undefined
                }
              : null
          ])
        )
      );

      setRoomLastMessages(
        Object.fromEntries(
          roomSummaries.map(summary => [
            Number(summary.roomId),
            summary.lastMessage
              ? {
                  sender: summary.lastMessageSender || '',
                  content: summary.lastMessage,
                  timestamp: summary.lastMessageTimestamp || undefined,
                  roomId: Number(summary.roomId)
                }
              : null
          ])
        )
      );
    } catch (fetchError) {
      console.error('Error fetching chat summaries:', fetchError);
    }
  }, [projectId]);

  const restoreSelection = useCallback((availableUsers: string[], availableRooms: ChatRoom[]) => {
    if (typeof window === 'undefined') {
      hasRestoredSelectionRef.current = true;
      setHasRestoredSelection(true);
      return;
    }

    const rawSelection = window.sessionStorage.getItem(selectionStorageKey);
    if (!rawSelection) {
      hasRestoredSelectionRef.current = true;
      setHasRestoredSelection(true);
      return;
    }

    try {
      const parsed = JSON.parse(rawSelection) as { type?: 'team' | 'private' | 'room'; value?: string | number | null };

      if (parsed.type === 'private' && typeof parsed.value === 'string' && availableUsers.includes(parsed.value)) {
        setSelectedUser(parsed.value);
      } else if (parsed.type === 'room') {
        const roomId = Number(parsed.value);
        if (Number.isFinite(roomId) && availableRooms.some(room => room.id === roomId)) {
          setSelectedRoomId(roomId);
        }
      }
    } catch (parseError) {
      console.error('Failed to restore chat selection', parseError);
    } finally {
      hasRestoredSelectionRef.current = true;
      setHasRestoredSelection(true);
    }
  }, [selectionStorageKey]);

  const loadHistory = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setMessages(data);
      setTeamLastMessage(data.length > 0 ? data[data.length - 1] : null);
      hydrateReactions(data);
    } catch (fetchError) {
      console.error('Failed to load message history', fetchError);
    }
  }, [projectId, hydrateReactions]);

  const loadRoomHistory = useCallback(async (roomId: number) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages?roomId=${roomId}`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setRoomMessages(prev => ({ ...prev, [roomId]: data }));
      setRoomLastMessages(prev => ({ ...prev, [roomId]: data.length > 0 ? data[data.length - 1] : null }));
      setRoomUnseenCounts(prev => ({ ...prev, [roomId]: 0 }));
      hydrateReactions(data);
    } catch (fetchError) {
      console.error('Failed to load room history', fetchError);
    }
  }, [projectId, hydrateReactions]);

  const loadPrivateHistory = useCallback(async (recipient: string) => {
    if (!recipient || !currentUser) {
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('recipient', currentUser);
      params.append('with', recipient);

      const response = await fetch(`/api/projects/${projectId}/chat/messages?${params.toString()}`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setPrivateMessages(prev => ({ ...prev, [recipient]: data }));
      setPrivateLastMessages(prev => ({ ...prev, [recipient]: data.length > 0 ? data[data.length - 1] : null }));
      setPrivateUnseenCounts(prev => ({ ...prev, [recipient]: 0 }));
      hydrateReactions(data);
    } catch (fetchError) {
      console.error('Failed to load private history', fetchError);
    }
  }, [currentUser, projectId, hydrateReactions]);

  const openThread = useCallback(async (rootMessage: ChatMessage) => {
    if (!rootMessage.id) {
      return;
    }

    setActiveThreadRoot(rootMessage);

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${rootMessage.id}/thread`, {
        headers: tokenHeader()
      });

      if (!response.ok) {
        setThreadMessages([rootMessage]);
        return;
      }

      const data = await response.json();
      setThreadMessages(data);
      hydrateReactions(data);
    } catch (fetchError) {
      console.error('Failed to load thread messages', fetchError);
      setThreadMessages([rootMessage]);
    }
  }, [projectId, hydrateReactions]);

  const closeThread = useCallback(() => {
    setActiveThreadRoot(null);
    setThreadMessages([]);
  }, []);

  const createRoom = useCallback(async (name: string, members: string[]) => {
    if (!name || !name.trim()) return null;

    const chosenMembers = members
      .map(user => user.trim().toLowerCase())
      .filter(user => user && user !== currentUser && users.includes(user));

    if (chosenMembers.length === 0) {
      console.error('Please include at least one valid member.');
      return null;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ name: name.trim(), members: chosenMembers })
      });

      if (!response.ok && response.status !== 201) {
        return null;
      }

      const rawRoom = await response.json();
      const createdRoom: ChatRoom = {
        ...rawRoom,
        id: Number(rawRoom.id),
        projectId: Number(rawRoom.projectId)
      };

      if (!Number.isFinite(createdRoom.id)) {
        return null;
      }

      setRooms(prev => (prev.some(room => room.id === createdRoom.id) ? prev : [...prev, createdRoom]));
      setRoomMessages(prev => ({ ...prev, [createdRoom.id]: prev[createdRoom.id] || [] }));
      return createdRoom;
    } catch (createError) {
      console.error('Failed to create room', createError);
      return null;
    }
  }, [projectId, users, currentUser]);

  const deleteRoom = useCallback(async (roomId: number) => {
    if (!window.confirm('Delete this group chat?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/rooms/${roomId}`, {
        method: 'DELETE',
        headers: tokenHeader()
      });

      if (response.ok || response.status === 204) {
        await loadRooms();
      }
    } catch (deleteError) {
      console.error('Failed to delete room', deleteError);
    }
  }, [projectId, loadRooms]);

  const updateRoomMeta = useCallback(async (roomId: number, updates: { name?: string; topic?: string; description?: string }) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/rooms/${roomId}/meta`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        return null;
      }

      const updated = normalizeRoom(await response.json());
      setRooms(prev => prev.map(room => (room.id === updated.id ? updated : room)));
      return updated;
    } catch (updateError) {
      console.error('Failed to update room metadata', updateError);
      return null;
    }
  }, [projectId]);

  const pinRoomMessage = useCallback(async (roomId: number, messageId: number | null) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/chat/rooms/${roomId}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ messageId })
      });

      if (!response.ok) {
        return null;
      }

      const updated = normalizeRoom(await response.json());
      setRooms(prev => prev.map(room => (room.id === updated.id ? updated : room)));
      return updated;
    } catch (pinError) {
      console.error('Failed to pin room message', pinError);
      return null;
    }
  }, [projectId]);

  const scheduleHistorySync = useCallback((recipient?: string | null, roomId?: number | null) => {
    window.setTimeout(() => {
      if (roomId !== null && roomId !== undefined) {
        loadRoomHistory(roomId);
        return;
      }

      if (recipient) {
        loadPrivateHistory(recipient);
        return;
      }

      loadHistory();
    }, 450);
  }, [loadHistory, loadPrivateHistory, loadRoomHistory]);

  const connectToChat = useCallback((token: string, username: string, aliases: string[]) => {
    try {
      const client = Stomp.over(() => new SockJS('http://localhost:8080/ws'));
      client.debug = () => {};
      client.reconnect_delay = 5000;
      const normalizedAliases = new Set(aliases.map(alias => alias.toLowerCase()));

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClientRef.current = client;
        setIsSocketConnected(true);

        client.subscribe(`/topic/project/${projectId}/public`, payload => {
          const incoming: ChatMessage = JSON.parse(payload.body);
          if (incoming.type === 'JOIN' && incoming.sender !== username) {
            setUsers(prev => (prev.includes(incoming.sender) ? prev : [...prev, incoming.sender]));
            return;
          }

          if (incoming.type !== 'JOIN' && !incoming.roomId && !incoming.recipient) {
            if (incoming.parentMessageId) return;

            setMessages(prev => mergeMessage(prev, incoming));
            setTeamLastMessage(incoming);
            if (incoming.sender.toLowerCase() !== username
              && selectedRoomIdRef.current === null
              && !selectedUserRef.current) {
              setTeamUnseenCount(0);
              markTeamAsRead();
            } else if (incoming.sender.toLowerCase() !== username) {
              setTeamUnseenCount(prev => prev + 1);
            }
            if (incoming.id) {
              loadMessageReactions(incoming.id);
            }
          }
        });

        client.subscribe(`/user/queue/project/${projectId}/messages`, payload => {
          const incoming: ChatMessage = JSON.parse(payload.body);
          const sender = incoming.sender?.toLowerCase() || '';
          const recipient = incoming.recipient?.toLowerCase() || '';
          const isFromCurrentUser = normalizedAliases.has(sender);
          const partner = isFromCurrentUser ? recipient : sender;

          if (!partner) {
            return;
          }
          
          if (incoming.parentMessageId) return;

          setPrivateMessages(prev => {
            const candidateKeys = new Set<string>([
              partner,
              ...(selectedUserRef.current ? [selectedUserRef.current.toLowerCase()] : []),
              ...Object.keys(prev)
            ]);

            const matchedKey = Array.from(candidateKeys).find(key => isSameIdentity(key, partner)) || partner;
            const updatedMessages = mergeMessage(prev[matchedKey] || [], incoming);

            return {
              ...prev,
              [matchedKey]: updatedMessages,
              ...(matchedKey !== partner ? { [partner]: updatedMessages } : {})
            };
          });

          const activeConversationKey = selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner)
            ? selectedUserRef.current.toLowerCase()
            : partner;

          setPrivateLastMessages(prev => ({
            ...prev,
            [activeConversationKey]: incoming,
            ...(activeConversationKey !== partner ? { [partner]: incoming } : {})
          }));

          if (!isFromCurrentUser && !(selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner))) {
            setPrivateUnseenCounts(prev => ({ ...prev, [activeConversationKey]: (prev[activeConversationKey] || 0) + 1 }));
          }

          setUsers(prev => (prev.some(user => isSameIdentity(user, partner)) ? prev : [...prev, partner]));

          if (incoming.id) {
            loadMessageReactions(incoming.id);
          }
        });

        client.subscribe(`/topic/project/${projectId}/rooms`, payload => {
          const event: RoomEvent = JSON.parse(payload.body);

          if ((event.action === 'CREATED' || event.action === 'UPDATED') && event.room) {
            const normalizedRoom: ChatRoom = normalizeRoom(event.room);

            if (!Number.isFinite(normalizedRoom.id)) {
              return;
            }

            setRooms(prev => (
              prev.some(room => room.id === normalizedRoom.id)
                ? prev.map(room => (room.id === normalizedRoom.id ? normalizedRoom : room))
                : [...prev, normalizedRoom]
            ));
            setRoomUnseenCounts(prev => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || 0 }));
            setRoomLastMessages(prev => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || null }));
            return;
          }

          if (event.action === 'DELETED') {
            const removedId = Number(event.roomId);
            setRooms(prev => prev.filter(room => room.id !== removedId));
            setRoomMessages(prev => {
              const next = { ...prev };
              delete next[removedId];
              return next;
            });
            setRoomUnseenCounts(prev => {
              const next = { ...prev };
              delete next[removedId];
              return next;
            });
            setRoomLastMessages(prev => {
              const next = { ...prev };
              delete next[removedId];
              return next;
            });
          }
        });

        client.subscribe(`/topic/project/${projectId}/presence`, payload => {
          const event: PresenceEvent = JSON.parse(payload.body);
          setOnlineUsers((event.onlineUsers || []).map(user => user.toLowerCase()));
        });

        client.subscribe(`/topic/project/${projectId}/typing/team`, payload => {
          const event: TypingEvent = JSON.parse(payload.body);
          const sender = event.sender?.toLowerCase();
          if (!sender || sender === username.toLowerCase()) {
            return;
          }

          setTeamTypingUsers(prev => {
            if (event.typing) {
              return prev.includes(sender) ? prev : [...prev, sender];
            }
            return prev.filter(user => user !== sender);
          });
        });

        client.subscribe(`/user/queue/project/${projectId}/typing/private`, payload => {
          const event: TypingEvent = JSON.parse(payload.body);
          const sender = event.sender?.toLowerCase();
          if (!sender || sender === username.toLowerCase()) {
            return;
          }

          setPrivateTypingUsers(prev => {
            if (event.typing) {
              return prev.includes(sender) ? prev : [...prev, sender];
            }
            return prev.filter(user => user !== sender);
          });
        });

        client.subscribe(`/user/queue/project/${projectId}/unread-badge`, payload => {
          const badge: UnreadBadgeSummary = JSON.parse(payload.body);
          setUnreadBadge({
            teamUnread: Number(badge.teamUnread) || 0,
            roomsUnread: Number(badge.roomsUnread) || 0,
            directsUnread: Number(badge.directsUnread) || 0,
            totalUnread: Number(badge.totalUnread) || 0
          });
        });

        client.subscribe(`/user/queue/project/${projectId}/mentions`, payload => {
          const mention: MentionEvent = JSON.parse(payload.body);
          const context = mention.scope === 'ROOM'
            ? 'group chat'
            : mention.scope === 'PRIVATE'
            ? 'direct chat'
            : mention.scope === 'THREAD'
            ? 'thread'
            : 'team chat';
          showCommandNotice(`You are mentioned by ${mention.sender} in ${context}.`);
          trackTelemetry('chat_mention_received', mention.scope || 'chat', `messageId=${mention.messageId || ''}`);

          // Bump sidebar badge when the user is not currently viewing that chat
          if (mention.scope === 'ROOM' && mention.roomId) {
            const rid = Number(mention.roomId);
            if (selectedRoomIdRef.current !== rid) {
              setRoomMentionCounts(prev => ({ ...prev, [rid]: (prev[rid] || 0) + 1 }));
            }
          } else if ((mention.scope === 'TEAM' || !mention.scope) &&
            (selectedRoomIdRef.current !== null || selectedUserRef.current !== null)) {
            setTeamMentionCount(prev => prev + 1);
          }
        });

        client.send(`/app/project/${projectId}/chat.addUser`, {}, JSON.stringify({ sender: username, type: 'JOIN' }));
        client.send(`/app/project/${projectId}/presence.ping`, {}, JSON.stringify({}));
      }, (connectError: unknown) => {
        setIsSocketConnected(false);
        setError('Connection failed. Is the backend running?');
        console.error(connectError);
      });
    } catch (connectError) {
      setIsSocketConnected(false);
      setError('Socket initialization failed.');
      console.error(connectError);
    }
  }, [projectId, loadMessageReactions, markTeamAsRead, showCommandNotice, trackTelemetry]);

  useEffect(() => {
    const initialize = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const canonicalUsername = await fetchCanonicalUsernameAlias(token);
        const username = (canonicalUsername || payload.username || payload.sub || payload.email || 'User').toLowerCase();
        const aliases = [payload.username, payload.sub, payload.email]
          .filter((value: string | undefined | null): value is string => Boolean(value && value.trim()))
          .map((value: string) => value.toLowerCase());
        if (canonicalUsername) {
          aliases.push(canonicalUsername);
        }
        const aliasWithLocalPart = aliases
          .flatMap((value: string) => {
            if (!value.includes('@')) {
              return [value];
            }

            return [value, value.split('@')[0]];
          })
          .filter((value: string) => value && value.trim());

        const effectiveAliases = Array.from(new Set([...aliasWithLocalPart, username.toLowerCase()]));
        setCurrentUserAliases(effectiveAliases);
        setCurrentUser(username);
        setIsLoading(false);

        const loadedUsers = await fetchAllUsers(token);
        await fetchUserProfilePics(token);
        const loadedRooms = await loadRooms();
        await loadFeatureFlags();
        await loadSummaries(token);
        await loadPresence();
        await loadUnreadBadge();
        restoreSelection(loadedUsers, loadedRooms);

        connectToChat(token, username, effectiveAliases);
        await loadHistory();
      } catch {
        setError('Invalid authentication token.');
        router.push('/login');
      }
    };

    initialize();

    return () => {
      setIsSocketConnected(false);
      if (stompClientRef.current?.connected) {
        stompClientRef.current.disconnect();
      }
    };
  }, [router, fetchAllUsers, fetchCanonicalUsernameAlias, fetchUserProfilePics, loadRooms, loadFeatureFlags, loadSummaries, loadPresence, loadUnreadBadge, restoreSelection, connectToChat, loadHistory]);

  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) {
      return;
    }

    const interval = window.setInterval(() => {
      stompClientRef.current?.send(`/app/project/${projectId}/presence.ping`, {}, JSON.stringify({}));
    }, 30000);

    return () => window.clearInterval(interval);
  }, [projectId, isSocketConnected]);

  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) {
      return;
    }

    const connectedClient = stompClientRef.current;
    const subscriptions = rooms.flatMap(room => {
      const messageSub = connectedClient.subscribe(`/topic/project/${projectId}/room/${room.id}`, payload => {
        const incoming: ChatMessage = JSON.parse(payload.body);
        if (incoming.type === 'JOIN' || !incoming.roomId || incoming.parentMessageId) {
          return;
        }

        setRoomMessages(prev => ({ ...prev, [incoming.roomId as number]: mergeMessage(prev[incoming.roomId as number] || [], incoming) }));
        setRoomLastMessages(prev => ({ ...prev, [incoming.roomId as number]: incoming }));

        if (incoming.sender.toLowerCase() !== currentUser && selectedRoomIdRef.current !== incoming.roomId) {
          setRoomUnseenCounts(prev => ({ ...prev, [incoming.roomId as number]: (prev[incoming.roomId as number] || 0) + 1 }));
        }

        if (incoming.id) {
          loadMessageReactions(incoming.id);
        }
      });

      const typingSub = connectedClient.subscribe(`/topic/project/${projectId}/typing/room/${room.id}`, payload => {
        const event: TypingEvent = JSON.parse(payload.body);
        const sender = event.sender?.toLowerCase();
        if (!sender || sender === currentUser.toLowerCase()) {
          return;
        }

        setRoomTypingUsers(prev => {
          const roomId = Number(event.roomId || room.id);
          const existing = prev[roomId] || [];
          return {
            ...prev,
            [roomId]: event.typing
              ? (existing.includes(sender) ? existing : [...existing, sender])
              : existing.filter(user => user !== sender)
          };
        });
      });

      return [messageSub, typingSub];
    });

    return () => {
      subscriptions.forEach(subscription => subscription?.unsubscribe());
    };
  }, [projectId, rooms, isSocketConnected, currentUser, loadMessageReactions]);

  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current || !activeThreadRootRef.current?.id) {
      return;
    }

    const rootId = activeThreadRootRef.current.id;
    const subscription = stompClientRef.current.subscribe(`/topic/project/${projectId}/thread/${rootId}`, payload => {
      const incoming: ChatMessage = JSON.parse(payload.body);
      setThreadMessages(prev => mergeMessage(prev, incoming));
      if (incoming.id) {
        loadMessageReactions(incoming.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [projectId, isSocketConnected, activeThreadRoot, loadMessageReactions]);

  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) {
      return;
    }

    const connectedClient = stompClientRef.current;
    const messageIds = new Set<number>();

    messages.forEach(message => {
      if (message.id) {
        messageIds.add(message.id);
      }
    });

    Object.values(privateMessages).forEach(list => {
      list.forEach(message => {
        if (message.id) {
          messageIds.add(message.id);
        }
      });
    });

    Object.values(roomMessages).forEach(list => {
      list.forEach(message => {
        if (message.id) {
          messageIds.add(message.id);
        }
      });
    });

    threadMessages.forEach(message => {
      if (message.id) {
        messageIds.add(message.id);
      }
    });

    const subscriptions = Array.from(messageIds).map(messageId =>
      connectedClient.subscribe(`/topic/project/${projectId}/messages/${messageId}/reactions`, payload => {
        const reactions: ChatReactionSummary[] = JSON.parse(payload.body);
        setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
      })
    );

    return () => {
      subscriptions.forEach(subscription => subscription.unsubscribe());
    };
  }, [projectId, isSocketConnected, messages, privateMessages, roomMessages, threadMessages]);

  useEffect(() => {
    if (!selectedUser) {
      setPrivateTypingUsers([]);
      return;
    }
    setPrivateTypingUsers(prev => prev.filter(user => isSameIdentity(user, selectedUser)));
    setPrivateUnseenCounts(prev => ({ ...prev, [selectedUser]: 0 }));
  }, [selectedUser]);

  useEffect(() => {
    if (selectedRoomId === null || !Number.isFinite(selectedRoomId)) {
      setRoomTypingUsers({});
      return;
    }
    setRoomTypingUsers(prev => ({ [selectedRoomId]: prev[selectedRoomId] || [] }));
    setRoomUnseenCounts(prev => ({ ...prev, [selectedRoomId]: 0 }));
    setRoomMentionCounts(prev => ({ ...prev, [selectedRoomId]: 0 }));
  }, [selectedRoomId]);

  useEffect(() => {
    if (!hasRestoredSelection) {
      return;
    }

    if (selectedRoomId === null && !selectedUser) {
      setTeamUnseenCount(0);
      setTeamMentionCount(0);
      markTeamAsRead();
    }
  }, [selectedRoomId, selectedUser, markTeamAsRead, hasRestoredSelection]);

  const selectPrivateUser = useCallback((user: string | null) => {
    setSelectedRoomId(null);
    setSelectedUser(user);
  }, []);

  const selectRoom = useCallback((roomId: number | null) => {
    setSelectedUser(null);
    if (roomId === null) {
      setSelectedRoomId(null);
      return;
    }

    const normalized = Number(roomId);
    setSelectedRoomId(Number.isFinite(normalized) ? normalized : null);
  }, []);

  const sendMessage = useCallback((content: string, recipient?: string | null) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    if (!isStompConnected()) {
      setError('Realtime chat is reconnecting. Please wait a moment and try again.');
      return;
    }

    if (recipient) {
      const message = { sender: currentUser, content: normalizedContent, recipient, type: 'CHAT', formatType: 'PLAIN' };
      stompClientRef.current?.send(`/app/project/${projectId}/chat.sendPrivateMessage`, {}, JSON.stringify(message));
      trackTelemetry('chat_private_message_sent', 'private');
      return;
    }

    const message = { sender: currentUser, content: normalizedContent, type: 'CHAT', formatType: 'PLAIN' };
    stompClientRef.current?.send(`/app/project/${projectId}/chat.sendMessage`, {}, JSON.stringify(message));
    trackTelemetry('chat_team_message_sent', 'team');
  }, [currentUser, projectId, trackTelemetry]);

  const sendRoomMessage = useCallback((content: string, roomId: number) => {
    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    if (!isStompConnected()) {
      setError('Realtime chat is reconnecting. Please wait a moment and try again.');
      return;
    }

    const message = { sender: currentUser, content: normalizedContent, roomId, type: 'CHAT', formatType: 'PLAIN' };
    stompClientRef.current?.send(`/app/project/${projectId}/room/${roomId}/send`, {}, JSON.stringify(message));
    trackTelemetry('chat_room_message_sent', 'room', `roomId=${roomId}`);
  }, [currentUser, projectId, trackTelemetry]);

  const sendThreadReply = useCallback(async (content: string) => {
    if (!activeThreadRoot?.id) {
      return;
    }

    const normalizedContent = content.trim();
    if (!normalizedContent) {
      return;
    }

    if (isStompConnected()) {
      const message = { sender: currentUser, content: normalizedContent, type: 'CHAT', formatType: 'PLAIN' };
      stompClientRef.current?.send(`/app/project/${projectId}/thread/${activeThreadRoot.id}/send`, {}, JSON.stringify(message));
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${activeThreadRoot.id}/thread/replies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ content: normalizedContent, formatType: 'PLAIN' })
      });

      if (!response.ok) {
        return;
      }

      const saved = await response.json();
      setThreadMessages(prev => mergeMessage(prev, saved));
      updateMessageEverywhere(saved);
    } catch (sendError) {
      console.error('Failed to send thread reply', sendError);
    }
  }, [activeThreadRoot, currentUser, projectId, updateMessageEverywhere]);

  const editMessage = useCallback(async (messageId: number, content: string) => {
    const normalized = content.trim();
    if (!normalized) {
      return;
    }

    if (isStompConnected()) {
      stompClientRef.current?.send(`/app/project/${projectId}/messages/${messageId}/edit`, {}, JSON.stringify({ content: normalized, formatType: 'PLAIN' }));
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ content: normalized, formatType: 'PLAIN' })
      });

      if (!response.ok) {
        return;
      }

      const updated = await response.json();
      updateMessageEverywhere(updated);
    } catch (editError) {
      console.error('Failed to edit message', editError);
    }
  }, [projectId, updateMessageEverywhere]);

  const deleteMessage = useCallback(async (messageId: number) => {
    if (!window.confirm('Delete this message?')) {
      return;
    }

    if (isStompConnected()) {
      stompClientRef.current?.send(`/app/project/${projectId}/messages/${messageId}/delete`, {}, JSON.stringify({}));
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${messageId}`, {
        method: 'DELETE',
        headers: tokenHeader()
      });

      if (!response.ok) {
        return;
      }

      const deletedMessage = await response.json();
      updateMessageEverywhere(deletedMessage);
    } catch (deleteError) {
      console.error('Failed to delete message', deleteError);
    }
  }, [projectId, updateMessageEverywhere]);

  const toggleReaction = useCallback(async (messageId: number, emoji: string) => {
    const normalizedEmoji = emoji.trim();
    if (!normalizedEmoji) {
      return;
    }

    if (isStompConnected()) {
      stompClientRef.current?.send(
        `/app/project/${projectId}/messages/${messageId}/reaction.toggle`,
        {},
        JSON.stringify({ emoji: normalizedEmoji })
      );
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/chat/messages/${messageId}/reactions/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...tokenHeader()
        },
        body: JSON.stringify({ emoji: normalizedEmoji })
      });

      if (!response.ok) {
        return;
      }

      const reactions: ChatReactionSummary[] = await response.json();
      setMessageReactions(prev => ({ ...prev, [messageId]: reactions }));
    } catch (toggleError) {
      console.error('Failed to toggle reaction', toggleError);
    }
  }, [projectId]);

  return {
    currentUser,
    currentUserAliases,
    users,
    messages,
    privateMessages,
    rooms,
    roomMessages,
    selectedUser,
    selectedRoomId,
    privateUnseenCounts,
    roomUnseenCounts,
    privateLastMessages,
    roomLastMessages,
    teamUnseenCount,
    teamLastMessage,
    userProfilePics,
    onlineUsers,
    teamTypingUsers,
    roomTypingUsers,
    privateTypingUsers,
    unreadBadge,
    featureFlags,
    searchResults,
    isSearchLoading,
    commandNotice,
    messageReactions,
    activeThreadRoot,
    threadMessages,
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    sendThreadReply,
    openThread,
    closeThread,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadRoomHistory,
    loadPrivateHistory,
    createRoom,
    deleteRoom,
    updateRoomMeta,
    pinRoomMessage,
    sendTyping,
    searchMessages,
    trackTelemetry,
    addTeam,
    isLoading,
    error,
    roomMentionCounts,
    teamMentionCount,
    retryConnection: () => window.location.reload()
  };
};
