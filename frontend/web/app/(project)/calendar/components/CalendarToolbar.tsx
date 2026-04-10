'use client';

import { useState } from 'react';
import type { CalendarFilters, CalendarView } from '../types';
import FilterDropdown from './FilterDropdown';
import BottomSheet from '@/components/shared/BottomSheet';
import { SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const activeFilterCount = [
    filters.assignees.length,
    filters.types.length,
    filters.statuses.length,
    filters.moreFilters.length,
    filters.search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const controlClassName =
    'h-10 rounded-md border border-[#DFE1E6] bg-white px-3 text-sm font-medium text-[#344563] hover:border-[#C1C7D0] hover:bg-[#FAFBFC]';

  return (
    <div className="space-y-3">

      {/* ── Desktop toolbar (md+) ─────────────────────────────────────────── */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-2">
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
          <button type="button" onClick={onToday} className={controlClassName}>Today</button>
          <button type="button" onClick={onPrev} className={`${controlClassName} w-10 px-0 text-base`} aria-label="Previous">{'<'}</button>
          <div className="h-10 min-w-[130px] rounded-[4px] border border-[#DFE1E6] bg-white px-4 text-center text-sm font-semibold leading-10 text-[#42526E]">{currentLabel}</div>
          <button type="button" onClick={onNext} className={`${controlClassName} w-10 px-0 text-base`} aria-label="Next">{'>'}</button>
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
            <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B778C]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Mobile toolbar (<md) ───────────────────────────────────────────── */}
      <div className="flex md:hidden items-center gap-2">
        {/* Nav: prev / label / next */}
        <button onClick={onPrev} className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 active:scale-95 transition-transform" aria-label="Previous">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center text-sm font-semibold text-[#42526E] bg-white border border-[#DFE1E6] rounded-lg py-2 px-2 truncate">
          {currentLabel}
        </div>
        <button onClick={onNext} className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 active:scale-95 transition-transform" aria-label="Next">
          <ChevronRight size={18} />
        </button>

        {/* View select */}
        <div className="relative">
          <select
            value={view}
            onChange={(e) => onViewChange(e.target.value as CalendarView)}
            className="h-9 appearance-none rounded-lg border border-[#DFE1E6] bg-white pl-2.5 pr-7 text-xs font-medium text-[#344563] outline-none"
          >
            <option value="month">Month</option>
            <option value="week">Week</option>
            <option value="agenda">Agenda</option>
          </select>
          <svg className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B778C]" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Filters button */}
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="relative flex items-center gap-1.5 h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 active:scale-95 transition-transform"
        >
          <SlidersHorizontal size={15} />
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#155DFC] text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Filter BottomSheet (mobile) ────────────────────────────────────── */}
      <BottomSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filters"
        snapPoint="full"
      >
        <div className="px-4 pb-8 pt-2 space-y-5">
          {/* Search */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Search</label>
            <input
              value={filters.search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search calendar…"
              className="w-full h-10 rounded-xl border border-[#DFE1E6] bg-[#FAFBFC] px-3 text-sm text-[#42526E] outline-none placeholder:text-[#6B778C] focus:border-[#4C9AFF]"
            />
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Assignee</label>
            <FilterDropdown
              label="Assignee"
              options={assigneeOptions}
              selected={filters.assignees}
              onChange={onAssigneesChange}
              searchablePlaceholder="Search assignee"
              widthClassName="w-full"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Type</label>
            <FilterDropdown
              label="Type"
              options={typeOptions}
              selected={filters.types}
              onChange={onTypesChange}
              searchablePlaceholder="Search Type"
              widthClassName="w-full"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
            <FilterDropdown
              label="Status"
              options={statusOptions}
              selected={filters.statuses}
              onChange={onStatusesChange}
              searchablePlaceholder="Search status"
              widthClassName="w-full"
            />
          </div>

          {/* More filters */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">More Filters</label>
            <FilterDropdown
              label="More filters"
              options={moreFilterOptions}
              selected={filters.moreFilters}
              onChange={onMoreFiltersChange}
              searchablePlaceholder="Search more filters"
              widthClassName="w-full"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => {
                onSearchChange('');
                onAssigneesChange([]);
                onTypesChange([]);
                onStatusesChange([]);
                onMoreFiltersChange([]);
              }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Clear All
            </button>
            <button
              onClick={() => setFilterSheetOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-[#155DFC] text-white text-sm font-semibold"
            >
              Apply
            </button>
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
