'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isValid,
  isWeekend,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Calendar, User } from 'lucide-react';
import TimelineControls from './TimelineControls';
import TimelineTaskRow, { TimelineTask } from './TimelineTaskRow';
import { useTimelineDrag } from '../hooks/useTimelineDrag';

export interface Milestone {
  id: number;
  name: string;
  dueDate?: string;
  status: string;
}

interface TimelineViewProps {
  tasks: Task[];
  onOpenTask?: (taskId: number) => void;
  onTaskUpdated?: (taskId: number, updates: Partial<Task>) => void;
  milestones?: Milestone[];
}

const ZOOM_WIDTHS: Record<string, number> = { Day: 36, Week: 20, Month: 14 };
type ZoomLevel = 'Day' | 'Week' | 'Month';
type GroupByType = 'none' | 'status' | 'assignee';

const statusColors = {
  TODO: { badge: 'bg-slate-100 text-slate-700' },
  IN_PROGRESS: { badge: 'bg-blue-100 text-blue-700' },
  IN_REVIEW: { badge: 'bg-amber-100 text-amber-700' },
  DONE: { badge: 'bg-emerald-100 text-emerald-700' },
};

function safeParseDate(value?: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return startOfDay(parsed);
}

function statusLabel(status: string | null | undefined) {
  return (status ?? '').replace(/_/g, ' ');
}

