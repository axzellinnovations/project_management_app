import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './chat';
import styles from '../chat.module.css';

interface ChatMessagesProps {
  messages: ChatMessage[];
  currentUser: string;
}

export const ChatMessages = ({ messages, currentUser }: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={styles.chatBox}>
        <div className="flex h-full items-center justify-center text-slate-400">No messages yet. Start the conversation!</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className={styles.chatBox}>
      {messages.filter(msg => msg.type !== 'JOIN').map((msg, idx) => {
        const isMe = msg.sender === currentUser;
        return (
          <div key={idx} className={`flex gap-3 ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                {msg.sender.charAt(0).toUpperCase()}
              </div>
            )}
            
            <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && <span className="text-xs text-slate-500 ml-1 mb-1">{msg.sender}</span>}
                <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm ${
                    isMe 
                    ? 'bg-blue-600 text-white rounded-br-sm' 
                    : 'bg-white text-slate-900 border border-slate-200 rounded-bl-sm'
                }`}>
                    {msg.content}
                </div>
                {msg.timestamp && (
                  <span className="text-[10px] text-slate-400 mt-0.5 self-end">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
};