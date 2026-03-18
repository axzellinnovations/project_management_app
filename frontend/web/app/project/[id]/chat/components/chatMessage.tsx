'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, MessageSquare, Pin, PinOff, FileText, Loader2, SmilePlus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChatMessage, ChatReactionSummary } from './chat';
import { EditMessageModal, ConfirmDeleteModal } from './chatModals';
import api from '@/lib/axios';

interface ChatMessagesProps {
  projectId: string;
  messages: ChatMessage[];
  currentUser: string;
  currentUserAliases: string[];
  userProfilePics?: Record<string, string>;
  activeRoomId?: number | null;
  pinnedMessageId?: number | null;
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onOpenThread: (message: ChatMessage) => void;
  onEditMessage: (messageId: number, content: string) => void;
  onDeleteMessage: (messageId: number) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
  onPinRoomMessage?: (messageId: number | null) => void;
  typingUser?: string;
}

export const isFileDocument = (content: string) => {
  try {
    const url = new URL(content);
    const isS3Domain = url.hostname.includes('s3') && url.hostname.includes('amazonaws.com');
    const hasS3Signature = url.searchParams.has('X-Amz-Signature') && url.searchParams.has('X-Amz-Credential');
    return isS3Domain || hasS3Signature;
  } catch {
    return false;
  }
};

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '✅', '😂', '🎉'];

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

function formatDateSeparator(timestamp?: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
}

function shouldShowDateSeparator(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return true;
  const currentDate = new Date(current.timestamp || '').toDateString();
  const prevDate = new Date(previous.timestamp || '').toDateString();
  return currentDate !== prevDate;
}

function isGrouped(current: ChatMessage, previous?: ChatMessage): boolean {
  if (!previous) return false;
  if (current.sender !== previous.sender) return false;
  const diff = new Date(current.timestamp || '').getTime() - new Date(previous.timestamp || '').getTime();
  return diff < 120000; // 2 minutes
}