export default function TimelineView({ tasks, onOpenTask, onTaskUpdated, milestones = [] }: TimelineViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>('Day');
  const [groupBy, setGroupBy] = useState<GroupByType>('none');
  const [hideWeekends, setHideWeekends] = useState(false);
  const [filterAssignee, setFilterAssignee] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [localTasks, setLocalTasks] = useState<Task[]>([]);
  useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  const dayColumnWidth = ZOOM_WIDTHS[zoom];

  const { activeDrag, dragOffset, startDrag } = useTimelineDrag(dayColumnWidth, onTaskUpdated, setLocalTasks);

  const assigneeNames = useMemo(() => {
    const names = new Set<string>();
    tasks.forEach(t => { if (t.assigneeName) names.add(t.assigneeName); });
    return [...names].sort();
  }, [tasks]);

  const effectiveTasks = useMemo(() => {
    if (!filterAssignee) return localTasks;
    return localTasks.filter(t => t.assigneeName === filterAssignee);
  }, [localTasks, filterAssignee]);

  // ── Compute timeline data ─────────────────────────────────────────────────
  const { timelineTasks, noDatesToShow, visibleDays, monthGroups, timelineStart, timelineEnd, timelineWidthPx, todayOffset } = useMemo(() => {
    const noDates: Task[] = [];
    const parsedTasks: Array<Task & { startDateObj: Date; dueDateObj: Date }> = [];

    effectiveTasks.forEach(task => {
      const start = safeParseDate(task.startDate) ?? safeParseDate(task.createdAt) ?? safeParseDate(task.dueDate);
      const due = safeParseDate(task.dueDate) ?? start;
      if (!start || !due) { noDates.push(task); return; }
      parsedTasks.push({ ...task, startDateObj: start <= due ? start : due, dueDateObj: start <= due ? due : start });
    });

    parsedTasks.sort((a, b) => a.startDateObj.getTime() - b.startDateObj.getTime() || a.dueDateObj.getTime() - b.dueDateObj.getTime());

    if (parsedTasks.length === 0) {
      return { timelineTasks: [] as TimelineTask[], noDatesToShow: noDates, visibleDays: [] as Date[], monthGroups: [] as Array<{ label: string; span: number }>, timelineStart: null, timelineEnd: null, timelineWidthPx: 0, todayOffset: -1 };
    }

    const minStart = parsedTasks.reduce((m, t) => t.startDateObj < m ? t.startDateObj : m, parsedTasks[0].startDateObj);
    const maxDue = parsedTasks.reduce((m, t) => t.dueDateObj > m ? t.dueDateObj : m, parsedTasks[0].dueDateObj);
    const timelineStart = startOfWeek(minStart, { weekStartsOn: 1 });
    const timelineEnd = endOfWeek(maxDue, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: timelineStart, end: timelineEnd });
    const visibleDays = hideWeekends ? days.filter(d => !isWeekend(d)) : days;

    const dayIndexMap = new Map<string, number>();
    visibleDays.forEach((d, i) => dayIndexMap.set(format(d, 'yyyy-MM-dd'), i));

    const monthGroups = visibleDays.reduce<Array<{ label: string; span: number }>>((acc, day) => {
      const label = format(day, 'MMM yyyy');
      const last = acc[acc.length - 1];
      if (last && last.label === label) last.span += 1; else acc.push({ label, span: 1 });
      return acc;
    }, []);

    const timelineTasks: TimelineTask[] = parsedTasks.map((task, i) => {
      const startKey = format(task.startDateObj, 'yyyy-MM-dd');
      const dueKey = format(task.dueDateObj, 'yyyy-MM-dd');
      let startIdx = dayIndexMap.get(startKey) ?? 0;
      let endIdx = dayIndexMap.get(dueKey) ?? startIdx;
      if (!dayIndexMap.has(startKey)) {
        for (let d = 0; d < visibleDays.length; d++) {
          if (visibleDays[d] >= task.startDateObj) { startIdx = d; break; }
        }
      }
      if (!dayIndexMap.has(dueKey)) {
        for (let d = visibleDays.length - 1; d >= 0; d--) {
          if (visibleDays[d] <= task.dueDateObj) { endIdx = d; break; }
        }
      }
      const duration = Math.max(endIdx - startIdx + 1, 1);
      const startOffset = startIdx;

      let previewStartOffset = startOffset;
      let previewDuration = duration;
      if (activeDrag?.taskId === task.id && dragOffset !== 0) {
        if (activeDrag.type === 'move') {
          previewStartOffset = startOffset + dragOffset;
        } else {
          previewDuration = Math.max(duration + dragOffset, 1);
        }
      }

      return {
        ...task,
        leftPx: previewStartOffset * dayColumnWidth,
        widthPx: Math.max(previewDuration * dayColumnWidth - 6, 26),
        row: i,
        durationDays: duration,
      };
    });

    const today = startOfDay(new Date());
    const todayKey = format(today, 'yyyy-MM-dd');
    const todayOffset = dayIndexMap.get(todayKey) ?? -1;

    return { timelineTasks, noDatesToShow: noDates, visibleDays, monthGroups, timelineStart, timelineEnd, timelineWidthPx: visibleDays.length * dayColumnWidth, todayOffset };
  }, [effectiveTasks, dayColumnWidth, activeDrag, dragOffset, hideWeekends]);

  const groupedTaskRows = useMemo(() => {
    if (groupBy === 'none') return [{ label: '', tasks: timelineTasks }];
    if (groupBy === 'status') {
      const map = new Map<string, TimelineTask[]>();
      timelineTasks.forEach(t => { const k = t.status; if (!map.has(k)) map.set(k, []); map.get(k)!.push(t); });
      return [...map.entries()].map(([label, tasks]) => ({ label: label.replace(/_/g, ' '), tasks }));
    }
    const map = new Map<string, TimelineTask[]>();
    timelineTasks.forEach(t => { const k = t.assigneeName || 'Unassigned'; if (!map.has(k)) map.set(k, []); map.get(k)!.push(t); });
    return [...map.entries()].map(([label, tasks]) => ({ label, tasks }));
  }, [timelineTasks, groupBy]);

  if (timelineTasks.length === 0 && noDatesToShow.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Project Timeline</h2>
          <p className="text-sm text-slate-500 mt-1">Tasks are mapped from start date to due date.</p>
        </div>
        <div className="text-center py-16 text-slate-500 px-6">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">No tasks with usable dates found</p>
          <p className="text-sm mt-2">Set due dates and optionally start dates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <TimelineControls
        zoom={zoom} setZoom={setZoom}
        groupBy={groupBy} setGroupBy={setGroupBy}
        hideWeekends={hideWeekends} setHideWeekends={setHideWeekends}
        filterAssignee={filterAssignee} setFilterAssignee={setFilterAssignee}
        assigneeNames={assigneeNames}
        todayOffset={todayOffset} dayColumnWidth={dayColumnWidth}
        scrollContainerRef={scrollContainerRef}
        timelineStart={timelineStart} timelineEnd={timelineEnd}
      />

      <div ref={scrollContainerRef} className="overflow-x-auto overflow-y-hidden" style={{ cursor: activeDrag ? 'grabbing' : undefined }}>
        <div className="min-w-max" style={{ width: `${300 + timelineWidthPx}px` }}>
          {/* Column headers */}
          <div className="sticky top-0 z-20 bg-white">
            <div className="flex border-b border-slate-200">
              <div className="w-[300px] flex-shrink-0 px-4 py-3 bg-slate-50 border-r border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task</p>
              </div>
              <div className="flex" style={{ width: `${timelineWidthPx}px` }}>
                {monthGroups.map((group) => (
                  <div key={group.label} className="px-2 py-3 border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600" style={{ width: `${group.span * dayColumnWidth}px` }}>
                    {group.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <div className="w-[300px] flex-shrink-0 px-4 py-2 bg-slate-50 border-r border-slate-200" />
              <div className="flex" style={{ width: `${timelineWidthPx}px` }}>
                {visibleDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={`h-10 border-r border-slate-100 text-[11px] flex flex-col items-center justify-center ${isWeekend(day) ? 'bg-slate-50/70 text-slate-500' : 'bg-white text-slate-600'}`}
                    style={{ width: `${dayColumnWidth}px` }}
                  >
                    {zoom !== 'Month' && <span className="leading-none">{format(day, 'd')}</span>}
                    {zoom === 'Day' && <span className="text-[10px] leading-none mt-1 uppercase">{format(day, 'EEEEE')}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Task rows by group */}
          {groupedTaskRows.map((group) => (
            <div key={group.label || 'all'}>
              {group.label && (
                <div className="flex border-b border-slate-200 bg-slate-50/70">
                  <div className="w-full px-4 py-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</p>
                  </div>
                </div>
              )}

              <div className="relative">
                {group.tasks.map((task) => (
                  <TimelineTaskRow
                    key={task.id}
                    task={task}
                    visibleDays={visibleDays}
                    dayColumnWidth={dayColumnWidth}
                    timelineWidthPx={timelineWidthPx}
                    todayOffset={todayOffset}
                    milestones={milestones}
                    isDragging={activeDrag?.taskId === task.id}
                    onOpenTask={onOpenTask}
                    onStartDragMove={(e, t) => startDrag(e, t, 'move')}
                    onStartDragResize={(e, t) => startDrag(e, t, 'resize')}
                    activeDragTaskId={activeDrag?.taskId}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Tasks without dates section */}
          {noDatesToShow.length > 0 && (
            <div className="border-t border-slate-200 mt-2">
              <div className="flex border-b border-slate-200 bg-amber-50/60">
                <div className="w-full px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
                    Tasks without dates ({noDatesToShow.length})
                  </p>
                </div>
              </div>
              {noDatesToShow.map(task => {
                const statusTheme = statusColors[task.status as keyof typeof statusColors] ?? statusColors.TODO;
                return (
                  <div
                    key={task.id}
                    className="flex border-b border-slate-100 hover:bg-slate-50/40 transition-colors cursor-pointer"
                    onClick={() => onOpenTask?.(task.id)}
                  >
                    <div className="w-[300px] flex-shrink-0 p-3 border-r border-slate-200">
                      <p className="text-sm font-medium text-slate-700 truncate">{task.title}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusTheme.badge}`}>{statusLabel(task.status)}</span>
                        {task.assigneeName && (
                          <span className="text-[11px] text-slate-400 inline-flex items-center gap-1"><User className="w-3 h-3" />{task.assigneeName}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 px-4 py-3 flex items-center">
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">No dates set</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
