'use client';

import React from 'react';
import { Search, CheckCircle2 } from 'lucide-react';

interface SprintSummary {
  id: number;
  status: string;
  sprintName?: string;
}

interface SprintBoardHeaderProps {
  sprintName: string;
  allActiveSprints?: SprintSummary[];
  selectedIdx?: number;
  onSelectSprint?: (idx: number) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  onCompleteSprint: () => void;
  isLoading?: boolean;
}

export default function SprintBoardHeader({
  sprintName,
  allActiveSprints = [],
  selectedIdx = 0,
  onSelectSprint,
  searchTerm,
  onSearchChange,
  onCompleteSprint,
  isLoading
}: SprintBoardHeaderProps) {
  const showTabs = allActiveSprints.length > 1;

  return (
    <div className="flex flex-col bg-white border-b border-[#EAECF0]">
      {/* Main header row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 py-5 px-4 md:px-8">
        {/* Title section */}
        <div className="flex items-center justify-between lg:justify-start gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[20px] font-bold text-[#101828] tracking-tight">
              Sprint Board
            </h1>
            {!showTabs && (
              <>
                <div className="hidden sm:block h-5 w-[1px] bg-[#EAECF0]" />
                <span className="text-[14px] font-medium text-[#475467] truncate max-w-[120px] sm:max-w-none">
                  {sprintName}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Middle Search & Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-[280px] group transition-all duration-300">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search size={18} className="text-[#98A2B3] group-focus-within:text-[#155DFC] transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-[14px] placeholder-[#667085] focus:outline-none focus:ring-4 focus:ring-[#155DFC]/10 focus:border-[#155DFC] transition-all"
            />
          </div>

          {/* Complete Sprint action */}
          <button
            onClick={onCompleteSprint}
            disabled={isLoading}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-[#155DFC] hover:bg-[#1149C9] text-white rounded-xl text-[14px] font-bold shadow-md hover:shadow-lg active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap"
          >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              <span>Complete Sprint</span>
          </button>
        </div>
      </div>

      {/* Sprint tabs (only when multiple active sprints) */}
      {showTabs && (
        <div className="flex items-center gap-1 px-4 md:px-8 pb-0 border-t border-[#F2F4F7] overflow-x-auto hide-scrollbar">
          {allActiveSprints.map((sprint, idx) => (
            <button
              key={sprint.id}
              onClick={() => onSelectSprint?.(idx)}
              className={`flex-shrink-0 px-4 py-3 text-[13px] font-semibold border-b-2 transition-all ${
                idx === selectedIdx
                  ? 'border-[#155DFC] text-[#155DFC]'
                  : 'border-transparent text-[#667085] hover:text-[#344054] hover:border-[#D0D5DD]'
              }`}
            >
              {sprint.sprintName ?? `Sprint #${sprint.id}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
