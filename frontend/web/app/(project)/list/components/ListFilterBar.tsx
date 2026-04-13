'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Filter, Layers, Search, X } from 'lucide-react';

export interface ListFilters {
  search: string;
  statuses: string[];
  priorities: string[];
  assignee: string;
}

interface ListFilterBarProps {
  filters: ListFilters;
  onChange: (next: ListFilters) => void;
  assigneeNames: string[];
  groupBy: 'none' | 'status' | 'priority' | 'assignee';
  onGroupByChange: (next: 'none' | 'status' | 'priority' | 'assignee') => void;
}

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
const PRIORITY_OPTIONS = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export default function ListFilterBar({
  filters,
  onChange,
  assigneeNames,
  groupBy,
  onGroupByChange,
}: ListFilterBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const activeCount =
    filters.statuses.length + filters.priorities.length + (filters.assignee ? 1 : 0);

  return (
    <div ref={ref} className="rounded-2xl border border-[#E5E7EB] bg-white p-3 sm:p-4 shadow-sm mb-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by task title or assignee..."
            className="w-full h-10 rounded-xl border border-[#E5E7EB] pl-9 pr-8 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20"
          />
          {filters.search && (
            <button
              onClick={() => onChange({ ...filters, search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'status' ? null : 'status')}
            className="h-10 px-3 rounded-xl border border-[#E5E7EB] text-[12px] font-semibold text-[#344054] bg-white hover:bg-[#F9FAFB] flex items-center gap-1.5"
          >
            <Filter size={13} />
            Status
            {filters.statuses.length > 0 && <span className="text-[#155DFC]">({filters.statuses.length})</span>}
            <ChevronDown size={12} />
          </button>
          {openMenu === 'status' && (
            <div className="absolute top-11 left-0 z-50 min-w-[160px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    const has = filters.statuses.includes(status);
                    onChange({
                      ...filters,
                      statuses: has ? filters.statuses.filter((x) => x !== status) : [...filters.statuses, status],
                    });
                  }}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F9FAFB] ${
                    filters.statuses.includes(status) ? 'font-semibold text-[#155DFC]' : 'text-[#344054]'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'priority' ? null : 'priority')}
            className="h-10 px-3 rounded-xl border border-[#E5E7EB] text-[12px] font-semibold text-[#344054] bg-white hover:bg-[#F9FAFB] flex items-center gap-1.5"
          >
            Priority
            {filters.priorities.length > 0 && <span className="text-[#155DFC]">({filters.priorities.length})</span>}
            <ChevronDown size={12} />
          </button>
          {openMenu === 'priority' && (
            <div className="absolute top-11 left-0 z-50 min-w-[160px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              {PRIORITY_OPTIONS.map((priority) => (
                <button
                  key={priority}
                  onClick={() => {
                    const has = filters.priorities.includes(priority);
                    onChange({
                      ...filters,
                      priorities: has ? filters.priorities.filter((x) => x !== priority) : [...filters.priorities, priority],
                    });
                  }}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F9FAFB] ${
                    filters.priorities.includes(priority) ? 'font-semibold text-[#155DFC]' : 'text-[#344054]'
                  }`}
                >
                  {priority}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenMenu(openMenu === 'assignee' ? null : 'assignee')}
            className="h-10 px-3 rounded-xl border border-[#E5E7EB] text-[12px] font-semibold text-[#344054] bg-white hover:bg-[#F9FAFB] flex items-center gap-1.5"
          >
            Assignee
            {filters.assignee && <span className="text-[#155DFC]">(1)</span>}
            <ChevronDown size={12} />
          </button>
          {openMenu === 'assignee' && (
            <div className="absolute top-11 left-0 z-50 min-w-[180px] max-h-52 overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
              <button
                onClick={() => onChange({ ...filters, assignee: '' })}
                className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F9FAFB] ${!filters.assignee ? 'font-semibold text-[#155DFC]' : 'text-[#344054]'}`}
              >
                All assignees
              </button>
              {assigneeNames.map((name) => (
                <button
                  key={name}
                  onClick={() => onChange({ ...filters, assignee: name })}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-[#F9FAFB] ${filters.assignee === name ? 'font-semibold text-[#155DFC]' : 'text-[#344054]'}`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={() => onGroupByChange(groupBy === 'none' ? 'status' : groupBy === 'status' ? 'priority' : groupBy === 'priority' ? 'assignee' : 'none')}
          className="h-10 px-3 rounded-xl border border-[#E5E7EB] text-[12px] font-semibold text-[#344054] bg-white hover:bg-[#F9FAFB] flex items-center gap-1.5"
        >
          <Layers size={13} />
          {groupBy === 'none' ? 'Group by' : `By ${groupBy}`}
        </button>

        {activeCount > 0 && (
          <button
            onClick={() => onChange({ ...filters, statuses: [], priorities: [], assignee: '' })}
            className="h-10 px-3 rounded-xl border border-[#E5E7EB] text-[12px] font-semibold text-[#667085] hover:text-[#344054] bg-white hover:bg-[#F9FAFB]"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
