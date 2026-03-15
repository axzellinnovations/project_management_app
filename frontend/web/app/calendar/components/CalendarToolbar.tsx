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
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToday}
            className="rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-medium text-[#344054] hover:bg-[#F9FAFB]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]"
            aria-label="Previous"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-2 text-sm text-[#344054] hover:bg-[#F9FAFB]"
            aria-label="Next"
          >
            Next
          </button>
          <div className="ml-1 text-sm font-semibold text-[#101828]">{currentLabel}</div>
        </div>

        <div>
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as CalendarView)}
            className="rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054]"
          >
            <option value="month">Month view</option>
            <option value="week">Week view</option>
            <option value="agenda">Agenda view</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search calendar"
          className="w-64 rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm outline-none focus:border-[#175CD3]"
        />

        <FilterDropdown
          label="Assignee"
          options={assigneeOptions}
          selected={filters.assignees}
          onChange={onAssigneesChange}
          searchablePlaceholder="Search assignee"
          widthClassName="w-64"
        />

        <FilterDropdown
          label="Type"
          options={typeOptions}
          selected={filters.types}
          onChange={onTypesChange}
          searchablePlaceholder="Search Type"
          widthClassName="w-64"
        />

        <FilterDropdown
          label="Status"
          options={statusOptions}
          selected={filters.statuses}
          onChange={onStatusesChange}
          searchablePlaceholder="Search status"
          widthClassName="w-56"
        />

        <FilterDropdown
          label="More filters"
          options={moreFilterOptions}
          selected={filters.moreFilters}
          onChange={onMoreFiltersChange}
          searchablePlaceholder="Search more filters"
          widthClassName="w-64"
        />
      </div>
    </div>
  );
}
