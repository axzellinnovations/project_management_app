'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient } from '@stomp/stompjs';

interface ChatMessage {
  sender: string;
  content: string;
  timestamp?: string;
  recipient?: string;
  type?: 'CHAT' | 'JOIN' | 'LEAVE';
}

export default function ChatInterface() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});
  const stompClientRef = useRef<CompatClient | null>(null);

  // Authentication and setup
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    if (!token) {
      console.warn('No token found in localStorage');
      router.push('/login');
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const extractedUsername = (payload.username || payload.sub || payload.email || 'User').toLowerCase();
      console.log('Extracted username from token:', extractedUsername);
      setCurrentUser(extractedUsername);
      setIsLoading(false);
      
      // Fetch all registered users
      fetchAllUsers(token, payload.email || payload.sub);
      
      connectToChat(token);
    } catch (err) {
      console.error('Invalid token format:', err);
      setError('Invalid authentication token. Please login again.');
      router.push('/login');
    }
  }, [router]);

  const fetchAllUsers = async (token: string, currentEmail: string) => {
    try {
      const response = await fetch(`http://localhost:8080/api/auth/users?excludeEmail=${encodeURIComponent(currentEmail)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const allUsers = await response.json();
        const usernames = allUsers.map((user: any) => (user.username || user.email).toLowerCase());
        console.log('Fetched users:', usernames);
        setUsers(usernames);
      } else {
        console.warn('Failed to fetch users:', response.statusText);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.disconnect(() => {});
      }
    };
  }, []);

  const connectToChat = (token: string) => {
    console.log('Attempting to connect to WebSocket at http://localhost:8080/ws');
    
    try {
      const socket = new SockJS('http://localhost:8080/ws');
      
      socket.onopen = () => {
        console.log('SockJS connection opened');
      };
      
      socket.onerror = (error: any) => {
        console.error('SockJS connection error:', error);
        setError('Failed to establish WebSocket connection. Backend may not be running.');
      };
      
      socket.onclose = () => {
        console.log('SockJS connection closed');
      };
      
      stompClientRef.current = Stomp.over(socket);
      
      // Enable logging for debugging
      stompClientRef.current.debug = (msg: string) => {
        console.log('[STOMP]', msg);
      };

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`
      };
      
      console.log('Sending STOMP CONNECT with Authorization header');
      
      stompClientRef.current.connect(
        headers,
        (frame: any) => {
          console.log('STOMP connection successful');
          onConnected();
        },
        (error: any) => {
          console.error('STOMP connection error:', error);
          onError(error);
        }
      );
    } catch (err) {
      console.error('Error creating WebSocket connection:', err);
      setError('Failed to initialize WebSocket. Check console for details.');
    }
  };

  const onConnected = () => {
    if (stompClientRef.current) {
      // Subscribe to Public Topic
      stompClientRef.current.subscribe('/topic/public', onMessageReceived);

      // Subscribe to Private User Queue
      stompClientRef.current.subscribe('/user/queue/messages', onPrivateMessageReceived);

      // Tell the server that a new user has joined
      stompClientRef.current.send(
        '/app/chat.addUser',
        {},
        JSON.stringify({ sender: currentUser, type: 'JOIN' })
      );
    }
  };

  const onError = (error: any) => {
    console.error('WebSocket Connection Error:', error);
    let errorMsg = 'Could not connect to WebSocket server.';
    
    if (error?.headers?.message) {
      errorMsg = `Connection failed: ${error.headers.message}`;
    } else if (error?.message) {
      errorMsg = `Connection failed: ${error.message}`;
    }
    
    setError(errorMsg + ' Make sure backend is running on http://localhost:8080');
  };

  const onMessageReceived = (payload: { body: string }) => {
    const msg: ChatMessage = JSON.parse(payload.body);
    
    // If it's a JOIN message, add the user to the list
    if (msg.type === 'JOIN' && msg.sender && msg.sender !== currentUser) {
      setUsers((prev) => {
        const lowerSender = msg.sender.toLowerCase();
        return prev.map(u => u.toLowerCase()).includes(lowerSender) ? prev : [...prev, msg.sender];
      });
    }
    
    // Avoid adding duplicate messages
    setMessages((prev) => {
      const isDuplicate = prev.some(
        m => m.sender === msg.sender && m.content === msg.content
      );
      return isDuplicate ? prev : [...prev, msg];
    });
  };

  const onPrivateMessageReceived = (payload: { body: string }) => {
    const msg: ChatMessage = JSON.parse(payload.body);
    const sender = msg.sender.toLowerCase();

    setPrivateMessages((prev) => {
      const conversation = prev[sender] || [];
      
      // Check if message already exists to prevent duplicates
      const isDuplicate = conversation.some(
        m => m.sender === msg.sender && m.content === msg.content
      );
      
      if (isDuplicate) {
        return prev;
      }
      
      return {
        ...prev,
        [sender]: [...conversation, msg],
      };
    });

    // Add user to users list if not already there
    setUsers((prev) => {
      const lowerSender = sender;
      return prev.map(u => u.toLowerCase()).includes(lowerSender) ? prev : [...prev, sender];
    });
  };

  const handleSendMessage = () => {
    if (messageInput.trim() && stompClientRef.current) {
      if (selectedUser) {
        // Send private message
        const privateMsg: ChatMessage = {
          sender: currentUser,
          content: messageInput,
          recipient: selectedUser,
        };
        stompClientRef.current.send(
          '/app/chat.sendPrivateMessage',
          {},
          JSON.stringify(privateMsg)
        );

        // Add to local private messages - store under current user to avoid duplication
        setPrivateMessages((prev) => {
          const convoKey = selectedUser.toLowerCase();
          const conversation = prev[convoKey] || [];
          
          // Check if message already exists
          const isDuplicate = conversation.some(
            m => m.sender === currentUser && m.content === messageInput
          );
          
          if (isDuplicate) {
            return prev;
          }
          
          return {
            ...prev,
            [convoKey]: [...conversation, privateMsg],
          };
        });
      } else {
        // Send public message
        const publicMsg: ChatMessage = {
          sender: currentUser,
          content: messageInput,
        };
        stompClientRef.current.send(
          '/app/chat.sendMessage',
          {},
          JSON.stringify(publicMsg)
        );
      }
      setMessageInput('');
    }
  };

  const displayMessages = selectedUser ? privateMessages[selectedUser] || [] : messages;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading chat...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50">
      {/* Users Sidebar */}
      <aside className="w-72 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Chats</h2>
          <p className="text-xs text-slate-500 mt-1">Logged in as {currentUser}</p>
        </div>

        {/* Team Chat Button */}
        <button
          onClick={() => setSelectedUser(null)}
          className={`mx-3 mt-3 w-auto px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
            selectedUser === null
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
          }`}
        >
          Team Chat
        </button>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase px-3 py-2">Users</p>
          {users.length === 0 ? (
            <p className="text-xs text-slate-400 px-3 py-2">No users online</p>
          ) : (
            users
              .filter((user, index, self) => self.map(u => u.toLowerCase()).indexOf(user.toLowerCase()) === index)
              .map((user) => {
                const userKey = user.toLowerCase();
                return (
                  <button
                    key={userKey}
                    onClick={() => setSelectedUser(userKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                      selectedUser === userKey
                        ? 'bg-blue-50 border border-blue-200 shadow-sm'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {user.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{user}</p>
                      {privateMessages[userKey]?.length > 0 && (
                        <p className="text-xs text-slate-500 truncate">
                          {privateMessages[userKey][privateMessages[userKey].length - 1]?.content}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
          )}
        </div>
      </aside>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        {/* Header */}
        <div className="p-4 lg:p-6 border-b border-slate-200 flex items-center justify-between bg-white/50 backdrop-blur-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {selectedUser ? `Chat with ${selectedUser}` : 'Team Chat'}
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {selectedUser ? 'Private message' : 'All team members'}
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gradient-to-b from-transparent to-slate-50">
          {displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-slate-400">
                {selectedUser
                  ? 'No messages yet. Start the conversation!'
                  : 'No messages yet. Start the conversation!'}
              </p>
            </div>
          ) : (
            displayMessages.map((msg, index) => (
              <div
                key={index}
                className={`flex gap-4 ${
                  msg.sender === currentUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {msg.sender !== currentUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                    {msg.sender.charAt(0).toUpperCase()}
                  </div>
                )}
                <div
                  className={`flex flex-col gap-1 max-w-[70%] ${
                    msg.sender === currentUser ? 'items-end' : 'items-start'
                  }`}
                >
                  {msg.sender !== currentUser && !selectedUser && (
                    <span className="text-xs font-semibold text-slate-600 px-3">
                      {msg.sender}
                    </span>
                  )}
                  <div
                    className={`px-4 py-2.5 rounded-2xl text-sm ${
                      msg.sender === currentUser
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-900 rounded-bl-sm'
                    }`}
                  >
                    <p>{msg.content}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 lg:p-6 bg-white border-t border-slate-200">
          {error && (
            <div className="mb-3 p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-red-700 text-sm font-medium">{error}</p>
              <p className="text-red-600 text-xs mt-1">
                Ensure backend is running at: <code className="bg-red-100 px-2 py-1 rounded">http://localhost:8080</code>
              </p>
              <button
                onClick={() => {
                  const token = localStorage.getItem('token');
                  if (token) {
                    connectToChat(token);
                  }
                }}
                className="mt-2 text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}
          <div className="bg-slate-100 rounded-xl px-4 py-2 flex items-center gap-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500/30 transition-shadow">
            <input
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 placeholder:text-slate-400 py-2"
            />
            <button
              onClick={handleSendMessage}
              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <span className="text-xl">✈️</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


