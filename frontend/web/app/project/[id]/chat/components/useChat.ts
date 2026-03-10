import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient } from '@stomp/stompjs';
import { ChatMessage } from '../components/chat';

export const useChat = (projectId: string) => {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const [users, setUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const stompClientRef = useRef<CompatClient | null>(null);

  // 1. Initial Auth & Setup
  useEffect(() => {
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
      
      fetchAllUsers(token);
      connectToChat(token, username);
      loadHistory(token, username);
    } catch (err) {
      setError('Invalid authentication token.');
      router.push('/login');
    }

    return () => {
      if (stompClientRef.current?.connected) stompClientRef.current.disconnect();
    };
  }, [router]);

  // 2. Fetch Users
  const fetchAllUsers = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/chat/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.map((u: string) => u.toLowerCase()));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
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

  // 3. WebSocket Connection
  const connectToChat = useCallback((token: string, username: string) => {
    try {
      const socket = new SockJS('http://localhost:8080/ws');
      const client = Stomp.over(socket);
      client.debug = () => {}; // Disable debug logs for cleaner console

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClientRef.current = client;
        
        // Subscribe to Public
        client.subscribe(`/topic/project/${projectId}/public`, (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          if (msg.type === 'JOIN' && msg.sender !== username) {
            setUsers(prev => prev.includes(msg.sender) ? prev : [...prev, msg.sender]);
          }
          setMessages(prev => [...prev, msg]);
        });

        // Subscribe to Private
        client.subscribe(`/user/queue/project/${projectId}/messages`, (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          const sender = msg.sender.toLowerCase();
          setPrivateMessages(prev => ({
            ...prev,
            [sender]: [...(prev[sender] || []), msg]
          }));
          setUsers(prev => prev.includes(sender) ? prev : [...prev, sender]);
        });

        // Notify Join
        client.send(`/app/project/${projectId}/chat.addUser`, {}, JSON.stringify({ sender: username, type: 'JOIN' }));
      }, (err: any) => {
        setError('Connection failed. Is the backend running?');
        console.error(err);
      });
    } catch (err) {
      setError('Socket initialization failed.');
    }
  }, [projectId]);

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
      } else {
        console.warn('Private history fetch returned', res.status);
      }
    } catch (err) {
      console.error('Failed to load private history', err);
    }
  }, [currentUser, projectId]);

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
    } else {
      // Public
      const msg = { sender: currentUser, content };
      stompClientRef.current.send(`/app/project/${projectId}/chat.sendMessage`, {}, JSON.stringify(msg));
    }
  }, [currentUser, projectId]);

  return {
    currentUser,
    users,
    messages,
    privateMessages,
    sendMessage,
    loadPrivateHistory,
    isLoading,
    error,
    retryConnection: () => window.location.reload() // Simple retry strategy
  };
};