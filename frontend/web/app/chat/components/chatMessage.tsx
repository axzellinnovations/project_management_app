import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './chat';

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
      <div className="flex-1 flex items-center justify-center text-slate-400">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
      {messages.map((msg, idx) => {
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
            </div>
          </div>
        );
      })}
    </div>
  );
};