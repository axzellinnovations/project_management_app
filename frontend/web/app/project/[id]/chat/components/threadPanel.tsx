'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { X, Send } from 'lucide-react';
import { ChatMessage, ChatReactionSummary } from './chat';
import { isFileDocument } from './chatMessage';

interface ThreadPanelProps {
  rootMessage: ChatMessage | null;
  threadMessages: ChatMessage[];
  userProfilePics?: Record<string, string>;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onClose: () => void;
  onSendReply: (content: string) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
}

const DEFAULT_REACTIONS = ['👍', '🔥', '✅', '🎉'];

const AVATAR_COLORS = [
  'from-violet-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-blue-500 to-indigo-600',
  'from-orange-500 to-red-600',
  'from-purple-500 to-violet-700',
  'from-cyan-500 to-blue-600',
  'from-amber-500 to-orange-600',
];

const avatarColor = (name: string) =>
  AVATAR_COLORS[(name.charCodeAt(0) % AVATAR_COLORS.length)];

function formatTime(timestamp?: string | null): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const ThreadPanel = ({
  rootMessage,
  threadMessages,
  userProfilePics = {},
  reactionsByMessageId,
  onClose,
  onSendReply,
  onToggleReaction,
}: ThreadPanelProps) => {
  const [replyInput, setReplyInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const orderedMessages = useMemo(() => {
    if (!rootMessage) return [] as ChatMessage[];
    const root = threadMessages.find((m) => m.id === rootMessage.id) || rootMessage;
    const replies = threadMessages.filter((m) => m.id !== root.id);
    return [root, ...replies];
  }, [rootMessage, threadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [threadMessages]);

  if (!rootMessage) return null;

  const handleSend = () => {
    const value = replyInput.trim();
    if (!value) return;
    onSendReply(value);
    setReplyInput('');
  };

  return (
    <aside className="w-full h-full bg-white border-l border-gray-100 flex flex-col shadow-sm">
      {/* ── Header ── */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-100 flex-shrink-0 bg-gray-50/50">
        <div>
          <h4 className="text-[14.5px] font-bold text-gray-900 flex items-center gap-2 tracking-tight">
            <span>🧵</span> Thread
          </h4>
          <p className="text-[12px] text-gray-500 font-medium">
            {Math.max(orderedMessages.length - 1, 0)} repl{orderedMessages.length === 2 ? 'y' : 'ies'}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors"
          aria-label="Close thread panel"
          title="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 space-y-5 scrollbar-thin">
        {orderedMessages.map((message, index) => {
          const isRoot = index === 0;
          const messageReactions = message.id ? (reactionsByMessageId[message.id] || []) : [];
          const isFile = !message.deleted && isFileDocument(message.content);

          return (
            <div key={`${message.id || 'tmp'}-${index}`}>
              {/* Root Separator showing chronological split */}
              {!isRoot && index === 1 && (
                <div className="flex items-center gap-3 mb-5 mt-2">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-semibold text-gray-400 bg-white px-3 py-0.5 rounded-full border border-gray-100">
                    Replies
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}

              <div className={`flex gap-3 group ${isRoot ? 'mb-2' : ''}`}>
                {userProfilePics?.[message.sender] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={userProfilePics[message.sender]} alt={message.sender} className="w-8 h-8 rounded-full object-cover shadow-sm flex-shrink-0" />
                ) : (
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarColor(message.sender || '')} flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0`}>
                    {(message.sender || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[12.5px] font-bold text-gray-900">{message.sender}</span>
                    {message.timestamp && (
                      <span className="text-[10.5px] text-gray-400">
                        {formatTime(message.timestamp)}
                      </span>
                    )}
                  </div>

                  <div className="text-[13.5px] leading-relaxed text-gray-700 font-medium">
                    {message.deleted ? (
                      <span className="text-gray-400 italic">This message was deleted</span>
                    ) : isFile ? (
                      <a href={message.content} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700 flex items-center gap-1.5 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 inline-flex mt-1">
                        <span className="truncate max-w-[180px]">View Attachment</span>
                      </a>
                    ) : (
                      <span className="break-words whitespace-pre-wrap">{message.content}</span>
                    )}
                  </div>
                  
                  {message.editedAt && !message.deleted && (
                    <span className="text-[10px] text-gray-400 italic mt-1 block">edited</span>
                  )}

                  {!!message.id && !message.deleted && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {messageReactions.map((reaction) => (
                        <button
                          key={`${message.id}-${reaction.emoji}`}
                          onClick={() => onToggleReaction(message.id as number, reaction.emoji)}
                          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[12px] font-medium border transition-all
                            ${reaction.reactedByCurrentUser
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                      {/* Active hover area for quick reactions */}
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                        {DEFAULT_REACTIONS.map((emoji) => (
                          <button
                            key={`${message.id}-pick-${emoji}`}
                            onClick={() => onToggleReaction(message.id as number, emoji)}
                            className="bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-full px-1.5 py-0.5 text-[12px] transition-transform hover:scale-110"
                            aria-label={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Reply input ── */}
      <div className="p-3 bg-white border-t border-gray-100">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 focus-within:bg-white focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50 transition-all">
          <input
            type="text"
            placeholder="Reply in thread…"
            value={replyInput}
            onChange={(e) => setReplyInput(e.target.value)}
            className="flex-1 bg-transparent px-2 py-1 text-[13px] text-gray-900 placeholder:text-gray-400 outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
          />
          <button
            onClick={handleSend}
            disabled={!replyInput.trim()}
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
              ${replyInput.trim() 
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            <Send size={14} strokeWidth={2.5} style={{ marginLeft: 2 }} />
          </button>
        </div>
      </div>
    </aside>
  );
};
