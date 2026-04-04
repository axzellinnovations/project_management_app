import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { CompatClient, Stomp } from '@stomp/stompjs';

import * as chatApi from '@/services/chat-service';
import type {
  ChatFeatureFlags,
  ChatMessage,
  ChatReactionSummary,
  ChatRoom,
  UnreadBadgeSummary,
} from '@/app/project/[id]/chat/components/chat';

import { normalizeIdentity, isSameIdentity, normalizeRoom, mergeMessage } from './chat-utils';
import { useChatMessages } from './useChatMessages';
import { useChatRooms } from './useChatRooms';
import { useChatPresence } from './useChatPresence';
import { useChatThreads } from './useChatThreads';
import { useChatReactions } from './useChatReactions';
import { useChatSearch } from './useChatSearch';
import { useChatUnread } from './useChatUnread';

// ── Types used only within this composer ──

interface RoomEvent {
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  roomId: number;
  room?: ChatRoom;
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

const DEFAULT_FEATURE_FLAGS: ChatFeatureFlags = {
  phaseDEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_D_ENABLED !== 'false',
  phaseEEnabled: process.env.NEXT_PUBLIC_CHAT_PHASE_E_ENABLED !== 'false',
  webhooksEnabled: process.env.NEXT_PUBLIC_CHAT_WEBHOOKS_ENABLED !== 'false',
  telemetryEnabled: process.env.NEXT_PUBLIC_CHAT_TELEMETRY_ENABLED !== 'false',
};

// ── Composer Hook ──

export const useChat = (projectId: string) => {
  const router = useRouter();

  // ── Auth & user state ──
  const [currentUser, setCurrentUser] = useState('');
  const [currentUserAliases, setCurrentUserAliases] = useState<string[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string>>({});

  // ── Selection state ──
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);

  // ── UI state ──
  const [featureFlags, setFeatureFlags] = useState<ChatFeatureFlags>(DEFAULT_FEATURE_FLAGS);
  const [commandNotice, setCommandNotice] = useState('');
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasRestoredSelection, setHasRestoredSelection] = useState(false);
  const hasRestoredSelectionRef = useRef(false);

  // ── Connection ref ──
  const stompClientRef = useRef<CompatClient | null>(null);

  // ── Domain hooks ──
  const msg = useChatMessages(projectId);
  const rm = useChatRooms(projectId);
  const presence = useChatPresence(projectId);
  const threads = useChatThreads(projectId);
  const reactions = useChatReactions(projectId);
  const search = useChatSearch(projectId);
  const unread = useChatUnread(projectId);

  // ── Stable setter/callback destructuring (prevents dep-array identity loops) ──
  const { setMessages, setPrivateMessages, setRoomMessages, setTeamLastMessage,
          setPrivateLastMessages, setRoomLastMessages, mergePrivateMessage,
          sendMessage: msgSend, sendRoomMessage: msgSendRoom,
          editMessage: msgEdit, deleteMessage: msgDelete,
          loadRoomHistory: msgLoadRoom, loadPrivateHistory: msgLoadPrivate } = msg;
  const { setRooms, createRoom: rmCreate, deleteRoom: rmDelete,
          updateRoomMeta: rmUpdateMeta, pinRoomMessage: rmPin } = rm;
  const { setOnlineUsers, setTeamTypingUsers, setPrivateTypingUsers, setRoomTypingUsers } = presence;
  const { setTeamUnseenCount, setPrivateUnseenCounts, setRoomUnseenCounts,
          setRoomMentionCounts, setTeamMentionCount, setUnreadBadge, markTeamAsRead } = unread;
  const { setMessageReactions, loadMessageReactions: loadMsgReactions,
          toggleReaction: reactionsToggle, hydrateReactions } = reactions;
  const { setThreadMessages, sendThreadReply: threadsSendReply,
          openThread: threadsOpenThread, closeThread: threadsClose } = threads;

