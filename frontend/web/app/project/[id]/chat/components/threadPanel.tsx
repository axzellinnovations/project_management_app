import React, { useMemo, useState } from 'react';
import { ChatMessage, ChatReactionSummary } from './chat';

interface ThreadPanelProps {
  rootMessage: ChatMessage | null;
  threadMessages: ChatMessage[];
  reactionsByMessageId: Record<number, ChatReactionSummary[]>;
  onClose: () => void;
  onSendReply: (content: string) => void;
  onToggleReaction: (messageId: number, emoji: string) => void;
}

const DEFAULT_REACTIONS = ['👍', '🔥', '✅', '🎉'];

export const ThreadPanel = ({
  rootMessage,
  threadMessages,
  reactionsByMessageId,
  onClose,
  onSendReply,
  onToggleReaction
}: ThreadPanelProps) => {
  const [replyInput, setReplyInput] = useState('');

  const orderedMessages = useMemo(() => {
    if (!rootMessage) {
      return [] as ChatMessage[];
    }

    const root = threadMessages.find(message => message.id === rootMessage.id) || rootMessage;
    const replies = threadMessages.filter(message => message.id !== root.id);
    return [root, ...replies];
  }, [rootMessage, threadMessages]);

  if (!rootMessage) {
    return null;
  }

  return (
    <aside className="w-[360px] border-l border-slate-200 bg-slate-50 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Thread</h4>
          <p className="text-xs text-slate-500">{Math.max(orderedMessages.length - 1, 0)} replies</p>
        </div>
        <button
          onClick={onClose}
          className="text-xs font-medium px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {orderedMessages.map((message, index) => {
          const messageReactions = message.id ? (reactionsByMessageId[message.id] || []) : [];

          return (
            <div key={`${message.id || 'tmp'}-${index}`} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700">{message.sender}</p>
                {message.timestamp && (
                  <p className="text-[11px] text-slate-400">{new Date(message.timestamp).toLocaleTimeString()}</p>
                )}
              </div>

              <p className={`text-sm mt-1 ${message.deleted ? 'text-slate-400 italic' : 'text-slate-900'}`}>
                {message.content}
              </p>

              {message.editedAt && !message.deleted && (
                <p className="text-[11px] text-slate-400 mt-1">edited</p>
              )}

              {!!message.id && (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {messageReactions.map(reaction => (
                    <button
                      key={`${message.id}-${reaction.emoji}`}
                      onClick={() => onToggleReaction(message.id as number, reaction.emoji)}
                      className={`text-xs px-2 py-0.5 rounded-full border ${reaction.reactedByCurrentUser ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-700'}`}
                    >
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                  {DEFAULT_REACTIONS.map(emoji => (
                    <button
                      key={`${message.id}-pick-${emoji}`}
                      onClick={() => onToggleReaction(message.id as number, emoji)}
                      className="text-xs px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-slate-200 bg-white">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Reply in thread..."
            value={replyInput}
            onChange={(event) => setReplyInput(event.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }

              const value = replyInput.trim();
              if (!value) {
                return;
              }

              onSendReply(value);
              setReplyInput('');
            }}
          />
          <button
            onClick={() => {
              const value = replyInput.trim();
              if (!value) {
                return;
              }
              onSendReply(value);
              setReplyInput('');
            }}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
          >
            Send
          </button>
        </div>
      </div>
    </aside>
  );
};
