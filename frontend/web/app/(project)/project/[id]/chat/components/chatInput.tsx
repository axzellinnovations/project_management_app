'use client';

import React, { useMemo, useState, useRef, useCallback, ChangeEvent } from 'react';
import { Paperclip, Send, Smile } from 'lucide-react';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { uploadChatDocument } from './uploadChatDocument';
import { useParams } from 'next/navigation';

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
  mentionCandidates = [],
}: ChatInputProps) => {
  const params = useParams();
  const projectId = params.id as string;
  const [input, setInput] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;
    setUploading(true);
    try {
      const url = await uploadChatDocument(projectId, file);
      onSendMessage(url);
    } catch {
      alert('Failed to upload file.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filteredMentionCandidates = useMemo(() => {
    if (!enableMentions || !showMentionList) return [] as string[];
    const q = mentionQuery.trim().toLowerCase();
    return mentionCandidates
      .filter((n) => !!n)
      .filter((n) => q.length === 0 || n.toLowerCase().includes(q))
      .slice(0, 6);
  }, [enableMentions, mentionCandidates, mentionQuery, showMentionList]);

  const updateMentionState = (value: string, caretIndex: number) => {
    if (!enableMentions) { setMentionQuery(''); setShowMentionList(false); return; }
    const prefix = value.slice(0, caretIndex);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) { setMentionQuery(''); setShowMentionList(false); return; }
    setMentionQuery(match[2] || '');
    setShowMentionList(true);
  };

  const applyMention = (memberName: string) => {
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const prefix = input.slice(0, caret);
    const suffix = input.slice(caret);
    const match = prefix.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (!match) return;
    const leading = match[1] || '';
    const mentionStart = prefix.length - match[0].length + leading.length;
    const nextValue = `${prefix.slice(0, mentionStart)}@${memberName} ${suffix}`;
    setInput(nextValue);
    setMentionQuery('');
    setShowMentionList(false);
    onTypingChange?.(nextValue.trim().length > 0);
    textareaRef.current?.focus();
  };

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSendMessage(input.trim());
      setInput('');
      setMentionQuery('');
      setShowMentionList(false);
      onTypingChange?.(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [input, disabled, onSendMessage, onTypingChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && showMentionList && filteredMentionCandidates.length > 0) {
      e.preventDefault();
      applyMention(filteredMentionCandidates[0]);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Escape closes mention list
    if (e.key === 'Escape') {
      setShowMentionList(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setInput(nextValue);
    updateMentionState(nextValue, e.target.selectionStart ?? nextValue.length);
    onTypingChange?.(nextValue.trim().length > 0);

    // Auto-resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  };

  const canSend = input.trim().length > 0 && !disabled && !uploading;

  return (
    <div
      className="relative flex-shrink-0 border-t border-gray-100/80 bg-white/95 px-3 sm:px-4 py-3 z-30 shadow-[0_-6px_18px_rgba(0,0,0,0.04)] supports-[backdrop-filter]:backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Mention dropdown */}
      {showMentionList && filteredMentionCandidates.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-100 rounded-2xl shadow-lg overflow-hidden z-20">
          <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold text-gray-400 uppercase tracking-wider">
            Mention a teammate
          </div>
          {filteredMentionCandidates.map((candidate) => (
            <button
              key={candidate}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => applyMention(candidate)}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
              aria-label={`Mention ${candidate}`}
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {candidate.charAt(0).toUpperCase()}
              </div>
              <span className="text-[13px] font-medium text-gray-700">@{candidate}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div className={`flex items-center gap-2 bg-gray-50 border rounded-2xl px-3 py-2.5 sm:py-2 transition-all
        ${disabled ? 'opacity-60 cursor-not-allowed' : 'focus-within:bg-white focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50'}
        border-gray-200 shadow-[0_6px_22px_rgba(0,0,0,0.03)]`}>

        {/* Emoji Picker Dropdown */}
        {showEmojiPicker && !disabled && (
          <div className="absolute bottom-[calc(100%+12px)] left-4 z-50 shadow-2xl rounded-2xl overflow-hidden border border-gray-100">
            <EmojiPicker
              onEmojiClick={(emojiData) => {
                const nextValue = input + emojiData.emoji;
                setInput(nextValue);
                setShowEmojiPicker(false);
                onTypingChange?.(nextValue.trim().length > 0);
                textareaRef.current?.focus();
              }}
              lazyLoadEmojis={true}
              theme={Theme.LIGHT}
              searchDisabled={true}
              previewConfig={{ showPreview: false }}
              height={350}
              width={320}
            />
          </div>
        )}

        {/* Emoji placeholder button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          disabled={disabled}
          className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0
            ${showEmojiPicker ? 'text-blue-500 bg-blue-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
          title="Emoji Picker"
          aria-label="Toggle emoji picker"
        >
          <Smile size={18} strokeWidth={2} />
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          aria-label="Attach a file"
        />

        {/* Attach button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all flex-shrink-0"
          title="Attach file"
          aria-label="Attach file"
        >
          {uploading ? (
            <span className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          ) : (
            <Paperclip size={17} strokeWidth={2} />
          )}
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="chat-input"
          value={input}
          onChange={handleInput}
          onClick={(e) => {
            const target = e.target as HTMLTextAreaElement;
            updateMentionState(target.value, target.selectionStart ?? target.value.length);
          }}
          onBlur={() => onTypingChange?.(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || 'Type a message…'}
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-[14px] sm:text-[13.5px] text-gray-800 placeholder:text-gray-400 outline-none resize-none leading-relaxed py-1 max-h-32 overflow-y-auto"
          aria-label="Message input"
          aria-multiline="true"
          aria-autocomplete="list"
          autoComplete="off"
        />

        {/* Send button */}
        <button
          id="chat-send-btn"
          onClick={handleSend}
          disabled={!canSend}
          className={`w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-all duration-150
            ${canSend
              ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm shadow-blue-200 active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          aria-label="Send message"
          title="Send (Enter)"
        >
          <Send size={15} strokeWidth={2.5} />
        </button>
      </div>

      {/* Hint */}
      {!disabled && (
        <p className="text-[10px] text-gray-400 text-center mt-1.5">
          <span className="font-medium">Enter</span> to send · <span className="font-medium">Shift+Enter</span> for new line
        </p>
      )}
    </div>
  );
};