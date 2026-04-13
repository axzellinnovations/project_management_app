'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Filter, X, ChevronDown } from 'lucide-react';

export interface BacklogFilters {
  search: string;
  statuses: string[];
  priorities: string[];
  assignee: string; // '' = all
}

interface FilterBarProps {
  filters: BacklogFilters;
  onChange: (filters: BacklogFilters) => void;
  assigneeNames: string[];
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do', dot: 'bg-[#D0D5DD]' },
  { value: 'IN_PROGRESS', label: 'In Progress', dot: 'bg-[#175CD3]' },
  { value: 'IN_REVIEW', label: 'In Review', dot: 'bg-[#B54708]' },
  { value: 'DONE', label: 'Done', dot: 'bg-[#027A48]' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'text-[#027A48]' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-[#B54708]' },
  { value: 'HIGH', label: 'High', color: 'text-[#B42318]' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-[#912018]' },
];

export default function FilterBar({ filters, onChange, assigneeNames }: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeFilterCount =
    filters.statuses.length + filters.priorities.length + (filters.assignee ? 1 : 0);

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const toggleStatus = (status: string) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    onChange({ ...filters, statuses: next });
  };

  const togglePriority = (priority: string) => {
    const next = filters.priorities.includes(priority)
      ? filters.priorities.filter((p) => p !== priority)
      : [...filters.priorities, priority];
    onChange({ ...filters, priorities: next });
  };

  const clearFilters = () => {
    onChange({ search: '', statuses: [], priorities: [], assignee: '' });
    setShowFilters(false);
  };

  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Search + Filter toggle row */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search tasks..."
            className="w-full min-h-[44px] pl-9 pr-3 py-2 bg-white border border-[#EAECF0] rounded-lg text-[14px] text-[#344054] outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] transition-all"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
            className={`flex min-h-[44px] items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-bold transition-all ${
            showFilters || activeFilterCount > 0
              ? 'bg-[#EFF8FF] border-[#B2DDFF] text-[#175CD3]'
              : 'bg-white border-[#EAECF0] text-[#344054] hover:bg-[#F9FAFB]'
          }`}
        >
          <Filter size={14} />
          Filter
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#155DFC] text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="min-h-[44px] px-2 text-[12px] font-bold text-[#667085] hover:text-[#344054] transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter dropdowns row */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
          {/* Status filter */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAECF0] bg-white text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
            >
              Status
              {filters.statuses.length > 0 && (
                <span className="rounded-full bg-[#155DFC] px-1.5 text-[10px] text-white">{filters.statuses.length}</span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'status' && (
              <div className="absolute left-0 top-9 z-50 min-w-[160px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleStatus(opt.value)}
                    className="flex min-h-[42px] w-full items-center gap-2 px-3 py-2 text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    <div className={`h-2.5 w-2.5 rounded-full ${opt.dot}`} />
                    <span className="flex-1 text-left">{opt.label}</span>
                    {filters.statuses.includes(opt.value) && (
                      <span className="text-[#155DFC] text-[14px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Priority filter */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAECF0] bg-white text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
            >
              Priority
              {filters.priorities.length > 0 && (
                <span className="rounded-full bg-[#155DFC] px-1.5 text-[10px] text-white">{filters.priorities.length}</span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'priority' && (
              <div className="absolute left-0 top-9 z-50 min-w-[140px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
                {PRIORITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => togglePriority(opt.value)}
                    className={`flex min-h-[42px] w-full items-center gap-2 px-3 py-2 text-[12px] font-bold hover:bg-[#F9FAFB] ${opt.color}`}
                  >
                    <span className="flex-1 text-left">{opt.label}</span>
                    {filters.priorities.includes(opt.value) && (
                      <span className="text-[#155DFC] text-[14px]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Assignee filter */}
          <div className="relative">
            <button
              onClick={() => setOpenDropdown(openDropdown === 'assignee' ? null : 'assignee')}
              className="flex min-h-[42px] items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#EAECF0] bg-white text-[12px] font-bold text-[#344054] hover:bg-[#F9FAFB] transition-all"
            >
              Assignee
              {filters.assignee && (
                <span className="rounded-full bg-[#155DFC] px-1.5 text-[10px] text-white">1</span>
              )}
              <ChevronDown size={12} />
            </button>
            {openDropdown === 'assignee' && (
              <div className="absolute left-0 top-9 z-50 min-w-[160px] max-h-48 overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white shadow-xl">
                <button
                  onClick={() => { onChange({ ...filters, assignee: '' }); setOpenDropdown(null); }}
                  className={`flex min-h-[42px] w-full items-center px-3 py-2 text-[12px] font-bold hover:bg-[#F9FAFB] ${!filters.assignee ? 'text-[#155DFC]' : 'text-[#344054]'}`}
                >
                  All
                </button>
                {assigneeNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => { onChange({ ...filters, assignee: name }); setOpenDropdown(null); }}
                    className={`flex min-h-[42px] w-full items-center px-3 py-2 text-[12px] font-bold hover:bg-[#F9FAFB] ${filters.assignee === name ? 'text-[#155DFC] bg-[#EFF8FF]' : 'text-[#344054]'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
