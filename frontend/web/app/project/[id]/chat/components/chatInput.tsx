import React, { useMemo, useState } from 'react';
import styles from '../chat.module.css';

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  onTypingChange?: (isTyping: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  enableMentions?: boolean;
  mentionCandidates?: string[];
}

export const ChatInput = ({
  onSendMessage,
  onTypingChange,
  disabled,
  placeholder,
  enableMentions,
  mentionCandidates = []
}: ChatInputProps) => {
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);

  const filteredMentionCandidates = useMemo(() => {
    if (!enableMentions || !showMentionList) {
      return [] as string[];
    }

    const normalizedQuery = mentionQuery.trim().toLowerCase();
    return mentionCandidates
      .filter(name => !!name)
      .filter(name => normalizedQuery.length === 0 || name.toLowerCase().includes(normalizedQuery))
      .slice(0, 6);
  }, [enableMentions, mentionCandidates, mentionQuery, showMentionList]);

  const updateMentionState = (value: string, caretIndex: number) => {
    if (!enableMentions) {
      setMentionQuery('');
      setShowMentionList(false);
      return;
    }

    const prefix = value.slice(0, caretIndex);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) {
      setMentionQuery('');
      setShowMentionList(false);
      return;
    }

    setMentionQuery(match[2] || '');
    setShowMentionList(true);
  };

  const applyMention = (memberName: string) => {
    const caret = input.length;
    const prefix = input.slice(0, caret);
    const suffix = input.slice(caret);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);

    if (!match) {
      return;
    }

    const leading = match[1] || '';
    const mentionStart = prefix.length - match[0].length + leading.length;
    const nextValue = `${prefix.slice(0, mentionStart)}@${memberName} ${suffix}`;
    setInput(nextValue);
    setMentionQuery('');
    setShowMentionList(false);
    onTypingChange?.(nextValue.trim().length > 0);
  };

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
      setMentionQuery('');
      setShowMentionList(false);
      onTypingChange?.(false);
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className="flex gap-2 w-full relative">
        <input
          type="text"
          value={input}
          onChange={(e) => {
            const nextValue = e.target.value;
            setInput(nextValue);
            updateMentionState(nextValue, e.target.selectionStart ?? nextValue.length);
            onTypingChange?.(nextValue.trim().length > 0);
          }}
          onClick={(e) => {
            const target = e.target as HTMLInputElement;
            updateMentionState(target.value, target.selectionStart ?? target.value.length);
          }}
          onBlur={() => onTypingChange?.(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && showMentionList && filteredMentionCandidates.length > 0) {
              e.preventDefault();
              applyMention(filteredMentionCandidates[0]);
              return;
            }
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
          placeholder={placeholder || 'Type a message...'}
          disabled={disabled}
          className={styles.input}
        />
        {showMentionList && filteredMentionCandidates.length > 0 && (
          <div className="absolute bottom-12 left-0 right-14 rounded-md border border-slate-200 bg-white shadow-lg z-20">
            {filteredMentionCandidates.map(candidate => (
              <button
                key={candidate}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => applyMention(candidate)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
              >
                @{candidate}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="bg-blue-600 text-white p-2 rounded-full w-10 h-10 flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="ml-0.5">➤</span>
        </button>
      </div>
    </div>
  );
};