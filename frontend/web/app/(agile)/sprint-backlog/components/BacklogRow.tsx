'use client';

import { useState } from 'react';
import { MoreVertical } from 'lucide-react';

interface BacklogRowProps {
  title: string;
  assignee?: string;
  storyPoints?: number;
  status?: 'todo' | 'inprogress' | 'review' | 'done';
  index: number;
  onStatusChange?: (status: 'todo' | 'inprogress' | 'review' | 'done') => void;
  onStoryPointsChange?: (points: number) => void;
  onDelete?: () => void;
}

export default function BacklogRow({
  title,
  assignee,
  storyPoints = 0,
  status = 'todo',
  index,
  onStatusChange,
  onStoryPointsChange,
  onDelete,
}: BacklogRowProps) {
  const [taskStatus, setTaskStatus] = useState(status);
  const [points, setPoints] = useState(storyPoints);
  const [showMenu, setShowMenu] = useState(false);
  const [priority, setPriority] = useState('Medium');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [subtasks, setSubtasks] = useState('');

  const handleStatus = (value: 'todo' | 'inprogress' | 'review' | 'done') => {
    setTaskStatus(value);
    onStatusChange?.(value);
  };

  const handlePoints = (value: number) => {
    setPoints(value);
    onStoryPointsChange?.(value);
  };

  return (
    <div className="relative flex items-center justify-between border-b px-4 py-3 hover:bg-gray-50">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-800">
          {index + 1}. {title}
        </span>
        <span className="text-xs text-gray-500">
          Assignee: {assignee || 'Unassigned'}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">SP</label>
          <input
            type="number"
            min="0"
            value={points}
            onChange={(e) => handlePoints(Number(e.target.value))}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </div>

        <select
          value={taskStatus}
          onChange={(e) =>
            handleStatus(
              e.target.value as 'todo' | 'inprogress' | 'review' | 'done'
            )
          }
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="todo">To Do</option>
          <option value="inprogress">In Progress</option>
          <option value="review">In Review</option>
          <option value="done">Done</option>
        </select>

        <button
          onClick={() => setShowMenu(!showMenu)}
          className="rounded p-2 hover:bg-gray-200"
        >
          <MoreVertical size={18} />
        </button>
      </div>

      {showMenu && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <h4 className="mb-3 text-sm font-semibold text-gray-700">
            Task Options
          </h4>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-600">Subtasks</label>
            <input
              type="text"
              value={subtasks}
              onChange={(e) => setSubtasks(e.target.value)}
              className="w-full rounded-md border px-2 py-1 text-sm"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-600">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border px-2 py-1 text-sm"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-600">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border px-2 py-1 text-sm"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-gray-600">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border px-2 py-1 text-sm"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <button
            onClick={onDelete}
            className="w-full rounded-md bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600"
          >
            Delete Task
          </button>
        </div>
      )}
    </div>
  );
}