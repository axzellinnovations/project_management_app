'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, type PanInfo } from 'framer-motion';
import { useBreakpoint } from '@/lib/useBreakpoint';
import CalendarToolbar from './components/CalendarToolbar';
import MonthCalendarView from './components/MonthCalendarView';
import WeekCalendarView from './components/WeekCalendarView';
import AgendaCalendarView from './components/AgendaCalendarView';
import { fetchCalendarEvents } from './api';
import type { CalendarEventItem, CalendarFilters, CalendarView } from './types';
import { addDays, addMonths, formatMonthLabel, formatWeekLabel } from './utils/date';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { patchTaskDates } from './api';

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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [prefilledDate, setPrefilledDate] = useState<string | undefined>(undefined);

  const loadEvents = async () => {
    if (!projectId) return;
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

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      return;
    }
    void loadEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const { isMobile } = useBreakpoint();

  const handlePanEnd = (_: unknown, info: PanInfo) => {
    if (!isMobile) return;
    if (info.offset.x < -60) handleNext();
    else if (info.offset.x > 60) handlePrev();
  };

  const handleDayClick = (date: Date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    setPrefilledDate(`${yyyy}-${mm}-${dd}`);
    setShowCreateModal(true);
  };

  const handleCreateTask = async (data: CreateTaskData) => {
    if (!projectId) return;
    await import('@/lib/axios').then(({ default: api }) =>
      api.post('/api/tasks', {
        projectId: parseInt(projectId, 10),
        title: data.title,
        priority: data.priority,
        storyPoint: data.storyPoint,
        assigneeId: data.assigneeId,
        labelIds: data.labelIds,
        dueDate: data.dueDate,
      })
    );
    void loadEvents();
  };

  const handleEventDrop = async (eventId: string, newDate: Date) => {
    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, '0');
    const dd = String(newDate.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const event = events.find((e) => e.id === eventId);
    if (!event?.taskId) return;

    // Optimistic update
    setEvents((prev) =>
      prev.map((e) =>
        e.id === eventId
          ? { ...e, startDate: dateStr, dueDate: dateStr, endDate: dateStr }
          : e
      )
    );

    try {
      await patchTaskDates(event.taskId, dateStr, dateStr);
    } catch {
      // Revert on failure
      void loadEvents();
    }
  };

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
        <motion.div onPanEnd={handlePanEnd} className="touch-pan-y">
          {view === 'month' && <MonthCalendarView currentDate={currentDate} events={filteredEvents} onDayClick={handleDayClick} onEventDrop={handleEventDrop} />}
          {view === 'week' && <WeekCalendarView currentDate={currentDate} events={filteredEvents} onDayClick={handleDayClick} onEventDrop={handleEventDrop} />}
          {view === 'agenda' && <AgendaCalendarView currentDate={currentDate} events={filteredEvents} />}
        </motion.div>
      )}

      {showCreateModal && projectId && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => { setShowCreateModal(false); setPrefilledDate(undefined); }}
          onCreateTask={handleCreateTask}
          projectId={parseInt(projectId, 10)}
          initialDueDate={prefilledDate}
        />
      )}
    </div>
  );
}
