'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CalendarToolbar from './components/CalendarToolbar';
import MonthCalendarView from './components/MonthCalendarView';
import WeekCalendarView from './components/WeekCalendarView';
import AgendaCalendarView from './components/AgendaCalendarView';
import { fetchCalendarEvents } from './api';
import type { CalendarEventItem, CalendarFilters, CalendarView } from './types';
import { addDays, addMonths, formatMonthLabel, formatWeekLabel } from './utils/date';

const DEFAULT_FILTERS: CalendarFilters = {
  search: '',
  assignees: [],
  types: [],
  statuses: [],
  moreFilters: [],
};

const TYPE_OPTIONS = [
  'All standard work types',
  'All sub-tasks',
  'Standard work types',
  'Epic',
  'Bug',
  'Story',
  'Task',
  'Subtask',
  'Show full list',
];

const STATUS_OPTIONS = ['Planned', 'Active', 'Completed', 'To Do', 'In Progress', 'Done'];

const MORE_FILTER_OPTIONS = [
  'Attachment',
  'Comment',
  'Created',
  'Creator',
  'Description',
  'Design',
  'Development',
  'Due date',
  'Environment',
];

const normalize = (value?: string) => (value || '').trim().toLowerCase();

const includesByNormalize = (values: string[], target?: string) => {
  if (values.length === 0) return true;
  const n = normalize(target);
  return values.some((item) => normalize(item) === n);
};

const evaluateMoreFilter = (event: CalendarEventItem, selectedMoreFilter: string) => {
  switch (normalize(selectedMoreFilter)) {
    case 'attachment':
      return Boolean(event.hasAttachment);
    case 'comment':
      return Boolean(event.hasComment);
    case 'creator':
    case 'created':
      return Boolean(event.creator);
    case 'description':
      return Boolean(event.description);
    case 'environment':
      return Boolean(event.environment);
    case 'design':
      return normalize(event.environment) === 'design';
    case 'development':
      return normalize(event.environment) === 'development';
    case 'due date':
      return Boolean(event.dueDate);
    default:
      return true;
  }
};

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filters, setFilters] = useState<CalendarFilters>(DEFAULT_FILTERS);

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await fetchCalendarEvents(projectId);
        setEvents(result);
      } catch {
        setError('Failed to load calendar events.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [projectId]);

  const assigneeOptions = useMemo(() => {
    const uniqueAssignees = Array.from(
      new Set(events.map((event) => event.assignee).filter((value): value is string => Boolean(value)))
    );
    return ['All assignees', ...uniqueAssignees];
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filters.search.trim()) {
        const q = normalize(filters.search);
        const hit = [event.title, event.description, event.assignee, event.status, event.type]
          .filter(Boolean)
          .some((field) => normalize(field).includes(q));
        if (!hit) return false;
      }

      if (!includesByNormalize(filters.assignees, event.assignee)) return false;
      if (!includesByNormalize(filters.types.filter((item) => !item.toLowerCase().includes('all') && item !== 'Show full list' && item !== 'Standard work types'), event.type || event.kind)) return false;
      if (!includesByNormalize(filters.statuses, event.status)) return false;

      if (filters.moreFilters.length > 0) {
        const allMatch = filters.moreFilters.every((item) => evaluateMoreFilter(event, item));
        if (!allMatch) return false;
      }

      return true;
    });
  }, [events, filters]);

  const currentLabel = useMemo(() => {
    if (view === 'month') return formatMonthLabel(currentDate);
    if (view === 'week') return formatWeekLabel(currentDate);

    const end = addDays(currentDate, 13);
    const left = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const right = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${left} - ${right}`;
  }, [currentDate, view]);

  const handlePrev = () => {
    if (view === 'month') {
      setCurrentDate((prev) => addMonths(prev, -1));
      return;
    }
    if (view === 'week') {
      setCurrentDate((prev) => addDays(prev, -7));
      return;
    }
    setCurrentDate((prev) => addDays(prev, -14));
  };

  const handleNext = () => {
    if (view === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
      return;
    }
    if (view === 'week') {
      setCurrentDate((prev) => addDays(prev, 7));
      return;
    }
    setCurrentDate((prev) => addDays(prev, 14));
  };

  const handleToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-[#101828]">Calendar</h1>
        <p className="text-sm text-[#667085]">Track sprints and work items in month, week, and agenda formats.</p>
      </div>

      <CalendarToolbar
        view={view}
        currentLabel={currentLabel}
        filters={filters}
        assigneeOptions={assigneeOptions}
        typeOptions={TYPE_OPTIONS}
        statusOptions={STATUS_OPTIONS}
        moreFilterOptions={MORE_FILTER_OPTIONS}
        onViewChange={setView}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onSearchChange={(value) => setFilters((prev) => ({ ...prev, search: value }))}
        onAssigneesChange={(values) => setFilters((prev) => ({ ...prev, assignees: values }))}
        onTypesChange={(values) => setFilters((prev) => ({ ...prev, types: values }))}
        onStatusesChange={(values) => setFilters((prev) => ({ ...prev, statuses: values }))}
        onMoreFiltersChange={(values) => setFilters((prev) => ({ ...prev, moreFilters: values }))}
      />

      {loading && <div className="rounded-lg border border-[#E4E7EC] bg-white p-6 text-sm text-[#667085]">Loading calendar events...</div>}
      {!loading && error && <div className="rounded-lg border border-[#FECDCA] bg-[#FEF3F2] p-6 text-sm text-[#B42318]">{error}</div>}

      {!loading && !error && (
        <>
          {view === 'month' && <MonthCalendarView currentDate={currentDate} events={filteredEvents} />}
          {view === 'week' && <WeekCalendarView currentDate={currentDate} events={filteredEvents} />}
          {view === 'agenda' && <AgendaCalendarView currentDate={currentDate} events={filteredEvents} />}
        </>
      )}
    </div>
  );
}
