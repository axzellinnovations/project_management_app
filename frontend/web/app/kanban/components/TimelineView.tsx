'use client';

import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO, isBefore, isAfter, isWithinInterval } from 'date-fns';
import { Calendar, User, Flag, X } from 'lucide-react';

interface TimelineViewProps {
  tasks: Task[];
  onTaskUpdate: (taskId: number, updates: Partial<Task>) => void;
  projectId: number;
}

const statusColors = {
  TODO: 'bg-gray-400 hover:bg-gray-500',
  IN_PROGRESS: 'bg-blue-500 hover:bg-blue-600',
  IN_REVIEW: 'bg-yellow-500 hover:bg-yellow-600',
  DONE: 'bg-green-500 hover:bg-green-600',
};

const priorityColors = {
  LOW: 'border-l-green-500',
  MEDIUM: 'border-l-yellow-500',
  HIGH: 'border-l-orange-500',
  URGENT: 'border-l-red-500',
};

const PIXELS_PER_DAY = 16; // Pixels per day for consistent scaling

interface TimelineTask extends Task {
  startDateObj: Date;
  dueDateObj: Date;
}

export default function TimelineView({ tasks, onTaskUpdate, projectId }: TimelineViewProps) {
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);

  const timelineData = useMemo(() => {
    const validTasks = tasks.filter(t => t.startDate && t.dueDate);
    if (validTasks.length === 0) return { months: [], tasks: [], timelineWidth: 0 };

    const dates = validTasks.flatMap(t => [parseISO(t.startDate!), parseISO(t.dueDate!)]);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Start one month before, end one month after
    let startMonth = startOfMonth(minDate);
    if (minDate.getDate() > 1 || minDate > startOfMonth(minDate)) {
      startMonth = startOfMonth(addMonths(minDate, -1));
    }
    
    let endMonth = endOfMonth(addMonths(maxDate, 1));

    // Calculate all months in the range
    const months = [];
    let current = new Date(startMonth);
    while (current <= endMonth) {
      months.push({
        date: new Date(current),
        start: startOfMonth(current),
        end: endOfMonth(current),
        daysInMonth: endOfMonth(current).getDate()
      });
      current = addMonths(current, 1);
    }

    // Calculate timeline width
    const totalDays = differenceInDays(endOfMonth(endMonth), startMonth) + 1;
    const timelineWidth = totalDays * PIXELS_PER_DAY;

    // Position tasks
    const taskBars: (TimelineTask & { leftPx: number; widthPx: number; row: number })[] = validTasks.map((task, index) => {
      const start = parseISO(task.startDate!);
      const end = parseISO(task.dueDate!);
      
      // Calculate position from timeline start
      const daysFromStart = differenceInDays(start, startMonth);
      const durationDays = Math.max(differenceInDays(end, start) + 1, 1); // Include both start and end date
      
      return {
        ...task,
        startDateObj: start,
        dueDateObj: end,
        leftPx: daysFromStart * PIXELS_PER_DAY,
        widthPx: durationDays * PIXELS_PER_DAY,
        row: index
      };
    });

    return { months, tasks: taskBars, timelineWidth, startMonth };
  }, [tasks]);

  const getPriorityIcon = (priority?: string) => {
    switch (priority?.toUpperCase()) {
      case 'URGENT': return '🔴';
      case 'HIGH': return '🟠';
      case 'MEDIUM': return '🟡';
      case 'LOW': return '🟢';
      default: return '⚪';
    }
  };

  if (timelineData.tasks.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Timeline View</h2>
        <div className="text-center py-12 text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No tasks with dates to display in timeline</p>
          <p className="text-sm mt-2">Add start and due dates to your tasks to see them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-6">Timeline View</h2>

      {/* Scrollable Timeline Container */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg bg-gray-50">
        {/* Month Headers */}
        <div className="flex sticky top-0 z-20 bg-gray-100 border-b">
          <div className="flex-shrink-0 w-64 p-3 border-r border-gray-300 bg-white font-semibold text-sm">
            Tasks
          </div>
          <div className="flex" style={{ width: `${timelineData.timelineWidth}px` }}>
            {timelineData.months.map((month, idx) => (
              <div
                key={idx}
                className="border-r border-gray-300 p-3 text-sm font-semibold text-gray-700"
                style={{ width: `${month.daysInMonth * PIXELS_PER_DAY}px` }}
              >
                {format(month.date, 'MMM yyyy')}
              </div>
            ))}
          </div>
        </div>

        {/* Task Rows */}
        <div>
          {timelineData.tasks.map((task) => (
            <div
              key={task.id}
              className="flex border-b border-gray-200 hover:bg-blue-50 transition-colors"
            >
              {/* Task Name Column */}
              <div className="flex-shrink-0 w-64 p-3 border-r border-gray-200 bg-white">
                <button
                  onClick={() => setSelectedTask(task)}
                  className="text-left hover:text-blue-600 truncate font-medium text-sm text-gray-800"
                  title={task.title}
                >
                  <span className="mr-2">{getPriorityIcon(task.priority)}</span>
                  {task.title}
                </button>
              </div>

              {/* Timeline Bar */}
              <div
                className="relative bg-white"
                style={{ width: `${timelineData.timelineWidth}px`, minHeight: '60px' }}
              >
                {/* Task Bar */}
                <div
                  className={`absolute top-3 h-12 rounded-md ${statusColors[task.status as keyof typeof statusColors] || 'bg-gray-400'} cursor-pointer transition-all hover:shadow-lg border-l-4 ${priorityColors[task.priority as keyof typeof priorityColors] || 'border-l-gray-400'} flex items-center px-3 text-white text-xs font-medium overflow-hidden whitespace-nowrap`}
                  style={{
                    left: `${task.leftPx}px`,
                    width: `${Math.max(task.widthPx, 80)}px`,
                    minWidth: '80px'
                  }}
                  onClick={() => setSelectedTask(task)}
                  title={`${task.title}\n${format(task.startDateObj, 'MMM dd')} - ${format(task.dueDateObj, 'MMM dd')}`}
                >
                  <span className="truncate">
                    {task.title}
                    {task.assignee && ` • ${task.assignee.name.split(' ')[0]}`}
                  </span>
                </div>

                {/* Date Grid Lines (optional - for better visual alignment) */}
                {timelineData.startMonth && timelineData.months.map((month, idx) => (
                  <div
                    key={`grid-${idx}`}
                    className="absolute top-0 bottom-0 border-r border-gray-100"
                    style={{
                      left: `${month.daysInMonth * PIXELS_PER_DAY * idx + differenceInDays(month.start, timelineData.startMonth!) * PIXELS_PER_DAY}px`
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <span>{getPriorityIcon(selectedTask.priority)}</span>
                  {selectedTask.title}
                </h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-gray-600 mb-4 text-sm">{selectedTask.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">Start:</span>
                  <span className="font-medium">
                    {format(selectedTask.startDateObj, 'MMM dd, yyyy')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">Due:</span>
                  <span className="font-medium">
                    {format(selectedTask.dueDateObj, 'MMM dd, yyyy')}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">
                    {differenceInDays(selectedTask.dueDateObj, selectedTask.startDateObj) + 1} days
                  </span>
                </div>

                {selectedTask.assignee && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-600">Assignee:</span>
                    <span className="font-medium">{selectedTask.assignee.name}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Flag className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedTask.status === 'DONE' ? 'bg-green-100 text-green-800' :
                    selectedTask.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    selectedTask.status === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedTask.status.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t">
                <button
                  onClick={() => setSelectedTask(null)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}