function TypingIndicator({ user, userProfilePics = {} }: { user: string; userProfilePics?: Record<string, string> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-end gap-2.5 px-4 py-1"
    >
      {userProfilePics?.[user] ? (
        <img src={userProfilePics[user]} alt={user} className="w-7 h-7 rounded-full object-cover shadow-sm flex-shrink-0" />
      ) : (
        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(user)} flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}>
          {user.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400 inline-block"
            style={{ animation: `typingBounce 1.4s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </motion.div>
  );
}

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
  onPinRoomMessage,
  typingUser,
  userProfilePics = {},
}: ChatMessagesProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [loadingFileId, setLoadingFileId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<number | null>(null);

  const handleDocumentClick = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    originalUrl: string,
    messageId?: number
  ) => {
    e.preventDefault();
    if (!messageId) { window.open(originalUrl, '_blank'); return; }
    setLoadingFileId(messageId);
    try {
      const response = await api.get(`/api/projects/${projectId}/chat/messages/refresh-document`, {
        params: { url: originalUrl },
      });
      window.open(response.data, '_blank');
    } catch {
      window.open(originalUrl, '_blank');
    } finally {
      setLoadingFileId(null);
    }
  };

  const aliasSet = new Set([
    currentUser.toLowerCase(),
    ...currentUserAliases.map((a) => a.toLowerCase()),
  ]);

  const visibleMessages = messages.filter((msg) => msg.type !== 'JOIN');

  if (visibleMessages.length === 0 && !typingUser) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
          <span className="text-3xl">💬</span>
        </div>
        <h3 className="text-[15px] font-semibold text-gray-800 mb-1">No messages yet</h3>
        <p className="text-[13px] text-gray-400">Be the first to say hello!</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5 scroll-smooth">
      <AnimatePresence initial={false}>
        {visibleMessages.map((msg, idx) => {
          const prevMsg = idx > 0 ? visibleMessages[idx - 1] : undefined;
          const isMe = aliasSet.has((msg.sender || '').toLowerCase());
          const grouped = isGrouped(msg, prevMsg);
          const showSeparator = shouldShowDateSeparator(msg, prevMsg);
          const msgReactions = msg.id ? (reactionsByMessageId[msg.id] || []) : [];
          const isPinned = pinnedMessageId === msg.id;
          const fileDoc = !msg.deleted && isFileDocument(msg.content);
          const isLoadingFile = loadingFileId === msg.id;

          return (
            <React.Fragment key={msg.id ?? idx}>
              {/* Date separator */}
              {showSeparator && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-[11px] font-semibold text-gray-400 bg-white px-3 py-1 rounded-full border border-gray-100">
                    {formatDateSeparator(msg.timestamp)}
                  </span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`flex items-end gap-2.5 group relative ${grouped ? 'mt-0.5' : 'mt-3'} ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* Avatar */}
                {!isMe && (
                  <div className={`relative flex-shrink-0 ${grouped ? 'opacity-0' : 'opacity-100'}`}>
                    {userProfilePics?.[msg.sender] ? (
                      <img src={userProfilePics[msg.sender]} alt={msg.sender} className="w-7 h-7 rounded-full object-cover shadow-sm" />
                    ) : (
                      <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${avatarColor(msg.sender || '')} flex items-center justify-center text-white text-xs font-bold`}>
                        {(msg.sender || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                )}

                {/* Bubble column */}
                <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Sender name (others, no group) */}
                  {!isMe && !grouped && (
                    <span className="text-[11.5px] font-semibold text-gray-500 mb-1 ml-1">{msg.sender}</span>
                  )}

                  {/* Pinned badge */}
                  {isPinned && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5 mb-1.5 flex items-center gap-1">
                      📌 Pinned
                    </span>
                  )}

                  {/* Bubble + action bar wrapper */}
                  <div className="relative">
                    {/* Hover action bar */}
                    {!!msg.id && (
                      <div className={`absolute bottom-full mb-1 ${isMe ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 transition-opacity z-10 flex items-center gap-1 bg-white border border-gray-100 shadow-lg rounded-xl px-2 py-1.5`}>
                        {/* Quick reactions */}
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => onToggleReaction(msg.id as number, emoji)}
                            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-sm transition-all hover:scale-110 active:scale-95"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}

                        <div className="w-px h-4 bg-gray-200 mx-0.5" />

                        {/* Thread */}
                        <button
                          onClick={() => onOpenThread(msg)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 text-[11px] font-medium transition-colors"
                          title="Reply in thread"
                        >
                          <MessageSquare size={12} strokeWidth={2} />
                        </button>

                        {/* Pin/Unpin */}
                        {!!activeRoomId && onPinRoomMessage && (
                          <button
                            onClick={() => onPinRoomMessage(isPinned ? null : (msg.id as number))}
                            className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title={isPinned ? 'Unpin' : 'Pin message'}
                          >
                            {isPinned ? <PinOff size={12} strokeWidth={2} /> : <Pin size={12} strokeWidth={2} />}
                          </button>
                        )}

                        {/* Edit / Delete own */}
                        {isMe && !msg.deleted && (
                          <>
                            {!fileDoc && (
                              <button
                                onClick={() => setEditingMessage(msg)}
                                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                                title="Edit"
                              >
                                <Pencil size={12} strokeWidth={2} />
                              </button>
                            )}
                            <button
                              onClick={() => setMessageToDelete(msg.id as number)}
                              className="w-7 h-7 rounded-lg hover:bg-red-50 hover:text-red-500 flex items-center justify-center text-gray-500 transition-colors"
                              title="Delete message"
                            >
                              <Trash2 size={12} strokeWidth={2} />
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`
                      relative px-4 py-2.5 text-[13.5px] leading-relaxed shadow-sm
                      ${msg.deleted
                        ? 'bg-gray-100 text-gray-400 italic rounded-2xl'
                        : isMe
                          ? 'bg-blue-500 text-white rounded-2xl rounded-br-sm'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-sm'
                      }
                    `}>
                      {msg.deleted ? (
                        <span>This message was deleted</span>
                      ) : fileDoc ? (
                        <a
                          href={msg.content}
                          onClick={(e) => handleDocumentClick(e, msg.content, msg.id as number)}
                          className={`flex items-center gap-2 font-medium ${isMe ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-700'}`}
                          aria-label={isLoadingFile ? 'Opening file…' : 'View File'}
                        >
                          {isLoadingFile
                            ? <Loader2 size={15} className="animate-spin" />
                            : <FileText size={15} />}
                          <span className="truncate max-w-[180px]">
                            {isLoadingFile ? 'Opening…' : 'View File'}
                          </span>
                        </a>
                      ) : (
                        <span className="break-words whitespace-pre-wrap">{msg.content}</span>
                      )}
                    </div>
                  </div>

                  {/* Reactions row */}
                  {!!msg.id && !msg.deleted && msgReactions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {msgReactions.map((reaction) => (
                        <button
                          key={`${msg.id}-${reaction.emoji}`}
                          onClick={() => onToggleReaction(msg.id as number, reaction.emoji)}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] font-medium border transition-all
                            ${reaction.reactedByCurrentUser
                              ? 'bg-blue-50 border-blue-200 text-blue-700'
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Meta: time + edited */}
                  <div className={`flex items-center gap-1.5 mt-0.5 px-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!msg.deleted && msg.editedAt && (
                      <span className="text-[10px] text-gray-400 italic">edited</span>
                    )}
                    {msg.timestamp && (
                      <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
      </AnimatePresence>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUser && <TypingIndicator key="typing" user={typingUser} userProfilePics={userProfilePics} />}
      </AnimatePresence>

      {/* Modals */}
      <EditMessageModal
        isOpen={editingMessage !== null}
        onClose={() => setEditingMessage(null)}
        initialContent={editingMessage?.content || ''}
        onSave={(newContent) => {
          if (editingMessage?.id) {
            onEditMessage(editingMessage.id, newContent);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={messageToDelete !== null}
        onClose={() => setMessageToDelete(null)}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action is permanent and cannot be undone."
        onConfirm={() => {
          if (messageToDelete) onDeleteMessage(messageToDelete);
          setMessageToDelete(null);
        }}
      />
    </div>
  );
};