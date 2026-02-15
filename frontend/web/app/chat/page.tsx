'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SockJS from 'sockjs-client';
import { Stomp, CompatClient } from '@stomp/stompjs';
import styles from './chat.module.css';

interface ChatMessage {
    sender: string;
    recipient?: string;
    content?: string;
    type: 'CHAT' | 'JOIN' | 'LEAVE';
}

export default function ChatPage() {
    const router = useRouter();
    const [username, setUsername] = useState<string>('');
    const [jwtToken, setJwtToken] = useState<string>('');
    const [isJoined, setIsJoined] = useState<boolean>(false);
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>('');

    // selectedChat: 'public' or the username of the private chat
    const [selectedChat, setSelectedChat] = useState<string>('public');

    // Public messages
    const [publicMessages, setPublicMessages] = useState<ChatMessage[]>([]);
    // Private messages map: User -> Messages
    const [privateMessages, setPrivateMessages] = useState<Record<string, ChatMessage[]>>({});

    // List of users we have active chats with/known users
    const [knownUsers, setKnownUsers] = useState<string[]>([]);

    const stompClientRef = useRef<CompatClient | null>(null);

    // Check authentication on mount
    useEffect(() => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        
        if (!token) {
            router.push('/login');
            return;
        }

        // Extract username from token (JWT payload)
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            // Prefer username claim, fallback to email/subject
            const extractedUsername = payload.username || payload.sub || payload.email || 'User';
            setUsername(extractedUsername);
            setJwtToken(token);
            setIsLoading(false);
        } catch (err) {
            console.error('Invalid token format:', err);
            router.push('/login');
        }
    }, [router]);

    // Cleanup on component unmount
    useEffect(() => {
        return () => {
            if (stompClientRef.current && stompClientRef.current.connected) {
                stompClientRef.current.disconnect(() => {});
            }
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        if (stompClientRef.current) {
            stompClientRef.current.disconnect(() => {
                router.push('/login');
            });
        } else {
            router.push('/login');
        }
    };

    const connect = (event: FormEvent) => {
        event.preventDefault();
        if (!jwtToken.trim()) {
            setError('Please login first');
            return;
        }

        const socket = new SockJS('http://localhost:8080/ws');
        stompClientRef.current = Stomp.over(socket);

        // disable debug logging to console
        stompClientRef.current.debug = () => { };

        // Send JWT token in Authorization header for WebSocket connection
        stompClientRef.current.connect(
            { 'Authorization': `Bearer ${jwtToken}` },
            onConnected,
            onError
        );
    };

    const onConnected = () => {
        setIsJoined(true);
        if (stompClientRef.current) {
            // Subscribe to Public Topic
            stompClientRef.current.subscribe('/topic/public', onPublicMessageReceived);

            // Subscribe to Private User Queue
            stompClientRef.current.subscribe('/user/queue/messages', onPrivateMessageReceived);

            // Tell the server that a new user has joined
            stompClientRef.current.send("/app/chat.addUser",
                {},
                JSON.stringify({ sender: username, type: 'JOIN' })
            );
        }
    };

    const onError = (error: { headers: Record<string, string> } | undefined) => {
        console.error('Connection error', error);
        setError('Could not connect to WebSocket server. Please check if backend is running.');
        setIsJoined(false);
    };

    const onPublicMessageReceived = (payload: { body: string }) => {
        const msg: ChatMessage = JSON.parse(payload.body);
        setPublicMessages((prev: ChatMessage[]) => [...prev, msg]);

        if (msg.type === 'JOIN' && msg.sender && msg.sender.toLowerCase() !== username.toLowerCase()) {
            setKnownUsers((prev: string[]) => 
                prev.includes(msg.sender.toLowerCase()) 
                    ? prev 
                    : [...prev, msg.sender.toLowerCase()]
            );
        }
    };

    const onPrivateMessageReceived = (payload: { body: string }) => {
        const msg: ChatMessage = JSON.parse(payload.body);

        // Determine the peer (the other person in the chat)
        const peer = msg.sender === username ? msg.recipient : msg.sender;

        if (peer) {
            const normalizedPeer = peer.toLowerCase();
            setPrivateMessages((prev: Record<string, ChatMessage[]>) => {
                const newMap = { ...prev };
                const list = newMap[normalizedPeer] || [];
                newMap[normalizedPeer] = [...list, msg];
                return newMap;
            });
            // Ensure peer is in known users (so it shows in sidebar)
            setKnownUsers((prev: string[]) =>
                prev.includes(normalizedPeer)
                    ? prev
                    : [...prev, normalizedPeer]
            );
        }
    };

    const sendMessage = () => {
        if (stompClientRef.current && message.trim()) {
            if (selectedChat === 'public') {
                const chatMessage: ChatMessage = {
                    sender: username,
                    content: message,
                    type: 'CHAT'
                };
                stompClientRef.current.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
            } else {
                // Private Message
                const chatMessage: ChatMessage = {
                    sender: username,
                    recipient: selectedChat,
                    content: message,
                    type: 'CHAT'
                };
                stompClientRef.current.send("/app/chat.sendPrivateMessage", {}, JSON.stringify(chatMessage));

                // Add to our own view of private messages
                setPrivateMessages((prev: Record<string, ChatMessage[]>) => {
                    const newMap = { ...prev };
                    const list = newMap[selectedChat] || [];
                    newMap[selectedChat] = [...list, chatMessage];
                    return newMap;
                });
            }
            setMessage('');
        }
    };

    const startNewChat = () => {
        const peer = prompt("Enter username to chat with:");
        if (peer && peer.trim().toLowerCase() !== username.toLowerCase()) {
            const normalizedPeer = peer.trim().toLowerCase();
            setKnownUsers((prev: string[]) =>
                prev.includes(normalizedPeer)
                    ? prev
                    : [...prev, normalizedPeer]
            );
            setSelectedChat(normalizedPeer);
        }
    };

    return (
        <main className={styles.main}>
            {isLoading ? (
                <div className={styles.container} style={{ height: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ color: '#666' }}>Loading chat...</p>
                </div>
            ) : !isJoined ? (
                <div className={styles.container} style={{ height: 'auto', display: 'block' }}>
                    <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Join Chat</h2>
                    {error && (
                        <div style={{
                            textAlign: 'center',
                            color: '#d32f2f',
                            marginBottom: '15px',
                            padding: '10px',
                            backgroundColor: '#ffebee',
                            borderRadius: '4px'
                        }}>
                            {error}
                        </div>
                    )}
                    <form onSubmit={connect} className={styles.joinForm} style={{ margin: '0 auto', maxWidth: '300px' }}>
                        <p style={{ textAlign: 'center', marginBottom: '20px' }}>Welcome, <strong>{username}</strong>!</p>
                        <button type="submit" className={styles.button}>
                            Enter Chat
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className={styles.button}
                            style={{ marginTop: '10px', backgroundColor: '#dc3545' }}
                        >
                            Logout
                        </button>
                    </form>
                </div>
            ) : (
                <div className={styles.container}>
                    {/* Sidebar */}
                    <div className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <span>Chats</span>
                            <button onClick={startNewChat} style={{ background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', fontSize: '1.5rem', lineHeight: '1' }}>+</button>
                        </div>
                        <ul className={styles.userList}>
                            <li
                                className={`${styles.userItem} ${selectedChat === 'public' ? styles.active : ''}`}
                                onClick={() => setSelectedChat('public')}
                            >
                                <div className={styles.userAvatar} style={{ backgroundColor: '#28a745', color: '#fff' }}>P</div>
                                Public Chat
                            </li>
                            {knownUsers.map((user: string) => (
                                <li
                                    key={user}
                                    className={`${styles.userItem} ${selectedChat === user ? styles.active : ''}`}
                                    onClick={() => setSelectedChat(user)}
                                >
                                    <div className={styles.userAvatar}>{user.charAt(0).toUpperCase()}</div>
                                    {user}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Chat Area */}
                    <div className={styles.chatArea}>
                        <div className={styles.chatHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                {selectedChat === 'public' ? 'Public Chat' : `Chat with ${selectedChat}`}
                                {selectedChat !== 'public' && (
                                    <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>Private</span>
                                )}
                            </div>
                            <button
                                onClick={handleLogout}
                                style={{
                                    background: '#dc3545',
                                    color: 'white',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '0.9rem'
                                }}
                            >
                                Logout
                            </button>
                        </div>
                        <div className={styles.chatBox} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {selectedChat === 'public' ? (
                                publicMessages.map((msg: ChatMessage, index: number) => (
                                    <div key={index} style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        alignSelf: msg.sender === username ? 'flex-end' : 'flex-start',
                                        backgroundColor: msg.sender === username ? '#007bff' : '#e9ecef',
                                        color: msg.sender === username ? 'white' : 'black',
                                        maxWidth: '70%',
                                        width: 'fit-content'
                                    }}>
                                        {msg.type === 'JOIN' || msg.type === 'LEAVE' ? (
                                            <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic', fontSize: '0.8rem', width: '100%' }}>
                                                {msg.sender} {msg.type === 'JOIN' ? 'joined' : 'left'}
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '2px', color: msg.sender === username ? '#e3f2fd' : '#555' }}>
                                                    {msg.sender}
                                                </div>
                                                <div>{msg.content}</div>
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                (privateMessages[selectedChat] || []).map((msg: ChatMessage, index: number) => (
                                    <div key={index} style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        alignSelf: msg.sender === username ? 'flex-end' : 'flex-start',
                                        backgroundColor: msg.sender === username ? '#007bff' : '#e9ecef',
                                        color: msg.sender === username ? 'white' : 'black',
                                        maxWidth: '70%',
                                        width: 'fit-content'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '2px', color: msg.sender === username ? '#e3f2fd' : '#555' }}>
                                            {msg.sender}
                                        </div>
                                        <div>{msg.content}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className={styles.inputArea}>
                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                className={styles.input}
                            />
                            <button onClick={sendMessage} className={styles.button}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}