  // ── Ref sync ──
  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);

  const selectionStorageKey = `chat-selection:${projectId}`;

  // ── Helpers ──
  const isStompConnected = () => Boolean(stompClientRef.current?.connected);
  const stompSend = useCallback((dest: string, body: string) => {
    if (stompClientRef.current?.connected) {
      stompClientRef.current.send(dest, {}, body);
    }
  }, []);

  const showCommandNotice = useCallback((message: string) => {
    setCommandNotice(message);
    window.setTimeout(() => setCommandNotice(''), 4500);
  }, []);

  const addTeam = useCallback((teamName: string) => {
    setUsers(prev => (prev.includes(teamName) ? prev : [...prev, teamName]));
  }, []);

  // ── Feature flags & telemetry ──
  const featureFlagsRef = useRef(featureFlags);
  useEffect(() => { featureFlagsRef.current = featureFlags; }, [featureFlags]);

  const loadFeatureFlags = useCallback(async () => {
    try {
      const flags = await chatApi.fetchFeatureFlags(projectId);
      setFeatureFlags({
        phaseDEnabled: Boolean(flags.phaseDEnabled),
        phaseEEnabled: Boolean(flags.phaseEEnabled),
        webhooksEnabled: Boolean(flags.webhooksEnabled),
        telemetryEnabled: Boolean(flags.telemetryEnabled),
      });
    } catch {
      // keep defaults
    }
  }, [projectId]);

  const trackTelemetry = useCallback(
    async (eventName: string, scope: string, metadata?: string) => {
      const f = featureFlagsRef.current;
      if (!f.phaseEEnabled || !f.telemetryEnabled) return;
      try {
        await chatApi.postTelemetry(projectId, eventName, scope, metadata);
      } catch {
        // non-critical
      }
    },
    [projectId],
  );

  // ── Cross-domain updateMessageEverywhere ──
  const updateMessageEverywhere = useCallback(
    (incoming: ChatMessage, isOptimistic = false) => {
      const mergeTopLevel = (list: ChatMessage[], inc: ChatMessage): ChatMessage[] => {
        if (inc.parentMessageId) return list;
        if (!inc.id) return isOptimistic ? [...list, inc] : list;
        const idx = list.findIndex(m => m.id === inc.id);
        if (idx !== -1) {
          const next = [...list];
          next[idx] = { ...next[idx], ...inc };
          return next;
        }
        return isOptimistic ? [...list, inc] : list;
      };

      if (!incoming.roomId && !incoming.recipient && !incoming.parentMessageId) {
        setMessages(prev => mergeTopLevel(prev, incoming));
      }
      if (incoming.roomId) {
        setRoomMessages(prev => {
          const rid = Number(incoming.roomId);
          return { ...prev, [rid]: mergeTopLevel(prev[rid] || [], incoming) };
        });
      }
      if (incoming.recipient) {
        setPrivateMessages(prev => {
          const partner =
            [incoming.sender, incoming.recipient].find(
              u => u && !isSameIdentity(u, currentUser),
            ) || incoming.recipient;
          if (!partner) return prev;
          const norm = normalizeIdentity(partner);
          return { ...prev, [norm]: mergeTopLevel(prev[norm] || [], incoming) };
        });
      }
      setThreadMessages(prev => {
        if (!incoming.id) {
          return isOptimistic && incoming.parentMessageId ? [...prev, incoming] : prev;
        }
        const idx = prev.findIndex(m => m.id === incoming.id);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], ...incoming };
          return next;
        }
        return isOptimistic && incoming.parentMessageId ? [...prev, incoming] : prev;
      });
    },
    [currentUser, setMessages, setRoomMessages, setPrivateMessages, setThreadMessages],
  );

  // ── Wrapped public actions (inject dependencies) ──

  const sendMessage = useCallback(
    (content: string, recipient?: string | null) => {
      if (!isStompConnected()) {
        setError('Realtime chat is reconnecting. Please wait a moment and try again.');
        return;
      }
      msgSend(content, currentUser, stompSend, trackTelemetry, recipient);
    },
    [currentUser, msgSend, stompSend, trackTelemetry],
  );

  const sendRoomMessage = useCallback(
    (content: string, roomId: number) => {
      if (!isStompConnected()) {
        setError('Realtime chat is reconnecting. Please wait a moment and try again.');
        return;
      }
      msgSendRoom(content, roomId, currentUser, stompSend, trackTelemetry);
    },
    [currentUser, msgSendRoom, stompSend, trackTelemetry],
  );

  const editMessage = useCallback(
    async (messageId: number, content: string) => {
      await msgEdit(messageId, content, isStompConnected() ? stompSend : undefined);
    },
    [msgEdit, stompSend],
  );

  const deleteMessage = useCallback(
    async (messageId: number) => {
      await msgDelete(messageId, isStompConnected() ? stompSend : undefined);
    },
    [msgDelete, stompSend],
  );

  const toggleReaction = useCallback(
    async (messageId: number, emoji: string) => {
      await reactionsToggle(messageId, emoji, isStompConnected() ? stompSend : undefined);
    },
    [reactionsToggle, stompSend],
  );

  const searchMessages = useCallback(
    async (query: string) => {
      if (!featureFlagsRef.current.phaseDEnabled) return;
      await search.searchMessages(query);
    },
    [search],
  );

  const sendThreadReply = useCallback(
    async (content: string) => {
      await threadsSendReply(
        content,
        currentUser,
        isStompConnected() ? stompSend : undefined,
        updateMessageEverywhere,
      );
    },
    [currentUser, threadsSendReply, stompSend, updateMessageEverywhere],
  );

  const openThread = useCallback(
    async (rootMessage: ChatMessage) => {
      await threadsOpenThread(rootMessage, hydrateReactions);
    },
    [threadsOpenThread, hydrateReactions],
  );

  const createRoom = useCallback(
    async (name: string, members: string[]) =>
      rmCreate(name, members, currentUser, users),
    [rmCreate, currentUser, users],
  );

  const loadRoomHistory = useCallback(
    async (roomId: number) => {
      await msgLoadRoom(roomId, hydrateReactions);
      setRoomUnseenCounts(prev => ({ ...prev, [roomId]: 0 }));
    },
    [msgLoadRoom, hydrateReactions, setRoomUnseenCounts],
  );

  const loadPrivateHistory = useCallback(
    async (recipient: string) => {
      await msgLoadPrivate(recipient, currentUser, hydrateReactions);
      setPrivateUnseenCounts(prev => ({ ...prev, [recipient]: 0 }));
    },
    [msgLoadPrivate, currentUser, hydrateReactions, setPrivateUnseenCounts],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!isStompConnected()) return;
      const rid = selectedRoomIdRef.current;
      if (rid !== null && Number.isFinite(rid)) {
        stompSend(
          `/app/project/${projectId}/typing`,
          JSON.stringify({ scope: 'ROOM', roomId: rid, isTyping }),
        );
        return;
      }
      if (selectedUserRef.current) {
        stompSend(
          `/app/project/${projectId}/typing`,
          JSON.stringify({ scope: 'PRIVATE', recipient: selectedUserRef.current, isTyping }),
        );
        return;
      }
      stompSend(
        `/app/project/${projectId}/typing`,
        JSON.stringify({ scope: 'TEAM', isTyping }),
      );
    },
    [projectId, stompSend],
  );

  const selectPrivateUser = useCallback((user: string | null) => {
    setSelectedRoomId(null);
    setSelectedUser(user);
  }, []);

  const selectRoom = useCallback((roomId: number | null) => {
    setSelectedUser(null);
    if (roomId === null) { setSelectedRoomId(null); return; }
    const n = Number(roomId);
    setSelectedRoomId(Number.isFinite(n) ? n : null);
  }, []);

  // ── Selection persistence ──
  useEffect(() => {
    if (typeof window === 'undefined' || !hasRestoredSelection) return;
    const selection =
      selectedRoomId !== null && Number.isFinite(selectedRoomId)
        ? { type: 'room', value: selectedRoomId }
        : selectedUser
          ? { type: 'private', value: selectedUser }
          : { type: 'team', value: null };
    window.sessionStorage.setItem(selectionStorageKey, JSON.stringify(selection));
  }, [selectedRoomId, selectedUser, selectionStorageKey, hasRestoredSelection]);

  const restoreSelection = useCallback(
    (availableUsers: string[], availableRooms: ChatRoom[]) => {
      if (typeof window === 'undefined') {
        hasRestoredSelectionRef.current = true;
        setHasRestoredSelection(true);
        return;
      }
      const raw = window.sessionStorage.getItem(selectionStorageKey);
      if (!raw) {
        hasRestoredSelectionRef.current = true;
        setHasRestoredSelection(true);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as { type?: string; value?: string | number | null };
        if (parsed.type === 'private' && typeof parsed.value === 'string' && availableUsers.includes(parsed.value)) {
          setSelectedUser(parsed.value);
        } else if (parsed.type === 'room') {
          const rid = Number(parsed.value);
          if (Number.isFinite(rid) && availableRooms.some(r => r.id === rid)) setSelectedRoomId(rid);
        }
      } catch {
        // ignore
      } finally {
        hasRestoredSelectionRef.current = true;
        setHasRestoredSelection(true);
      }
    },
    [selectionStorageKey],
  );

  // ── Fetch helpers used during init ──
  const fetchAllUsers = useCallback(async () => {
    try {
      const data = await chatApi.fetchChatMembers(projectId);
      const normalized = data.map((u: string) => u.toLowerCase());
      setUsers(normalized);
      return normalized;
    } catch {
      return [] as string[];
    }
  }, [projectId]);

  const fetchUserProfilePics = useCallback(async () => {
    try {
      const profiles = await chatApi.fetchAllUserProfiles();
      const pics: Record<string, string> = {};
      profiles.forEach((p: chatApi.AuthUserSummary) => {
        const key = (p.username || p.email || '').toLowerCase();
        if (key && (p as Record<string, unknown>).profilePicUrl) {
          pics[key] = (p as Record<string, unknown>).profilePicUrl as string;
        }
      });
      setUserProfilePics(pics);
    } catch {
      // non-critical
    }
  }, []);

  // ── STOMP connection ──
  const connectToChat = useCallback(
    (token: string, username: string, aliases: string[]) => {
      try {
        const client = Stomp.over(() => new SockJS('http://localhost:8080/ws'));
        client.debug = () => {};
        client.reconnect_delay = 5000;
        const normalizedAliases = new Set(aliases.map(a => a.toLowerCase()));
        
        stompClientRef.current = client;

        client.connect({ Authorization: `Bearer ${token}` }, () => {
          setIsSocketConnected(true);
          setError('');

          // ── Team channel ──
          client.subscribe(`/topic/project/${projectId}/public`, payload => {
            const inc: ChatMessage = JSON.parse(payload.body);
            if (inc.type === 'JOIN' && inc.sender !== username) {
              setUsers(prev => (prev.includes(inc.sender) ? prev : [...prev, inc.sender]));
              return;
            }
            if (inc.type !== 'JOIN' && !inc.roomId && !inc.recipient) {
              if (inc.parentMessageId) return;
              setMessages(prev => mergeMessage(prev, inc));
              setTeamLastMessage(inc);
              if (
                inc.sender.toLowerCase() !== username &&
                selectedRoomIdRef.current === null &&
                !selectedUserRef.current
              ) {
                setTeamUnseenCount(0);
                markTeamAsRead();
              } else if (inc.sender.toLowerCase() !== username) {
                setTeamUnseenCount(prev => prev + 1);
              }
              if (inc.id) loadMsgReactions(inc.id);
            }
          });

          // ── Private messages ──
          client.subscribe(`/user/queue/project/${projectId}/messages`, payload => {
            const inc: ChatMessage = JSON.parse(payload.body);
            const sender = inc.sender?.toLowerCase() || '';
            const recipient = inc.recipient?.toLowerCase() || '';
            const isFromCurrent = normalizedAliases.has(sender);
            const partner = isFromCurrent ? recipient : sender;
            if (!partner || inc.parentMessageId) return;

            mergePrivateMessage(partner, inc, selectedUserRef.current, isFromCurrent);
            if (!isFromCurrent && !(selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner))) {
              const key = selectedUserRef.current && isSameIdentity(selectedUserRef.current, partner)
                ? selectedUserRef.current.toLowerCase() : partner;
              setPrivateUnseenCounts(prev => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            }
            setUsers(prev => (prev.some(u => isSameIdentity(u, partner)) ? prev : [...prev, partner]));
            if (inc.id) loadMsgReactions(inc.id);
          });

          // ── Room events ──
          client.subscribe(`/topic/project/${projectId}/rooms`, payload => {
            const event: RoomEvent = JSON.parse(payload.body);
            if ((event.action === 'CREATED' || event.action === 'UPDATED') && event.room) {
              const norm = normalizeRoom(event.room as unknown as Record<string, unknown>);
              if (!Number.isFinite(norm.id)) return;
              setRooms(prev =>
                prev.some(r => r.id === norm.id)
                  ? prev.map(r => (r.id === norm.id ? norm : r))
                  : [...prev, norm],
              );
              setRoomUnseenCounts(prev => ({ ...prev, [norm.id]: prev[norm.id] || 0 }));
              setRoomLastMessages(prev => ({ ...prev, [norm.id]: prev[norm.id] || null }));
              return;
            }
            if (event.action === 'DELETED') {
              const rid = Number(event.roomId);
              setRooms(prev => prev.filter(r => r.id !== rid));
              setRoomMessages(prev => { const n = { ...prev }; delete n[rid]; return n; });
              setRoomUnseenCounts(prev => { const n = { ...prev }; delete n[rid]; return n; });
              setRoomLastMessages(prev => { const n = { ...prev }; delete n[rid]; return n; });
            }
          });

          // ── Presence ──
          client.subscribe(`/topic/project/${projectId}/presence`, payload => {
            const event: PresenceEvent = JSON.parse(payload.body);
            setOnlineUsers((event.onlineUsers || []).map(u => u.toLowerCase()));
          });

          // ── Team typing ──
          client.subscribe(`/topic/project/${projectId}/typing/team`, payload => {
            const event: TypingEvent = JSON.parse(payload.body);
            const s = event.sender?.toLowerCase();
            if (!s || s === username.toLowerCase()) return;
            setTeamTypingUsers(prev =>
              event.typing ? (prev.includes(s) ? prev : [...prev, s]) : prev.filter(u => u !== s),
            );
          });

          // ── Private typing ──
          client.subscribe(`/user/queue/project/${projectId}/typing/private`, payload => {
            const event: TypingEvent = JSON.parse(payload.body);
            const s = event.sender?.toLowerCase();
            if (!s || s === username.toLowerCase()) return;
            setPrivateTypingUsers(prev =>
              event.typing ? (prev.includes(s) ? prev : [...prev, s]) : prev.filter(u => u !== s),
            );
          });

          // ── Unread badge ──
          client.subscribe(`/user/queue/project/${projectId}/unread-badge`, payload => {
            const badge: UnreadBadgeSummary = JSON.parse(payload.body);
            setUnreadBadge({
              teamUnread: Number(badge.teamUnread) || 0,
              roomsUnread: Number(badge.roomsUnread) || 0,
              directsUnread: Number(badge.directsUnread) || 0,
              totalUnread: Number(badge.totalUnread) || 0,
            });
          });

          // ── Mentions ──
          client.subscribe(`/user/queue/project/${projectId}/mentions`, payload => {
            const mention: MentionEvent = JSON.parse(payload.body);
            const ctx =
              mention.scope === 'ROOM' ? 'group chat'
                : mention.scope === 'PRIVATE' ? 'direct chat'
                  : mention.scope === 'THREAD' ? 'thread' : 'team chat';
            showCommandNotice(`You are mentioned by ${mention.sender} in ${ctx}.`);
            trackTelemetry('chat_mention_received', mention.scope || 'chat', `messageId=${mention.messageId || ''}`);

            if (mention.scope === 'ROOM' && mention.roomId) {
              const rid = Number(mention.roomId);
              if (selectedRoomIdRef.current !== rid) {
                setRoomMentionCounts(prev => ({ ...prev, [rid]: (prev[rid] || 0) + 1 }));
              }
            } else if (
              (mention.scope === 'TEAM' || !mention.scope) &&
              (selectedRoomIdRef.current !== null || selectedUserRef.current !== null)
            ) {
              setTeamMentionCount(prev => prev + 1);
            }
          });

          // ── Join + presence ping ──
          client.send(`/app/project/${projectId}/chat.addUser`, {}, JSON.stringify({ sender: username, type: 'JOIN' }));
          client.send(`/app/project/${projectId}/presence.ping`, {}, JSON.stringify({}));
        }, (connectError: unknown) => {
          setIsSocketConnected(false);
          setError('Connection failed. Is the backend running?');
          console.error(connectError);
        });
      } catch (err) {
        setIsSocketConnected(false);
        setError('Socket initialization failed.');
        console.error(err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, showCommandNotice, trackTelemetry],
  );

  // ── Initialization ──
  useEffect(() => {
    const initialize = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) { router.push('/login'); return; }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        let canonicalUsername: string | null = null;
        try {
          const me = await chatApi.fetchCurrentUser();
          canonicalUsername = me.username?.toLowerCase() || null;
        } catch { /* use JWT fallback */ }

        const username = (canonicalUsername || payload.username || payload.sub || payload.email || 'User').toLowerCase();
        const aliases = [payload.username, payload.sub, payload.email]
          .filter((v: string | undefined | null): v is string => Boolean(v && v.trim()))
          .map((v: string) => v.toLowerCase());
        if (canonicalUsername) aliases.push(canonicalUsername);

        const aliasWithLocalPart = aliases.flatMap((v: string) =>
          v.includes('@') ? [v, v.split('@')[0]] : [v],
        ).filter((v: string) => v && v.trim());
        const effectiveAliases = Array.from(new Set([...aliasWithLocalPart, username]));

        setCurrentUserAliases(effectiveAliases);
        setCurrentUser(username);
        setIsLoading(false);

        const loadedUsers = await fetchAllUsers();
        await fetchUserProfilePics();
        const loadedRooms = await rm.loadRooms();
        await loadFeatureFlags();
        await unread.loadSummaries(msg.setPrivateLastMessages, msg.setRoomLastMessages);
        await presence.loadPresence();
        await unread.loadUnreadBadge();
        restoreSelection(loadedUsers, loadedRooms);
        connectToChat(token, username, effectiveAliases);
        await msg.loadHistory(reactions.hydrateReactions);
      } catch {
        setError('Invalid authentication token.');
        router.push('/login');
      }
    };

    initialize();
    return () => {
      setIsSocketConnected(false);
      if (stompClientRef.current?.connected) stompClientRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Presence heartbeat ──
  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) return;
    const interval = window.setInterval(() => {
      stompClientRef.current?.send(`/app/project/${projectId}/presence.ping`, {}, JSON.stringify({}));
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [projectId, isSocketConnected]);

  // ── Per-room STOMP subscriptions ──
  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) return;
    const client = stompClientRef.current;

    const subs = rm.rooms.flatMap(room => {
      const msgSub = client.subscribe(`/topic/project/${projectId}/room/${room.id}`, payload => {
        const inc: ChatMessage = JSON.parse(payload.body);
        if (inc.type === 'JOIN' || !inc.roomId || inc.parentMessageId) return;
        setRoomMessages(prev => ({
          ...prev,
          [inc.roomId as number]: mergeMessage(prev[inc.roomId as number] || [], inc),
        }));
        setRoomLastMessages(prev => ({ ...prev, [inc.roomId as number]: inc }));
        if (inc.sender.toLowerCase() !== currentUser && selectedRoomIdRef.current !== inc.roomId) {
          setRoomUnseenCounts(prev => ({
            ...prev,
            [inc.roomId as number]: (prev[inc.roomId as number] || 0) + 1,
          }));
        }
        if (inc.id) loadMsgReactions(inc.id);
      });

      const typeSub = client.subscribe(`/topic/project/${projectId}/typing/room/${room.id}`, payload => {
        const event: TypingEvent = JSON.parse(payload.body);
        const s = event.sender?.toLowerCase();
        if (!s || s === currentUser.toLowerCase()) return;
        const rid = Number(event.roomId || room.id);
        setRoomTypingUsers(prev => {
          const existing = prev[rid] || [];
          return {
            ...prev,
            [rid]: event.typing
              ? existing.includes(s) ? existing : [...existing, s]
              : existing.filter(u => u !== s),
          };
        });
      });

      return [msgSub, typeSub];
    });

    return () => subs.forEach(s => s?.unsubscribe());
  }, [projectId, rm.rooms, isSocketConnected, currentUser, setRoomMessages, setRoomLastMessages, setRoomUnseenCounts, loadMsgReactions, setRoomTypingUsers]);

  // ── Thread subscription ──
  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current || !threads.activeThreadRootRef.current?.id) return;
    const rootId = threads.activeThreadRootRef.current.id;
    const sub = stompClientRef.current.subscribe(`/topic/project/${projectId}/thread/${rootId}`, payload => {
      const inc: ChatMessage = JSON.parse(payload.body);
      setThreadMessages(prev => mergeMessage(prev, inc));
      if (inc.id) loadMsgReactions(inc.id);
    });
    return () => sub.unsubscribe();
  }, [projectId, isSocketConnected, threads.activeThreadRootRef, setThreadMessages, loadMsgReactions]);

  // ── Per-message reaction subscriptions ──
  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) return;
    const client = stompClientRef.current;
    const ids = new Set<number>();

    msg.messages.forEach(m => { if (m.id) ids.add(m.id); });
    Object.values(msg.privateMessages).forEach(list => list.forEach(m => { if (m.id) ids.add(m.id); }));
    Object.values(msg.roomMessages).forEach(list => list.forEach(m => { if (m.id) ids.add(m.id); }));
    threads.threadMessages.forEach(m => { if (m.id) ids.add(m.id); });

    const subs = Array.from(ids).map(id =>
      client.subscribe(`/topic/project/${projectId}/messages/${id}/reactions`, payload => {
        const r: ChatReactionSummary[] = JSON.parse(payload.body);
        setMessageReactions(prev => ({ ...prev, [id]: r }));
      }),
    );

    return () => subs.forEach(s => s.unsubscribe());
  }, [projectId, isSocketConnected, msg.messages, msg.privateMessages, msg.roomMessages, threads.threadMessages, setMessageReactions]);

  // ── Selection cleanup ──
  useEffect(() => {
    if (!selectedUser) { setPrivateTypingUsers([]); return; }
    setPrivateTypingUsers(prev => prev.filter(u => isSameIdentity(u, selectedUser)));
    setPrivateUnseenCounts(prev => ({ ...prev, [selectedUser]: 0 }));
  }, [selectedUser, setPrivateTypingUsers, setPrivateUnseenCounts]);

  useEffect(() => {
    if (selectedRoomId === null || !Number.isFinite(selectedRoomId)) {
      setRoomTypingUsers({});
      return;
    }
    setRoomTypingUsers(prev => ({ [selectedRoomId]: prev[selectedRoomId] || [] }));
    setRoomUnseenCounts(prev => ({ ...prev, [selectedRoomId]: 0 }));
    setRoomMentionCounts(prev => ({ ...prev, [selectedRoomId]: 0 }));
  }, [selectedRoomId, setRoomTypingUsers, setRoomUnseenCounts, setRoomMentionCounts]);

  useEffect(() => {
    if (!hasRestoredSelection) return;
    if (selectedRoomId === null && !selectedUser) {
      setTeamUnseenCount(0);
      setTeamMentionCount(0);
      markTeamAsRead();
    }
  }, [selectedRoomId, selectedUser, setTeamUnseenCount, setTeamMentionCount, markTeamAsRead, hasRestoredSelection]);

  // ── Return unified interface ──
  return {
    currentUser,
    currentUserAliases,
    users,
    messages: msg.messages,
    privateMessages: msg.privateMessages,
    rooms: rm.rooms,
    roomMessages: msg.roomMessages,
    selectedUser,
    selectedRoomId,
    privateUnseenCounts: unread.privateUnseenCounts,
    roomUnseenCounts: unread.roomUnseenCounts,
    privateLastMessages: msg.privateLastMessages,
    roomLastMessages: msg.roomLastMessages,
    teamUnseenCount: unread.teamUnseenCount,
    teamLastMessage: msg.teamLastMessage,
    userProfilePics,
    onlineUsers: presence.onlineUsers,
    teamTypingUsers: presence.teamTypingUsers,
    roomTypingUsers: presence.roomTypingUsers,
    privateTypingUsers: presence.privateTypingUsers,
    unreadBadge: unread.unreadBadge,
    featureFlags,
    searchResults: search.searchResults,
    isSearchLoading: search.isSearchLoading,
    commandNotice,
    messageReactions: reactions.messageReactions,
    activeThreadRoot: threads.activeThreadRoot,
    threadMessages: threads.threadMessages,
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    sendThreadReply,
    openThread,
    closeThread: threadsClose,
    editMessage,
    deleteMessage,
    toggleReaction,
    loadRoomHistory,
    loadPrivateHistory,
    createRoom,
    deleteRoom: rmDelete,
    updateRoomMeta: rmUpdateMeta,
    pinRoomMessage: rmPin,
    sendTyping,
    searchMessages,
    trackTelemetry,
    addTeam,
    isLoading,
    isSocketConnected,
    error,
    roomMentionCounts: unread.roomMentionCounts,
    teamMentionCount: unread.teamMentionCount,
    retryConnection: () => window.location.reload(),
  };
};
