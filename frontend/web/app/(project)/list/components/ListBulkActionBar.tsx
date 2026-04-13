'use client';

import { ChevronDown, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ListBulkActionBarProps {
  selectedCount: number;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
];

export default function ListBulkActionBar({
  selectedCount,
  onStatusChange,
  onDelete,
  onClear,
}: ListBulkActionBarProps) {
  const [openStatus, setOpenStatus] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenStatus(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div ref={ref} className="flex items-center gap-2 rounded-2xl border border-[#D0D5DD] bg-white px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-2 pr-3 border-r border-[#EAECF0]">
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#155DFC] px-1.5 text-[11px] font-bold text-white">
            {selectedCount}
          </span>
          <span className="text-[13px] font-bold text-[#344054] hidden sm:inline">selected</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenStatus((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
          >
            Status
            <ChevronDown size={12} />
          </button>
          {openStatus && (
            <div className="absolute bottom-10 left-0 min-w-[140px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onStatusChange(opt.value); setOpenStatus(false); }}
                  className="flex w-full items-center px-3 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#F04438] hover:bg-[#FEF3F2] transition-all"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        <div className="pl-2 border-l border-[#EAECF0]">
          <button
            onClick={onClear}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7] hover:text-[#344054] transition-all"
            aria-label="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
