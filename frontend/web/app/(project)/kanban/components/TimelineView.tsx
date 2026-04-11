'use client';

import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isValid,
  isWeekend,
  parseISO,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Calendar, User, Flag, Clock3 } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
}

const DAY_COLUMN_WIDTH = 36;

const statusColors = {
  TODO: {
    bar: 'bg-slate-500/95 hover:bg-slate-600',
    badge: 'bg-slate-100 text-slate-700',
  },
  IN_PROGRESS: {
    bar: 'bg-blue-600/95 hover:bg-blue-700',
    badge: 'bg-blue-100 text-blue-700',
  },
  IN_REVIEW: {
    bar: 'bg-amber-500/95 hover:bg-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  DONE: {
    bar: 'bg-emerald-600/95 hover:bg-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
  },
};

const priorityColors = {
  LOW: 'ring-1 ring-emerald-300',
  MEDIUM: 'ring-1 ring-amber-300',
  HIGH: 'ring-1 ring-orange-300',
  URGENT: 'ring-1 ring-red-300',
};

interface TimelineTask extends Task {
  leftPx: number;
  widthPx: number;
  row: number;
  startDateObj: Date;
  dueDateObj: Date;
  durationDays: number;
}

function safeParseDate(value?: string) {
  if (!value) return null;
  const parsed = parseISO(value);
  if (!isValid(parsed)) return null;
  return startOfDay(parsed);
}

function statusLabel(status: string | null | undefined) {
  return (status ?? '').replace(/_/g, ' ');
}

