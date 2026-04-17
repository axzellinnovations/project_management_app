'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import MotionWrapper from './MotionWrapper';
import { useChat } from '@/hooks/chat/useChat';
import { ChatMessage } from '@/app/(project)/project/[id]/chat/components/chat';

export function ProjectChatWidget({ projectId }: { projectId: number | string }) {
  const { messages, sendMessage, currentUser } = useChat(projectId.toString());
  const [inputValue, setInputValue] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat without scrolling the whole page
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  return (
    <MotionWrapper className="bg-white rounded-xl border border-[#E3E8EF] flex flex-col h-[400px] shadow-sm hover:shadow-md transition-all duration-200">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
         <h2 className="font-arimo text-[16px] font-semibold text-[#101828] flex items-center gap-2">
            <MessageSquare size={16} className="text-[#0052CC]" />
            Team Chat
         </h2>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]" ref={scrollContainerRef}>
         {messages && messages.length > 0 ? messages.slice(-50).map((msg: ChatMessage, i: number) => {
           const isMe = msg.sender === currentUser;
           return (
             <div key={msg.id || i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
               {!isMe && <span className="text-[10px] font-semibold text-gray-500 mb-1 ml-1">{msg.sender}</span>}
               <div className={`px-3 py-2 text-[13px] font-arimo break-words ${isMe ? 'bg-[#0052CC] text-white rounded-2xl rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm'}`} style={{ maxWidth: '85%' }}>
                 {msg.content}
               </div>
             </div>
           )
         }) : (
           <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
             <MessageSquare size={24} className="mb-2 opacity-30 text-gray-400" />
             <p className="font-arimo text-[13px]">No team messages yet</p>
           </div>
         )}
      </div>

      <div className="p-3 border-t border-gray-100 bg-white rounded-b-xl shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2 relative">
           <input 
             type="text" 
             value={inputValue}
             onChange={e => setInputValue(e.target.value)}
             placeholder="Type a message to team..."
             className="w-full text-[13px] font-arimo rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 pr-10 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all"
           />
           <button 
             type="submit" 
             disabled={!inputValue.trim()}
             className="absolute right-1 p-1.5 rounded-md text-[#0052CC] hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
           >
             <Send size={15} />
           </button>
        </form>
      </div>
    </MotionWrapper>
  )
}
