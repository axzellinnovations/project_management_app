import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient } from '@stomp/stompjs';
import { ChatMessage } from '../components/chat';

export const useChat = () => {
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
      
      fetchAllUsers(token, payload.email || payload.sub);
      connectToChat(token, username);
    } catch (err) {
      setError('Invalid authentication token.');
      router.push('/login');
    }

    return () => {
      if (stompClientRef.current?.connected) stompClientRef.current.disconnect();
    };
  }, [router]);

  // 2. Fetch Users
  const fetchAllUsers = async (token: string, currentEmail: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/auth/users?excludeEmail=${encodeURIComponent(currentEmail)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.map((u: any) => (u.username || u.email).toLowerCase()));
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // 3. WebSocket Connection
  const connectToChat = (token: string, username: string) => {
    try {
      const socket = new SockJS('http://localhost:8080/ws');
      const client = Stomp.over(socket);
      client.debug = () => {}; // Disable debug logs for cleaner console

      client.connect({ Authorization: `Bearer ${token}` }, () => {
        stompClientRef.current = client;
        
        // Subscribe to Public
        client.subscribe('/topic/public', (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          if (msg.type === 'JOIN' && msg.sender !== username) {
            setUsers(prev => prev.includes(msg.sender) ? prev : [...prev, msg.sender]);
          }
          setMessages(prev => [...prev, msg]);
        });

        // Subscribe to Private
        client.subscribe('/user/queue/messages', (payload) => {
          const msg: ChatMessage = JSON.parse(payload.body);
          const sender = msg.sender.toLowerCase();
          setPrivateMessages(prev => ({
            ...prev,
            [sender]: [...(prev[sender] || []), msg]
          }));
          setUsers(prev => prev.includes(sender) ? prev : [...prev, sender]);
        });

        // Notify Join
        client.send('/app/chat.addUser', {}, JSON.stringify({ sender: username, type: 'JOIN' }));
      }, (err: any) => {
        setError('Connection failed. Is the backend running?');
        console.error(err);
      });
    } catch (err) {
      setError('Socket initialization failed.');
    }
  };

  // 4. Send Message Action
  const sendMessage = useCallback((content: string, recipient?: string | null) => {
    if (!content.trim() || !stompClientRef.current) return;

    if (recipient) {
      // Private
      const msg = { sender: currentUser, content, recipient };
      stompClientRef.current.send('/app/chat.sendPrivateMessage', {}, JSON.stringify(msg));
      
      // Optimistic update for sender
      setPrivateMessages(prev => ({
        ...prev,
        [recipient.toLowerCase()]: [...(prev[recipient.toLowerCase()] || []), msg]
      }));
    } else {
      // Public
      const msg = { sender: currentUser, content };
      stompClientRef.current.send('/app/chat.sendMessage', {}, JSON.stringify(msg));
    }
  }, [currentUser]);

  return {
    currentUser,
    users,
    messages,
    privateMessages,
    sendMessage,
    isLoading,
    error,
    retryConnection: () => window.location.reload() // Simple retry strategy
  };
};