export default function TimelineView({ tasks }: TimelineViewProps) {
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);

  const timelineData = useMemo(() => {
    const parsedTasks = tasks
      .map((task) => {
        const start = safeParseDate(task.startDate) ?? safeParseDate(task.createdAt) ?? safeParseDate(task.dueDate);
        const due = safeParseDate(task.dueDate) ?? start;
        if (!start || !due) return null;

        const startDateObj = start <= due ? start : due;
        const dueDateObj = start <= due ? due : start;

        return {
          ...task,
          startDateObj,
          dueDateObj,
        };
      })
      .filter((task): task is Task & { startDateObj: Date; dueDateObj: Date } => Boolean(task))
      .sort((a, b) => {
        const byStart = a.startDateObj.getTime() - b.startDateObj.getTime();
        if (byStart !== 0) return byStart;
        return a.dueDateObj.getTime() - b.dueDateObj.getTime();
      });

    if (parsedTasks.length === 0) {
      return {
        tasks: [],
        days: [],
        monthGroups: [] as Array<{ label: string; span: number }>,
        timelineStart: null as Date | null,
        timelineEnd: null as Date | null,
        timelineWidthPx: 0,
        todayOffset: -1,
      };
    }

    const minStart = parsedTasks.reduce((min, task) => (
      task.startDateObj < min ? task.startDateObj : min
    ), parsedTasks[0].startDateObj);
    const maxDue = parsedTasks.reduce((max, task) => (
      task.dueDateObj > max ? task.dueDateObj : max
    ), parsedTasks[0].dueDateObj);

    const timelineStart = startOfWeek(minStart, { weekStartsOn: 1 });
    const timelineEnd = endOfWeek(maxDue, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: timelineStart, end: timelineEnd });

    const monthGroups = days.reduce<Array<{ label: string; span: number }>>((acc, day) => {
      const label = format(day, 'MMM yyyy');
      const last = acc[acc.length - 1];
      if (last && last.label === label) {
        last.span += 1;
      } else {
        acc.push({ label, span: 1 });
      }
      return acc;
    }, []);

    const taskBars: TimelineTask[] = parsedTasks.map((task, index) => {
      const startOffset = differenceInCalendarDays(task.startDateObj, timelineStart);
      const durationDays = Math.max(differenceInCalendarDays(task.dueDateObj, task.startDateObj) + 1, 1);
      return {
        ...task,
        leftPx: startOffset * DAY_COLUMN_WIDTH,
        widthPx: Math.max(durationDays * DAY_COLUMN_WIDTH - 6, 26),
        row: index,
        durationDays,
      };
    });

    const today = startOfDay(new Date());
    const todayOffset = differenceInCalendarDays(today, timelineStart);

    return {
      tasks: taskBars,
      days,
      monthGroups,
      timelineStart,
      timelineEnd,
      timelineWidthPx: days.length * DAY_COLUMN_WIDTH,
      todayOffset,
    };
  }, [tasks]);

  const handleTaskClick = (task: TimelineTask) => {
    setSelectedTask(task);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT': return 'Critical';
      case 'HIGH': return 'High';
      case 'MEDIUM': return 'Medium';
      case 'LOW': return 'Low';
      default: return 'Normal';
    }
  };

  if (timelineData.tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Project Timeline</h2>
          <p className="text-sm text-slate-500 mt-1">Tasks are mapped from start date or creation date to due date.</p>
        </div>
        <div className="text-center py-16 text-slate-500 px-6">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="font-medium">No tasks with usable dates found</p>
          <p className="text-sm mt-2">Set due dates and optionally start dates. If start date is missing, created date is used.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/60">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800">Project Timeline</h2>
            <p className="text-sm text-slate-500 mt-1">Date-accurate schedule from start or created date to due date.</p>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600">
            <Clock3 className="w-3.5 h-3.5" />
            <span>
              {format(timelineData.timelineStart!, 'MMM d, yyyy')} - {format(timelineData.timelineEnd!, 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden">
        <div
          className="min-w-max"
          style={{ width: `${300 + timelineData.timelineWidthPx}px` }}
        >
          <div className="sticky top-0 z-20 bg-white">
            <div className="flex border-b border-slate-200">
              <div className="w-[300px] flex-shrink-0 px-4 py-3 bg-slate-50 border-r border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task</p>
              </div>
              <div className="flex" style={{ width: `${timelineData.timelineWidthPx}px` }}>
                {timelineData.monthGroups.map((group) => (
                  <div
                    key={group.label}
                    className="px-2 py-3 border-r border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"
                    style={{ width: `${group.span * DAY_COLUMN_WIDTH}px` }}
                  >
                    {group.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex border-b border-slate-200">
              <div className="w-[300px] flex-shrink-0 px-4 py-2 bg-slate-50 border-r border-slate-200" />
              <div className="flex" style={{ width: `${timelineData.timelineWidthPx}px` }}>
                {timelineData.days.map((day) => (
                  <div
                    key={`day-header-${day.toISOString()}`}
                    className={`h-10 border-r border-slate-100 text-[11px] flex flex-col items-center justify-center ${isWeekend(day) ? 'bg-slate-50/70 text-slate-500' : 'bg-white text-slate-600'}`}
                    style={{ width: `${DAY_COLUMN_WIDTH}px` }}
                  >
                    <span className="leading-none">{format(day, 'd')}</span>
                    <span className="text-[10px] leading-none mt-1 uppercase">{format(day, 'EEEEE')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="relative">
            {timelineData.tasks.map((task) => {
              const statusTheme = statusColors[task.status as keyof typeof statusColors] ?? statusColors.TODO;
              const priorityTheme = priorityColors[task.priority as keyof typeof priorityColors] ?? '';
              return (
              <div
                key={task.id}
                className="flex border-b border-slate-100 hover:bg-slate-50/40 transition-colors"
              >
                <div className="w-[300px] flex-shrink-0 p-3 border-r border-slate-200 bg-white sticky left-0 z-10">
                  <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusTheme.badge}`}>
                      {statusLabel(task.status)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                      {getPriorityIcon(task.priority)}
                    </span>
                    {task.assigneeName && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <User className="w-3 h-3" />
                        {task.assigneeName}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    {format(task.startDateObj, 'MMM d')} - {format(task.dueDateObj, 'MMM d')} ({task.durationDays}d)
                  </p>
                </div>

                <div className="relative" style={{ width: `${timelineData.timelineWidthPx}px`, height: '72px' }}>
                  {timelineData.days.map((day) => (
                    <div
                      key={`grid-${task.id}-${day.toISOString()}`}
                      className={`absolute top-0 h-full border-r border-slate-100 ${isWeekend(day) ? 'bg-slate-50/60' : 'bg-white'}`}
                      style={{
                        left: `${differenceInCalendarDays(day, timelineData.timelineStart!) * DAY_COLUMN_WIDTH}px`,
                        width: `${DAY_COLUMN_WIDTH}px`,
                      }}
                    />
                  ))}

                  {timelineData.todayOffset >= 0 && timelineData.todayOffset < timelineData.days.length && (
                    <div
                      className="absolute top-0 h-full w-[2px] bg-red-400/70 z-[5]"
                      style={{ left: `${timelineData.todayOffset * DAY_COLUMN_WIDTH}px` }}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleTaskClick(task)}
                    className={`absolute top-1/2 -translate-y-1/2 h-9 rounded-lg px-3 text-left text-white text-xs font-semibold shadow-sm transition-all hover:scale-[1.01] hover:shadow-md ${statusTheme.bar} ${priorityTheme}`}
                    style={{
                      left: `${task.leftPx + 3}px`,
                      width: `${task.widthPx}px`,
                    }}
                    title={`${task.title} (${format(task.startDateObj, 'MMM dd')} - ${format(task.dueDateObj, 'MMM dd')})`}
                  >
                    <span className="truncate block">{task.title}</span>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">{selectedTask.title}</h3>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-slate-600 mb-4">{selectedTask.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Start:</span>
                  <span className="font-medium">
                    {selectedTask.startDateObj ? (
                      format(selectedTask.startDateObj, 'MMM dd, yyyy')
                    ) : 'Not set'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Due:</span>
                  <span className="font-medium">
                    {selectedTask.dueDateObj ? (
                      format(selectedTask.dueDateObj, 'MMM dd, yyyy')
                    ) : 'Not set'}
                  </span>
                </div>

                {selectedTask.assigneeName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-600">Assignee:</span>
                    <span className="font-medium">{selectedTask.assigneeName}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Flag className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedTask.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' :
                    selectedTask.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    selectedTask.status === 'IN_REVIEW' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {statusLabel(selectedTask.status)}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock3 className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Duration:</span>
                  <span className="font-medium">{selectedTask.durationDays} day(s)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}