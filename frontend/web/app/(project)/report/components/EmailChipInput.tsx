'use client';

// ══════════════════════════════════════════════════════════════════════════════
//  EmailChipInput.tsx  ·  Tag-style multi-email input with validation
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useRef, KeyboardEvent } from 'react';
import { X, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailChipInputProps {
  label:       string;
  placeholder?: string;
  value:       string[];
  onChange:    (emails: string[]) => void;
  required?:   boolean;
  error?:      string;
}

export default function EmailChipInput({
  label, placeholder = 'Add email…', value, onChange, required, error,
}: EmailChipInputProps) {
  const [inputVal, setInputVal]   = useState('');
  const [badEmail, setBadEmail]   = useState('');
  const inputRef                  = useRef<HTMLInputElement>(null);

  const tryAdd = (raw: string) => {
    const emails = raw.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
    const invalid = emails.find(e => !EMAIL_RE.test(e));
    if (invalid) { setBadEmail(invalid); return; }
    setBadEmail('');
    const next = [...value, ...emails.filter(e => !value.includes(e))];
    onChange(next);
    setInputVal('');
  };

  const remove = (email: string) => onChange(value.filter(e => e !== email));

  const handleKey = (ev: KeyboardEvent<HTMLInputElement>) => {
    if (['Enter', ',', 'Tab', ' '].includes(ev.key)) {
      ev.preventDefault();
      if (inputVal.trim()) tryAdd(inputVal);
    }
    if (ev.key === 'Backspace' && !inputVal && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const handleBlur = () => {
    if (inputVal.trim()) tryAdd(inputVal);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label */}
      <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-widest flex items-center gap-1">
        <Mail size={11} />
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>

      {/* Chip container */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={`
          min-h-[44px] flex flex-wrap gap-1.5 items-center px-3 py-2 rounded-xl cursor-text
          border transition-all duration-150
          ${error ? 'border-red-400 bg-red-50' : 'border-[#E5E7EB] hover:border-[#155DFC]/40 focus-within:border-[#155DFC] focus-within:ring-2 focus-within:ring-[#155DFC]/10'}
          bg-white/80 backdrop-blur-sm
        `}
      >
        <AnimatePresence initial={false}>
          {value.map(email => (
            <motion.span
              key={email}
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EBF2FF] text-[#155DFC] border border-[#155DFC]/20"
            >
              {email}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); remove(email); }}
                className="w-3.5 h-3.5 rounded-full flex items-center justify-center hover:bg-[#155DFC]/20 transition-colors"
              >
                <X size={8} strokeWidth={3} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>

        <input
          ref={inputRef}
          type="email"
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setBadEmail(''); }}
          onKeyDown={handleKey}
          onBlur={handleBlur}
          placeholder={value.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-[12px] text-[#1F2937] placeholder:text-[#9CA3AF]"
          style={{ fontSize: '12px' }}
        />
      </div>

      {/* Validation */}
      <AnimatePresence>
        {(badEmail || error) && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[11px] text-red-500 font-medium ml-1"
          >
            {badEmail ? `"${badEmail}" is not a valid email.` : error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
