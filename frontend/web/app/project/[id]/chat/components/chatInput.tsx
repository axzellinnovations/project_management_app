import React, { useState } from 'react';
import styles from '../chat.module.css';

interface ChatInputProps {
  onSendMessage: (msg: string) => void;
  disabled?: boolean;
}

export const ChatInput = ({ onSendMessage, disabled }: ChatInputProps) => {
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className={styles.inputArea}>
      <div className="flex gap-2 w-full">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          disabled={disabled}
          className={styles.input}
        />
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