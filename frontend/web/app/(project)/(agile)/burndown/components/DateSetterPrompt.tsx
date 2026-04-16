'use client';

import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

interface DateSetterPromptProps {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  onSaveDate: (field: 'start' | 'end', val: string) => void;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return 'Set Date';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function DateSetterPrompt({ startDate, endDate, onSaveDate }: DateSetterPromptProps) {
  const sprintStartDateRef = useRef<HTMLInputElement>(null);
  const sprintEndDateRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-[#667085]">
      <CalendarDays size={32} className="text-[#D0D5DD]" />
      <p className="text-sm">Start and end dates are required to view the burndown chart.</p>
      <div className="flex items-center gap-3 mt-2">
        <div className="relative flex items-center gap-1">
          <span className="text-[13px] font-medium text-[#344054]">Start:</span>
          <button
            type="button"
            onClick={() => sprintStartDateRef.current?.showPicker()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:border-[#98A2B3] transition-colors shadow-sm"
          >
            <CalendarDays size={14} className="text-[#667085]" />
            <span className={startDate ? 'text-[#344054]' : 'text-[#98A2B3]'}>
              {formatDate(startDate)}
            </span>
          </button>
          <input
            ref={sprintStartDateRef}
            type="date"
            value={startDate || ''}
            onChange={(e) => onSaveDate('start', e.target.value)}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
          />
        </div>
        <span className="text-[#98A2B3]">-</span>
        <div className="relative flex items-center gap-1">
          <span className="text-[13px] font-medium text-[#344054]">End:</span>
          <button
            type="button"
            onClick={() => sprintEndDateRef.current?.showPicker()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:border-[#98A2B3] transition-colors shadow-sm"
          >
            <CalendarDays size={14} className="text-[#667085]" />
            <span className={endDate ? 'text-[#344054]' : 'text-[#98A2B3]'}>
              {formatDate(endDate)}
            </span>
          </button>
          <input
            ref={sprintEndDateRef}
            type="date"
            value={endDate || ''}
            onChange={(e) => onSaveDate('end', e.target.value)}
            className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
