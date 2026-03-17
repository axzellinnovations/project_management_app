import React, { useMemo, useState, ChangeEvent } from 'react';
import { uploadChatDocument } from './uploadChatDocument';
import { useParams } from 'next/navigation';
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
  const params = useParams();
  const projectId = params.id as string;
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [uploading, setUploading] = useState(false);
  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const url = await uploadChatDocument(projectId, file);
      // Send the file URL as a message (or you can customize this)
      onSendMessage(url);
    } catch (err) {
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

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
        <label className="flex items-center cursor-pointer">
          <input
            type="file"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
          <span
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full w-10 h-10 flex items-center justify-center mr-2"
            title="Attach file"
          >
            📎
          </span>
        </label>
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
          {uploading ? (
            <span className="ml-0.5 animate-spin">⏳</span>
          ) : (
            <span className="ml-0.5">➤</span>
          )}
        </button>
      </div>
    </div>
  );
};