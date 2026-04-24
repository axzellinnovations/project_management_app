'use client';

import React, { useState } from 'react';
import { Search, CheckCircle2, LayoutGrid, X, SlidersHorizontal, Users, ListChecks, ChevronDown } from 'lucide-react';
import { SprintBoardFilters } from '../types';

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
  filters: SprintBoardFilters;
  onSearchChange: (val: string) => void;
  onFilterChange: (patch: Partial<SprintBoardFilters>) => void;
  onCompleteSprint: () => void;
  totalTasks: number;
  doneTasks: number;
  doneStoryPoints: number;
  totalStoryPoints: number;
  overdueTasks: number;
  selectedCount: number;
  isLoading?: boolean;
  onOpenShortcuts?: () => void;
  teamMembers?: { id: number; name: string; userId?: number }[];
}

export default function SprintBoardHeader({
  sprintName,
  allActiveSprints = [],
  selectedIdx = 0,
  onSelectSprint,
  filters,
  onSearchChange,
  onFilterChange,
  onCompleteSprint,
  totalTasks,
  doneTasks,
  doneStoryPoints,
  totalStoryPoints,
  overdueTasks,
  selectedCount,
  onOpenShortcuts: _onOpenShortcuts,
  isLoading,
  teamMembers = []
}: SprintBoardHeaderProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const showTabs = allActiveSprints.length > 1;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  return (
    <div className="flex flex-col bg-white border-b border-gray-200/80">
      <div className="flex items-center justify-between gap-4 py-3 px-4 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <LayoutGrid size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold text-gray-900 tracking-tight">Sprint Board</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-gray-500 truncate">{sprintName}</span>
              <span className="text-gray-300">·</span>
              <span className="text-[11px] text-gray-500">{totalTasks} tasks</span>
              <span className="text-gray-300">·</span>
              <span className="text-[11px] text-gray-500">{doneStoryPoints}/{totalStoryPoints} pts</span>
              {overdueTasks > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <span className="text-[11px] font-semibold text-[#B42318]">{overdueTasks} overdue</span>
                </>
              )}
              {totalTasks > 0 && (
                <>
                  <span className="text-gray-300">·</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1 rounded-full bg-gray-200 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className="text-[11px] text-gray-500 font-medium">{progressPercent}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors w-fit"
              aria-label="Filters"
            >
              <SlidersHorizontal size={13} />
              <span>Filters</span>
              <ChevronDown size={12} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {isFilterOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsFilterOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-20 p-4 space-y-4 animate-in fade-in zoom-in duration-200">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                      value={filters.priority}
                      onChange={(e) => onFilterChange({ priority: e.target.value })}
                    >
                      <option value="ALL">All priorities</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Status</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                      value={filters.status}
                      onChange={(e) => onFilterChange({ status: e.target.value })}
                    >
                      <option value="ALL">All statuses</option>
                      <option value="TODO">To do</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="IN_REVIEW">In review</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Assignee</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                      value={filters.assignee}
                      onChange={(e) => onFilterChange({ assignee: e.target.value })}
                    >
                      <option value="ALL">All assignees</option>
                      <option value="Unassigned">Unassigned</option>
                      {teamMembers.map((m) => (
                        <option key={m.id || m.userId} value={m.name}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Swimlane</label>
                    <select
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500"
                      value={filters.swimlane}
                      onChange={(e) => onFilterChange({ swimlane: e.target.value as SprintBoardFilters['swimlane'] })}
                    >
                      <option value="none">No swimlanes</option>
                      <option value="assignee">Swimlane by assignee</option>
                      <option value="priority">Swimlane by priority</option>
                    </select>
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onFilterChange({ showOnlyMine: !filters.showOnlyMine })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        filters.showOnlyMine
                          ? 'border-blue-200 bg-blue-50 text-blue-600'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <Users size={12} className="inline mr-1.5 mb-0.5" />
                      {filters.showOnlyMine ? 'Showing mine' : 'Show only mine'}
                    </button>
                    <div className="rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-xs text-gray-500 font-medium">
                      <ListChecks size={12} className="inline mr-1.5 mb-0.5" />
                      {selectedCount} selected
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center bg-gray-100 rounded-lg px-3 py-1.5 border border-transparent focus-within:border-blue-300 focus-within:bg-white transition-all">
            <Search size={14} className="text-[#98A2B3]" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={filters.search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-transparent border-0 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ml-2 w-40 lg:w-56"
            />
            {filters.search && (
              <button onClick={() => onSearchChange('')} className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-sm" aria-label="Clear search">
                <X size={12} />
              </button>
            )}
          </div>
          <button
            onClick={onCompleteSprint}
            disabled={isLoading}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 size={14} />
            )}
            <span>Complete Sprint</span>
          </button>
        </div>
      </div>

      <div className="hidden">
        {/* Previous filter row removed as it's now in a dropdown */}
      </div>

      <div className="sm:hidden px-4 pb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search size={14} className="text-[#98A2B3]" />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="block w-full pl-10 pr-4 py-2 bg-[#F9FAFB] border border-[#EAECF0] rounded-xl text-[14px] placeholder-[#667085] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/10 focus:border-[#155DFC] transition-all"
          />
        </div>
        <button
          onClick={onCompleteSprint}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[12px] font-semibold disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <CheckCircle2 size={14} />
        </button>
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
                  ? 'border-[#155DFC] text-[#155DFC] bg-blue-50/60'
                  : 'border-transparent text-[#667085] hover:text-[#344054] hover:border-[#D0D5DD]'
              } focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-t-md`}
            >
              {sprint.sprintName ?? `Sprint #${sprint.id}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
