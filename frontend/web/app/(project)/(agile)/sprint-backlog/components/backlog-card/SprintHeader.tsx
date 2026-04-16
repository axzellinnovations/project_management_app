'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Rocket,
  Trash2,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface SprintHeaderProps {
  sprintName: string;
  sprintStatus: string;
  sprintEndDate?: string;
  isOpen: boolean;
  totals: { todo: number; inprogress: number; done: number };
  canDeleteSprint: boolean;
  onToggleOpen: () => void;
  onEditSprint: () => void;
  onStartSprint: () => void;
  onCompleteSprint: () => void;
  onDeleteSprint: () => void;
  onViewReport: () => void;
  onNameSave: (name: string) => Promise<void>;
  editingSprintLoading: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SprintHeader({
  sprintName,
  sprintStatus,
  sprintEndDate,
  isOpen,
  totals,
  canDeleteSprint,
  onToggleOpen,
  onEditSprint,
  onStartSprint,
  onCompleteSprint,
  onDeleteSprint,
  onViewReport,
  onNameSave,
  editingSprintLoading,
}: SprintHeaderProps) {
  const [showSprintMenu, setShowSprintMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempSprintName, setTempSprintName] = useState(sprintName);
  const sprintMenuRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setTempSprintName(sprintName);
  }, [sprintName]);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.setSelectionRange(tempSprintName.length, tempSprintName.length);
    }
  }, [isEditingName, tempSprintName.length]);

  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (sprintMenuRef.current && !sprintMenuRef.current.contains(event.target as Node)) {
        setShowSprintMenu(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSprintMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNameDoubleClick = () => setIsEditingName(true);

  const handleTouchStart = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      handleNameDoubleClick();
    }
    lastTapRef.current = now;
    longPressTimerRef.current = setTimeout(() => {
      if (canDeleteSprint) onDeleteSprint();
    }, 600);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };
  const handleTouchMove = () => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  };

  const handleNameSaveInternal = async () => {
    const trimmed = tempSprintName.trim();
    if (!trimmed || trimmed === sprintName) {
      setIsEditingName(false);
      return;
    }
    await onNameSave(trimmed);
    setIsEditingName(false);
  };

  // Days left badge
  const daysLeftBadge = (() => {
    if (!sprintEndDate || sprintStatus === 'COMPLETED') return null;
    const daysLeft = Math.ceil(
      (new Date(sprintEndDate + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysLeft < 0) return null;
    const isDanger = daysLeft <= 2;
    const isWarning = !isDanger && daysLeft <= 7;
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[12px] font-bold ${
        isDanger ? 'border-[#FECDCA] bg-[#FEF3F2] text-[#B42318]' :
        isWarning ? 'border-[#FEDF89] bg-[#FFFAEB] text-[#B54708]' :
        'border-[#EAECF0] bg-white text-[#667085]'
      }`}>
        {daysLeft}d left
      </span>
    );
  })();

  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#EAECF0] pb-4 gap-3 sm:gap-4">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded border border-[#98A2B3] bg-transparent" />

        <button
          type="button"
          onClick={onToggleOpen}
          className="text-[#344054] p-1 hover:bg-[#F2F4F7] rounded-lg transition-colors duration-150"
        >
          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={tempSprintName}
              onChange={(e) => setTempSprintName(e.target.value)}
              onBlur={() => void handleNameSaveInternal()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleNameSaveInternal();
                if (e.key === 'Escape') setIsEditingName(false);
              }}
              disabled={editingSprintLoading}
              className="w-full min-w-[200px] border-b border-[#175CD3] bg-transparent text-[14px] font-bold text-[#101828] outline-none"
            />
          ) : (
            <span
              onClick={(e) => {
                const now = Date.now();
                if (now - lastTapRef.current < 300) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNameDoubleClick();
                }
                lastTapRef.current = now;
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleNameDoubleClick();
              }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
              className="cursor-text text-[14px] font-bold text-[#101828] select-none"
            >
              {sprintName}
            </span>
          )}

          <button
            onClick={() => setIsEditingName(!isEditingName)}
            className="p-1.5 text-[#98A2B3] hover:text-[#175CD3] hover:bg-[#F2F4F7] rounded-lg transition-colors"
            title="Edit Sprint Name"
          >
            <Pencil size={14} />
          </button>

          {daysLeftBadge}
        </div>
      </div>

      <div className="relative flex items-center justify-end gap-3 flex-1" ref={sprintMenuRef}>
        <div className="flex items-center gap-1.5 bg-white border border-[#EAECF0] px-2 py-1 rounded-full shadow-sm">
          <div className="rounded-full bg-[#F2F4F7] px-2 py-[2px] text-[12px] font-bold text-[#344054]" title="To Do">
            {totals.todo}
          </div>
          <div className="rounded-full bg-[#EFF8FF] px-2 py-[2px] text-[12px] font-bold text-[#175CD3]" title="In Progress">
            {totals.inprogress}
          </div>
          <div className="rounded-full bg-[#ECFDF3] px-2 py-[2px] text-[12px] font-bold text-[#027A48]" title="Done">
            {totals.done}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sprintStatus === 'NOT_STARTED' ? (
            <button
              onClick={onStartSprint}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#175CD3] bg-[#175CD3] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#1849A9] shadow-sm transform active:scale-95 transition-all duration-150"
            >
              <Rocket size={14} />
              <span>Start Sprint</span>
            </button>
          ) : sprintStatus === 'ACTIVE' ? (
            <button
              onClick={onCompleteSprint}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#027A48] bg-[#039855] px-3.5 py-2 text-[12px] font-bold text-white hover:bg-[#027A48] shadow-sm transform active:scale-95 transition-all duration-150"
            >
              <Check size={14} />
              <span>Complete Sprint</span>
            </button>
          ) : null}

          <button
            onClick={onViewReport}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
          >
            <BarChart3 size={14} />
            <span className="hidden sm:inline">Sprint Report</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSprintMenu((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={showSprintMenu}
            aria-label="Sprint actions"
            className="p-2 text-[#344054] hover:bg-[#F2F4F7] rounded-lg transition-colors duration-150"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>

        {showSprintMenu && (
          <div role="menu" className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => { setShowSprintMenu(false); onEditSprint(); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
            >
              <Pencil size={18} className="text-[#667085]" />
              <span>Edit Sprint</span>
            </button>

            {sprintStatus === 'NOT_STARTED' && (
              <button
                onClick={() => { setShowSprintMenu(false); onStartSprint(); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
              >
                <Rocket size={18} className="text-[#175CD3]" />
                <span>Start Sprint</span>
              </button>
            )}

            {sprintStatus === 'ACTIVE' && (
              <button
                onClick={() => { setShowSprintMenu(false); onCompleteSprint(); }}
                className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#027A48] hover:bg-[#F9FAFB]"
              >
                <Check size={18} />
                <span>Complete Sprint</span>
              </button>
            )}

            <button
              onClick={() => { onViewReport(); setShowSprintMenu(false); }}
              className="flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold text-[#101828] hover:bg-[#F9FAFB]"
            >
              <BarChart3 size={18} className="text-[#667085]" />
              <span>View Report</span>
            </button>

            <div className="border-t border-[#EAECF0]" />

            <button
              onClick={() => { setShowSprintMenu(false); onDeleteSprint(); }}
              disabled={!canDeleteSprint}
              className={`flex w-full items-center gap-3 px-5 py-4 text-left text-[14px] font-bold ${
                canDeleteSprint ? 'text-[#F04438] hover:bg-[#FEF3F2]' : 'text-[#98A2B3] cursor-not-allowed'
              }`}
              title={!canDeleteSprint ? "Only an Admin or Owner can delete a sprint" : ""}
            >
              <Trash2 size={18} />
              <div className="flex flex-col">
                <span>Delete Sprint</span>
                {!canDeleteSprint && (
                  <span className="text-[10px] font-medium text-[#98A2B3]">
                    Admin/Owner only
                  </span>
                )}
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
