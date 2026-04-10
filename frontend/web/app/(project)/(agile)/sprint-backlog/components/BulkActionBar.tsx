'use client';

import { ChevronDown, MoveRight, Trash2, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { SprintItem } from '@/types';

interface BulkActionBarProps {
  selectedCount: number;
  sprints: SprintItem[];
  onMoveToSprint: (sprintId: number) => void;
  onMoveToBacklog: () => void;
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

export default function BulkActionBar({
  selectedCount,
  sprints,
  onMoveToSprint,
  onMoveToBacklog,
  onStatusChange,
  onDelete,
  onClear,
}: BulkActionBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div
        ref={menuRef}
        className="flex items-center gap-2 rounded-2xl border border-[#D0D5DD] bg-white px-4 py-2.5 shadow-xl"
      >
        {/* Count badge */}
        <div className="flex items-center gap-2 pr-3 border-r border-[#EAECF0]">
          <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[#155DFC] px-1.5 text-[11px] font-bold text-white">
            {selectedCount}
          </span>
          <span className="text-[13px] font-bold text-[#344054] hidden sm:inline">selected</span>
        </div>

        {/* Move to Sprint */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'move' ? null : 'move')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
          >
            <MoveRight size={14} />
            <span className="hidden sm:inline">Move</span>
            <ChevronDown size={12} />
          </button>
          {openMenu === 'move' && (
            <div className="absolute bottom-10 left-0 min-w-[180px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              <button
                onClick={() => { onMoveToBacklog(); setOpenMenu(null); }}
                className="flex w-full items-center px-3 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
              >
                Backlog
              </button>
              <div className="border-t border-[#F2F4F7]" />
              {sprints.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { onMoveToSprint(s.id); setOpenMenu(null); }}
                  className="flex w-full items-center px-3 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bulk Status Change */}
        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
          >
            Status
            <ChevronDown size={12} />
          </button>
          {openMenu === 'status' && (
            <div className="absolute bottom-10 left-0 min-w-[140px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onStatusChange(opt.value); setOpenMenu(null); }}
                  className="flex w-full items-center px-3 py-2.5 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-[#F04438] hover:bg-[#FEF3F2] transition-all"
        >
          <Trash2 size={14} />
          <span className="hidden sm:inline">Delete</span>
        </button>

        {/* Clear selection */}
        <div className="pl-2 border-l border-[#EAECF0]">
          <button
            onClick={onClear}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-[#667085] hover:bg-[#F2F4F7] hover:text-[#344054] transition-all"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
