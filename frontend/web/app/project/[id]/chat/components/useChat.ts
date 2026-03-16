import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient } from '@stomp/stompjs';
import { ChatMessage, ChatRoom, DirectChatSummary, RoomChatSummary } from '../components/chat';

interface RoomEvent {
  action: 'CREATED' | 'DELETED';
  roomId: number;
  room?: ChatRoom;
}

export const useChat = (projectId: string) => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [roomMessages, setRoomMessages] = useState<Record<number, ChatMessage[]>>({});
  const [privateUnseenCounts, setPrivateUnseenCounts] = useState<Record<string, number>>({});
  const [roomUnseenCounts, setRoomUnseenCounts] = useState<Record<number, number>>({});
  const [privateLastMessages, setPrivateLastMessages] = useState<Record<string, ChatMessage | null>>({});
  const [roomLastMessages, setRoomLastMessages] = useState<Record<number, ChatMessage | null>>({});
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const stompClientRef = useRef<CompatClient | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const selectedRoomIdRef = useRef<number | null>(null);
  const hasRestoredSelectionRef = useRef(false);
  const selectionStorageKey = `chat-selection:${projectId}`;

  const addTeam = useCallback((teamName: string) => {
    setUsers(prev => {
      if (!teamName.trim() || prev.includes(teamName)) return prev;
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
    if (typeof window === 'undefined' || !hasRestoredSelectionRef.current) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const selection = selectedRoomId !== null && Number.isFinite(selectedRoomId)
      ? { type: 'room', value: selectedRoomId }
      : selectedUser
      ? { type: 'private', value: selectedUser }
      : { type: 'team', value: null };

    window.sessionStorage.setItem(selectionStorageKey, JSON.stringify(selection));
  }, [selectedRoomId, selectedUser, selectionStorageKey]);

  // 2. Fetch Users
  const fetchAllUsers = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const normalizedUsers = data.map((u: string) => u.toLowerCase());
        setUsers(normalizedUsers);
        return normalizedUsers;
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }

    return [] as string[];
  }, [projectId]);

  const loadRooms = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/chat/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const normalizedRooms: ChatRoom[] = (data || []).map((room: any) => ({
          ...room,
          id: Number(room.id),
          projectId: Number(room.projectId)
        })).filter((room: ChatRoom) => Number.isFinite(room.id));
        setRooms(normalizedRooms);
        return normalizedRooms;
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }

    return [] as ChatRoom[];
  }, [projectId]);

  const loadSummaries = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/summaries`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        return;
      }

      const data = await res.json();
      const directSummaries: DirectChatSummary[] = data.directMessages || [];
      const roomSummaries: RoomChatSummary[] = data.rooms || [];

      setPrivateUnseenCounts(Object.fromEntries(
        directSummaries.map(summary => [summary.username.toLowerCase(), Number(summary.unseenCount) || 0])
      ));
      setRoomUnseenCounts(Object.fromEntries(
        roomSummaries.map(summary => [Number(summary.roomId), Number(summary.unseenCount) || 0])
      ));
      setPrivateLastMessages(Object.fromEntries(
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
      ));
      setRoomLastMessages(Object.fromEntries(
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
      ));
    } catch (err) {
      console.error('Error fetching chat summaries:', err);
    }
  }, [projectId]);

  const restoreSelection = useCallback((availableUsers: string[], availableRooms: ChatRoom[]) => {
    if (typeof window === 'undefined') {
      hasRestoredSelectionRef.current = true;
      return;
    }

    const rawSelection = window.sessionStorage.getItem(selectionStorageKey);
    if (!rawSelection) {
      hasRestoredSelectionRef.current = true;
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
    } catch (err) {
      console.error('Failed to restore chat selection', err);
    } finally {
      hasRestoredSelectionRef.current = true;
    }
  }, [selectionStorageKey]);

  const loadRoomHistory = useCallback(async (roomId: number) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/chat/messages?roomId=${roomId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRoomMessages(prev => ({ ...prev, [roomId]: data }));
        setRoomLastMessages(prev => ({
          ...prev,
          [roomId]: data.length > 0 ? data[data.length - 1] : null
        }));
        setRoomUnseenCounts(prev => ({ ...prev, [roomId]: 0 }));
      }
    } catch (err) {
      console.error('Failed to load room history', err);
    }
  }, [projectId]);

  // utility to fetch history
  const loadHistory = useCallback(async (token: string, username: string) => {
    try {
      // use relative path; Next.js rewrite will proxy to backend
      const res = await fetch(`/api/projects/${projectId}/chat/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      } else {
        console.warn('History fetch returned', res.status);
      }
    } catch (err) {
      console.error('Failed to load message history', err);
    }
  }, [projectId]);

  const createRoom = useCallback(async () => {
    const name = prompt('Enter new group chat name');
    if (!name || !name.trim()) {
      return null;
    }
    if (users.length === 0) {
      alert('No project members found to add.');
      return null;
    }

    const members = prompt(`Enter group members (comma-separated, choose from: ${users.filter(u => u !== currentUser).join(', ')})`);
    if (!members) {
      return null;
    }

    const chosenMembers = members.split(',')
      .map(u => u.trim().toLowerCase())
      .filter(u => u && u !== currentUser && users.includes(u));

    if (chosenMembers.length === 0) {
      alert('Please include at least one valid member.');
      return null;
    }

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/chat/rooms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name: name.trim(), members: chosenMembers })
      });
      if (res.ok || res.status === 201) {
        const rawRoom = await res.json();
        const createdRoom: ChatRoom = {
          ...rawRoom,
          id: Number(rawRoom.id),
          projectId: Number(rawRoom.projectId)
        };
        if (!Number.isFinite(createdRoom.id)) {
          console.error('Created room returned invalid id', rawRoom);
          alert('Room created but returned invalid id. Please refresh and try again.');
          return null;
        }
        setRooms(prev => prev.some(room => room.id === createdRoom.id) ? prev : [...prev, createdRoom]);
        setRoomMessages(prev => ({ ...prev, [createdRoom.id]: prev[createdRoom.id] || [] }));
        return createdRoom;
      } else {
        const text = await res.text();
        console.error('Failed to create room', res.status, text);
        alert('Failed to create room');
        return null;
      }
    } catch (err) {
      console.error('Failed to create room', err);
      alert('Failed to create room');
      return null;
    }
  }, [projectId, users, currentUser]);

  const deleteRoom = useCallback(async (roomId: number) => {
    if (!confirm('Delete this group chat?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/projects/${projectId}/chat/rooms/${roomId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 204) {
        await loadRooms();
      } else {
        const text = await res.text();
        console.error('Failed to delete room', res.status, text);
        alert(res.status === 404 ? 'Group chat not found or already deleted.' : 'Failed to delete group chat.');
      }
    } catch (err) {
      console.error('Failed to delete room', err);
      alert('Failed to delete group chat. Please try again.');
    }
  }, [projectId, loadRooms]);

  // 3. WebSocket Connection
  const connectToChat = useCallback((token: string, username: string) => {
    try {
      const socket = new SockJS('http://localhost:8080/ws');
      const client = Stomp.over(socket);
      client.debug = () => {}; // Disable debug logs for cleaner console

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClientRef.current = client;
        setIsSocketConnected(true);
        
        // Subscribe to Public
        client.subscribe(`/topic/project/${projectId}/public`, (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          if (msg.type === 'JOIN' && msg.sender !== username) {
            setUsers(prev => prev.includes(msg.sender) ? prev : [...prev, msg.sender]);
          }

          // Team chat should only contain non-room, non-private messages.
          if (msg.type !== 'JOIN' && !msg.roomId && !msg.recipient) {
            setMessages(prev => [...prev, msg]);
          }
        });

        // Subscribe to Private
        client.subscribe(`/user/queue/project/${projectId}/messages`, (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          const sender = msg.sender.toLowerCase();
          setPrivateMessages(prev => ({
            ...prev,
            [sender]: [...(prev[sender] || []), msg]
          }));
          setPrivateLastMessages(prev => ({ ...prev, [sender]: msg }));

          if (sender !== username && selectedUserRef.current !== sender) {
            setPrivateUnseenCounts(prev => ({
              ...prev,
              [sender]: (prev[sender] || 0) + 1
            }));
          }
          setUsers(prev => prev.includes(sender) ? prev : [...prev, sender]);
        });

        client.subscribe(`/topic/project/${projectId}/rooms`, (payload) => {
          const event: RoomEvent = JSON.parse(payload.body);
          if (event.action === 'CREATED' && event.room) {
            const normalizedRoom: ChatRoom = {
              ...event.room,
              id: Number(event.room.id),
              projectId: Number(event.room.projectId)
            };
            if (!Number.isFinite(normalizedRoom.id)) {
              return;
            }
            setRooms(prev => prev.some(room => room.id === normalizedRoom.id) ? prev : [...prev, normalizedRoom]);
            setRoomUnseenCounts(prev => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || 0 }));
            setRoomLastMessages(prev => ({ ...prev, [normalizedRoom.id]: prev[normalizedRoom.id] || null }));
            return;
          }

          if (event.action === 'DELETED') {
            setRooms(prev => prev.filter(room => room.id !== Number(event.roomId)));
            setRoomMessages(prev => {
              const next = { ...prev };
              delete next[Number(event.roomId)];
              return next;
            });
            setRoomUnseenCounts(prev => {
              const next = { ...prev };
              delete next[Number(event.roomId)];
              return next;
            });
            setRoomLastMessages(prev => {
              const next = { ...prev };
              delete next[Number(event.roomId)];
              return next;
            });
          }
        });

        // Notify Join
        client.send(`/app/project/${projectId}/chat.addUser`, {}, JSON.stringify({ sender: username, type: 'JOIN' }));
      }, (err: any) => {
        setIsSocketConnected(false);
        setError('Connection failed. Is the backend running?');
        console.error(err);
      });
    } catch (err) {
      setIsSocketConnected(false);
      setError('Socket initialization failed.');
    }
  }, [projectId]);

  // 1. Initial Auth & Setup
  useEffect(() => {
    const initialize = async () => {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const username = (payload.username || payload.sub || payload.email || 'User').toLowerCase();
        setCurrentUser(username);
        setIsLoading(false);

        const loadedUsers = await fetchAllUsers(token);
        const loadedRooms = await loadRooms();
        await loadSummaries(token);
        restoreSelection(loadedUsers, loadedRooms);
        connectToChat(token, username);
        loadHistory(token, username);
      } catch (err) {
        setError('Invalid authentication token.');
        router.push('/login');
      }
    };

    initialize();

    return () => {
      setIsSocketConnected(false);
      if (stompClientRef.current?.connected) stompClientRef.current.disconnect();
    };
  }, [router, fetchAllUsers, loadRooms, loadSummaries, restoreSelection, connectToChat, loadHistory]);

  useEffect(() => {
    if (!isSocketConnected || !stompClientRef.current) return;
    const connectedClient = stompClientRef.current;
    const subscriptions = rooms.map(room => connectedClient.subscribe(`/topic/project/${projectId}/room/${room.id}`, (payload) => {
      const msg: ChatMessage = JSON.parse(payload.body);
      if (msg.type !== 'JOIN' && msg.roomId) {
        setRoomMessages(prev => ({
          ...prev,
          [msg.roomId]: [...(prev[msg.roomId] || []), msg]
        }));
        setRoomLastMessages(prev => ({ ...prev, [msg.roomId]: msg }));

        if (msg.sender.toLowerCase() !== currentUser && selectedRoomIdRef.current !== msg.roomId) {
          setRoomUnseenCounts(prev => ({
            ...prev,
            [msg.roomId]: (prev[msg.roomId] || 0) + 1
          }));
        }
      }
    }));

    return () => {
      subscriptions.forEach(sub => sub && sub.unsubscribe && sub.unsubscribe());
    };
  }, [projectId, rooms, isSocketConnected, currentUser]);
  // 4. fetch private conversation when needed
  const loadPrivateHistory = useCallback(async (recipient: string) => {
    if (!recipient || !currentUser) return;
    try {
      const params = new URLSearchParams();
      params.append('recipient', currentUser);
      params.append('with', recipient);
      const res = await fetch(`/api/projects/${projectId}/chat/messages?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrivateMessages(prev => ({ ...prev, [recipient]: data }));
        setPrivateLastMessages(prev => ({
          ...prev,
          [recipient]: data.length > 0 ? data[data.length - 1] : null
        }));
        setPrivateUnseenCounts(prev => ({ ...prev, [recipient]: 0 }));
      } else {
        console.warn('Private history fetch returned', res.status);
      }
    } catch (err) {
      console.error('Failed to load private history', err);
    }
  }, [currentUser, projectId]);

  useEffect(() => {
    if (!selectedUser) {
      return;
    }
    setPrivateUnseenCounts(prev => ({ ...prev, [selectedUser]: 0 }));
  }, [selectedUser]);

  useEffect(() => {
    if (selectedRoomId === null || !Number.isFinite(selectedRoomId)) {
      return;
    }
    setRoomUnseenCounts(prev => ({ ...prev, [selectedRoomId]: 0 }));
  }, [selectedRoomId]);

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
    const normalizedRoomId = Number(roomId);
    setSelectedRoomId(Number.isFinite(normalizedRoomId) ? normalizedRoomId : null);
  }, []);

  // 4. Send Message Action
  const sendMessage = useCallback((content: string, recipient?: string | null) => {
    if (!content.trim() || !stompClientRef.current) return;

    if (recipient) {
      // Private
      const msg = { sender: currentUser, content, recipient };
      stompClientRef.current.send(`/app/project/${projectId}/chat.sendPrivateMessage`, {}, JSON.stringify(msg));
      
      // Optimistic update for sender
      setPrivateMessages(prev => ({
        ...prev,
        [recipient.toLowerCase()]: [...(prev[recipient.toLowerCase()] || []), msg]
      }));
      setPrivateLastMessages(prev => ({ ...prev, [recipient.toLowerCase()]: msg }));
    } else {
      // Public
      const msg = { sender: currentUser, content };
      stompClientRef.current.send(`/app/project/${projectId}/chat.sendMessage`, {}, JSON.stringify(msg));
    }
  }, [currentUser, projectId]);

  const sendRoomMessage = useCallback((content: string, roomId: number) => {
    if (!content.trim() || !stompClientRef.current) return;
    const msg = { sender: currentUser, content, roomId };
    stompClientRef.current.send(`/app/project/${projectId}/room/${roomId}/send`, {}, JSON.stringify(msg));
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: [...(prev[roomId] || []), msg]
    }));
    setRoomLastMessages(prev => ({ ...prev, [roomId]: msg }));
  }, [currentUser, projectId]);

  return {
    currentUser,
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
    selectPrivateUser,
    selectRoom,
    sendMessage,
    sendRoomMessage,
    loadRoomHistory,
    loadPrivateHistory,
    createRoom,
    deleteRoom,
    addTeam,
    isLoading,
    error,
    retryConnection: () => window.location.reload() // Simple retry strategy
  };
};