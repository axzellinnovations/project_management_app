'use client';
import React, { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import SidebarField from './SidebarField';

type RecurrenceRule = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

interface RecurrenceSectionProps {
  recurrenceRule?: string | null;
  recurrenceEnd?: string | null;
  onUpdate: (rule: string | null, end: string | null) => void;
}

const RULES: { value: RecurrenceRule; label: string }[] = [
  { value: 'DAILY',   label: 'Daily'   },
  { value: 'WEEKLY',  label: 'Weekly'  },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY',  label: 'Yearly'  },
];

const RecurrenceSection: React.FC<RecurrenceSectionProps> = ({
  recurrenceRule,
  recurrenceEnd,
  onUpdate,
}) => {
  // Local state mirrors the prop so the section feels instant — changes fire onUpdate to persist to the server
  const [localRule, setLocalRule] = useState<string>(recurrenceRule ?? '');
  const [localEnd, setLocalEnd] = useState<string>(recurrenceEnd ?? '');

  const handleRuleChange = (rule: string) => {
    setLocalRule(rule);
    onUpdate(rule || null, localEnd || null);
  };

  const handleEndChange = (end: string) => {
    setLocalEnd(end);
    onUpdate(localRule || null, end || null);
  };

  const handleClear = () => {
    setLocalRule('');
    setLocalEnd('');
    onUpdate(null, null);
  };

  return (
    <SidebarField label="Recurrence">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <select
            value={localRule}
            onChange={(e) => handleRuleChange(e.target.value)}
            className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 min-h-[44px] sm:min-h-0 bg-white"
          >
            <option value="">No recurrence</option>
            {RULES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          {localRule && (
            <button
              onClick={handleClear}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear recurrence"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {localRule && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">End date (optional)</span>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => handleEndChange(e.target.value)}
              className="text-sm border border-gray-200 rounded px-2 py-1 min-h-[44px] sm:min-h-0"
            />
          </div>
        )}

        {localRule && (
          <div className="flex items-center gap-1.5 text-xs text-blue-600">
            <RefreshCw size={11} />
            <span>Repeats {RULES.find((r) => r.value === localRule)?.label.toLowerCase()}</span>
          </div>
        )}
      </div>
    </SidebarField>
  );
};

export default RecurrenceSection;
