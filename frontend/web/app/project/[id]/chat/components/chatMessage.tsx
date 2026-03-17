import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, ChatReactionSummary } from './chat';
import api from '@/lib/axios';
import styles from '../chat.module.css';

interface ChatMessagesProps {
  projectId: string;
  messages: ChatMessage[];
  currentUser: string;
  currentUserAliases: string[];
  activeRoomId?: number | null;
  pinnedMessageId?: number | null;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onOpenThread: (message: ChatMessage) => void;
  onEditMessage: (messageId: number, content: string) => void;
  onDeleteMessage: (messageId: number) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onPinRoomMessage?: (messageId: number | null) => void;
}

export const isFileDocument = (content: string) => {
  try {
    const url = new URL(content);
    // Common S3 URL patterns (both path-style and virtual-hosted style)
    const isS3Domain = url.hostname.includes('s3') && url.hostname.includes('amazonaws.com');
    // Common pre-signed URL query parameters
    const hasS3Signature = url.searchParams.has('X-Amz-Signature') && url.searchParams.has('X-Amz-Credential');
    
    return isS3Domain || hasS3Signature;
  } catch (e) {
    // Not a valid URL
    return false;
  }
};

const QUICK_REACTIONS = ['👍', '🔥', '✅', '🎉'];

export const ChatMessages = ({
  projectId,
  messages,
  currentUser,
  currentUserAliases,
  activeRoomId,
  pinnedMessageId,
  reactionsByMessageId,
  onOpenThread,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
  onPinRoomMessage
}: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);

  const handleDocumentClick = async (e: React.MouseEvent<HTMLAnchorElement>, originalUrl: string, messageId?: number) => {
    e.preventDefault();
    if (!messageId) {
        window.open(originalUrl, '_blank');
        return;
    }
    
    setLoadingFileId(messageId);
    try {
      const response = await api.get(`/api/projects/${projectId}/chat/messages/refresh-document`, {
        params: { url: originalUrl }
      });
      window.open(response.data, '_blank');
    } catch (err) {
      console.error('Failed to refresh document URL', err);
      // Fallback to original
      window.open(originalUrl, '_blank');
    } finally {
      setLoadingFileId(null);
    }
  };

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
        const sender = msg.sender?.toLowerCase() || '';
        const aliasSet = new Set([currentUser.toLowerCase(), ...currentUserAliases.map(alias => alias.toLowerCase())]);
        const isMe = aliasSet.has(sender);
        const msgReactions = msg.id ? (reactionsByMessageId[msg.id] || []) : [];
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
                      {msg.deleted ? (
                        <em>[message deleted]</em>
                      ) :
                        isFileDocument(msg.content) ? (
                          <a
                            href={msg.content}
                            onClick={(e) => handleDocumentClick(e, msg.content, msg.id as number)}
                            className={`flex items-center gap-2 text-blue-700 hover:underline ${loadingFileId === msg.id ? 'opacity-50 cursor-wait' : ''}`}
                            style={{ minWidth: '120px', maxWidth: '100%', overflowWrap: 'break-word' }}
                          >
                            <span role="img" aria-label="file" className="text-lg">📄</span>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px', display: 'inline-block' }}>
                                {loadingFileId === msg.id ? 'Loading...' : 'View File'}
                            </span>
                          </a>
                        ) : (
                          <span style={{ wordBreak: 'break-word', maxWidth: '250px', display: 'inline-block' }}>{msg.content}</span>
                        )
                      }
                </div>
                {!msg.deleted && msg.editedAt && (
                  <span className="text-[10px] text-slate-400 mt-0.5">edited</span>
                )}
                {!!msg.id && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {msgReactions.map(reaction => (
                      <button
                        key={`${msg.id}-${reaction.emoji}`}
                        onClick={() => onToggleReaction(msg.id as number, reaction.emoji)}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${reaction.reactedByCurrentUser ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
                      >
                        {reaction.emoji} {reaction.count}
                      </button>
                    ))}
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={`${msg.id}-quick-${emoji}`}
                        onClick={() => onToggleReaction(msg.id as number, emoji)}
                        className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex items-center gap-2">
                  {!!msg.id && (
                    <button
                      onClick={() => onOpenThread(msg)}
                      className="text-[11px] text-slate-500 hover:text-slate-700"
                    >
                      Thread
                    </button>
                  )}
                  {!!activeRoomId && !!msg.id && onPinRoomMessage && (
                    <button
                      onClick={() => onPinRoomMessage(pinnedMessageId === msg.id ? null : (msg.id as number))}
                      className="text-[11px] text-amber-600 hover:text-amber-700"
                    >
                      {pinnedMessageId === msg.id ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {isMe && !!msg.id && !msg.deleted && (
                    <>
                      <button
                        onClick={() => {
                          const updated = window.prompt('Edit message', msg.content);
                          if (updated !== null) {
                            onEditMessage(msg.id as number, updated);
                          }
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDeleteMessage(msg.id as number)}
                        className="text-[11px] text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </>
                  )}
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