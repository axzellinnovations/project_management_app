'use client';

import React, { useMemo, useState } from 'react';
import { Task } from '../types';
import { format, addMonths, startOfMonth, endOfMonth, differenceInDays, parseISO, addDays } from 'date-fns';
import { Calendar, User, Flag } from 'lucide-react';

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

interface TimelineTask extends Task {
  left: string;
  width: string;
  row: number;
  startDateObj: Date;
  dueDateObj: Date;
}

export default function TimelineView({ tasks, onTaskUpdate, projectId }: TimelineViewProps) {
  const [selectedTask, setSelectedTask] = useState<TimelineTask | null>(null);

  const timelineData = useMemo(() => {
    const validTasks = tasks.filter(t => t.startDate && t.dueDate);
    if (validTasks.length === 0) return { months: [], tasks: [], totalDays: 0, startDate: null };

    const dates = validTasks.flatMap(t => [parseISO(t.startDate!), parseISO(t.dueDate!)]);
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    const startMonth = startOfMonth(addMonths(minDate, -1));
    const endMonth = endOfMonth(addMonths(maxDate, 1));

    const months = [];
    let current = startMonth;
    while (current <= endMonth) {
      months.push(current);
      current = addMonths(current, 1);
    }

    const totalDays = differenceInDays(endMonth, startMonth);

    const taskBars: TimelineTask[] = validTasks.map((task, index) => {
      const start = parseISO(task.startDate!);
      const end = parseISO(task.dueDate!);
      const left = (differenceInDays(start, startMonth) / totalDays) * 100;
      const width = Math.max((differenceInDays(end, start) / totalDays) * 100, 2); // Minimum width
      return {
        ...task,
        left: `${left}%`,
        width: `${width}%`,
        row: index,
        startDateObj: start,
        dueDateObj: end
      };
    });

    return { months, tasks: taskBars, totalDays, startDate: startMonth };
  }, [tasks]);

  const handleTaskClick = (task: TimelineTask) => {
    setSelectedTask(task);
  };

  const handleCloseModal = () => {
    setSelectedTask(null);
  };

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
      <h2 className="text-xl font-bold mb-4">Timeline View</h2>

      {/* Timeline Header */}
      <div className="overflow-x-auto border rounded-lg">
        <div className="flex bg-gray-50 border-b" style={{ width: `${timelineData.months.length * 200}px` }}>
          {timelineData.months.map((month, index) => (
            <div key={index} className="flex-shrink-0 w-48 p-3 border-r border-gray-200">
              <div className="text-sm font-semibold text-gray-700">{format(month, 'MMM yyyy')}</div>
              <div className="text-xs text-gray-500 mt-1">Week {Math.ceil((month.getDate() + month.getDay()) / 7)}</div>
            </div>
          ))}
        </div>

        {/* Timeline Grid */}
        <div className="relative" style={{ height: `${timelineData.tasks.length * 60 + 40}px` }}>
          {/* Task Bars */}
          {timelineData.tasks.map((task) => (
            <div
              key={task.id}
              className={`absolute rounded-md ${statusColors[task.status as keyof typeof statusColors] || 'bg-gray-400'} cursor-pointer transition-all hover:shadow-lg border-l-4 ${priorityColors[task.priority as keyof typeof priorityColors] || 'border-l-gray-400'} flex items-center px-3 text-white text-sm font-medium overflow-hidden`}
              style={{
                left: task.left,
                width: task.width,
                top: `${task.row * 60 + 20}px`,
                height: '40px',
                minWidth: '120px'
              }}
              onClick={() => handleTaskClick(task)}
              title={`${task.title} (${format(task.startDateObj, 'MMM dd')} - ${format(task.dueDateObj, 'MMM dd')})`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs">{getPriorityIcon(task.priority)}</span>
                <span className="truncate">{task.title}</span>
                {task.assigneeName && (
                  <span className="text-xs opacity-75">({task.assigneeName})</span>
                )}
              </div>
            </div>
          ))}

          {/* Task Labels */}
          <div className="absolute left-0 top-0 w-32">
            {timelineData.tasks.map((task, index) => (
              <div
                key={`label-${task.id}`}
                className="absolute text-xs text-gray-600 font-medium truncate px-2"
                style={{ top: `${index * 60 + 30}px`, width: '120px' }}
              >
                {task.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-gray-600 mb-4">{selectedTask.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Start:</span>
                  <span className="font-medium">
                    {selectedTask.startDateObj ? (
                      format(selectedTask.startDateObj, 'MMM dd, yyyy')
                    ) : 'Not set'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Due:</span>
                  <span className="font-medium">
                    {selectedTask.dueDateObj ? (
                      format(selectedTask.dueDateObj, 'MMM dd, yyyy')
                    ) : 'Not set'}
                  </span>
                </div>

                {selectedTask.assigneeName && (
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-600">Assignee:</span>
                    <span className="font-medium">{selectedTask.assigneeName}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Flag className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    selectedTask.status === 'DONE' ? 'bg-green-100 text-green-800' :
                    selectedTask.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                    selectedTask.status === 'IN_REVIEW' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedTask.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}