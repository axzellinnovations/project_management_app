'use client';

import React from 'react';
import { validatePassword, PASSWORD_REQUIREMENTS } from '@/lib/passwordValidation';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  showChecklist?: boolean;
}

const STRENGTH_CONFIG = {
  empty:       { label: '',           barColor: '',                  bars: 0, labelColor: '' },
  weak:        { label: 'Weak',       barColor: 'bg-red-500',        bars: 1, labelColor: 'text-red-600' },
  fair:        { label: 'Fair',       barColor: 'bg-amber-400',      bars: 2, labelColor: 'text-amber-600' },
  strong:      { label: 'Strong',     barColor: 'bg-blue-500',       bars: 3, labelColor: 'text-blue-600' },
  'very-strong':{ label: 'Very Strong', barColor: 'bg-emerald-500',  bars: 4, labelColor: 'text-emerald-600' },
};

export default function PasswordStrengthMeter({
  password,
  showChecklist = true,
}: PasswordStrengthMeterProps) {
  const { strength, checks } = validatePassword(password);

  if (!password) return null;

  const cfg = STRENGTH_CONFIG[strength];

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i < cfg.bars ? cfg.barColor : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        {cfg.label && (
          <span className={`text-[11px] font-semibold ${cfg.labelColor} min-w-[64px] text-right`}>
            {cfg.label}
          </span>
        )}
      </div>

      {/* Checklist */}
      {showChecklist && (
        <ul className="space-y-1">
          {PASSWORD_REQUIREMENTS.map(({ key, label }) => {
            const met = checks[key];
            return (
              <li key={key} className={`flex items-center gap-1.5 text-[11px] ${met ? 'text-emerald-600' : 'text-gray-400'}`}>
                {met
                  ? <Check size={11} className="flex-shrink-0" />
                  : <X size={11} className="flex-shrink-0" />
                }
                {label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
