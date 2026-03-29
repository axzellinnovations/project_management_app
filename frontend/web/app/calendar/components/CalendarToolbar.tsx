'use client';

import type { CalendarFilters, CalendarView } from '../types';
import FilterDropdown from './FilterDropdown';

interface CalendarToolbarProps {
  view: CalendarView;
  currentLabel: string;
  filters: CalendarFilters;
  assigneeOptions: string[];
  typeOptions: string[];
  statusOptions: string[];
  moreFilterOptions: string[];
  onViewChange: (value: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSearchChange: (value: string) => void;
  onAssigneesChange: (values: string[]) => void;
  onTypesChange: (values: string[]) => void;
  onStatusesChange: (values: string[]) => void;
  onMoreFiltersChange: (values: string[]) => void;
}

export default function CalendarToolbar({
  view,
  currentLabel,
  filters,
  assigneeOptions,
  typeOptions,
  statusOptions,
  moreFilterOptions,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onSearchChange,
  onAssigneesChange,
  onTypesChange,
  onStatusesChange,
  onMoreFiltersChange,
}: CalendarToolbarProps) {
  const controlClassName =
    'h-10 rounded-md border border-[#DFE1E6] bg-white px-3 text-sm font-medium text-[#344563] hover:border-[#C1C7D0] hover:bg-[#FAFBFC]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filters.search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search calendar"
            className="h-10 w-56 rounded-[4px] border border-[#DFE1E6] bg-[#FAFBFC] px-3 text-sm text-[#42526E] outline-none placeholder:text-[#6B778C] focus:border-[#4C9AFF]"
          />

          <FilterDropdown
            label="Assignee"
            options={assigneeOptions}
            selected={filters.assignees}
            onChange={onAssigneesChange}
            searchablePlaceholder="Search assignee"
            widthClassName="w-44"
          />

          <FilterDropdown
            label="Type"
            options={typeOptions}
            selected={filters.types}
            onChange={onTypesChange}
            searchablePlaceholder="Search Type"
            widthClassName="w-44"
          />

          <FilterDropdown
            label="Status"
            options={statusOptions}
            selected={filters.statuses}
            onChange={onStatusesChange}
            searchablePlaceholder="Search status"
            widthClassName="w-44"
          />

          <FilterDropdown
            label="More filters"
            options={moreFilterOptions}
            selected={filters.moreFilters}
            onChange={onMoreFiltersChange}
            searchablePlaceholder="Search more filters"
            widthClassName="w-44"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className={controlClassName}
          >
            Today
          </button>

          <button
            type="button"
            onClick={onPrev}
            className={`${controlClassName} w-10 px-0 text-base`}
            aria-label="Previous"
          >
            {'<'}
          </button>

          <div className="h-10 min-w-[130px] rounded-[4px] border border-[#DFE1E6] bg-white px-4 text-center text-sm font-semibold leading-10 text-[#42526E]">
            {currentLabel}
          </div>

          <button
            type="button"
            onClick={onNext}
            className={`${controlClassName} w-10 px-0 text-base`}
            aria-label="Next"
          >
            {'>'}
          </button>

          <div className="relative">
            <select
              value={view}
              onChange={(e) => onViewChange(e.target.value as CalendarView)}
              className="h-10 min-w-[120px] appearance-none rounded-md border border-[#DFE1E6] bg-white pl-3 pr-9 text-sm font-medium text-[#344563] outline-none transition-all hover:border-[#C1C7D0] hover:bg-[#FAFBFC] focus:border-[#4C9AFF] focus:shadow-[0_0_0_2px_rgba(76,154,255,0.2)]"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="agenda">Agenda</option>
            </select>
            <svg
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B778C]"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
