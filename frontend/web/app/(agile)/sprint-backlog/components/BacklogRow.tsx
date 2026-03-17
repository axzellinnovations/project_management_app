'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronDown,
  MoreHorizontal,
  UserCircle2,
} from 'lucide-react';

interface TeamMember {
  id: number;
  name: string;
  email?: string;
}

interface BacklogRowProps {
  title: string;
  assigneeId?: number;
  assigneeName?: string;
  assignees: TeamMember[];
  storyPoints?: number;
  status?: 'todo' | 'inprogress' | 'done' | 'blocked';
  startDate?: string;
  endDate?: string;
  index: number;
  onStatusChange?: (status: 'todo' | 'inprogress' | 'done' | 'blocked') => void;
  onStoryPointsChange?: (points: number) => void;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  onAssigneeChange?: (assigneeId: number) => void;
  onDelete?: () => void;
}

export default function BacklogRow({
  title,
  assigneeId,
  assigneeName,
  assignees,
  storyPoints = 0,
  status = 'todo',
  startDate = '',
  endDate = '',
  index,
  onStatusChange,
  onStoryPointsChange,
  onStartDateChange,
  onEndDateChange,
  onAssigneeChange,
  onDelete,
}: BacklogRowProps) {
  const [taskStatus, setTaskStatus] = useState(status);
  const [points, setPoints] = useState(storyPoints);
  const [showMenu, setShowMenu] = useState(false);
  const [priority, setPriority] = useState('Medium');
  const [localStartDate, setLocalStartDate] = useState(startDate);
  const [localEndDate, setLocalEndDate] = useState(endDate);
  const [subtasks, setSubtasks] = useState('');
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | ''>(
    assigneeId ?? ''
  );

  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalStartDate(startDate);
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate);
  }, [endDate]);

  useEffect(() => {
    setSelectedAssigneeId(assigneeId ?? '');
  }, [assigneeId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleStatus = (value: 'todo' | 'inprogress' | 'done' | 'blocked') => {
    setTaskStatus(value);
    onStatusChange?.(value);
  };

  const handlePoints = (value: number) => {
    setPoints(value);
    onStoryPointsChange?.(value);
  };

  const handleStartDate = (value: string) => {
    setLocalStartDate(value);
    onStartDateChange?.(value);
  };

  const handleEndDate = (value: string) => {
    setLocalEndDate(value);
    onEndDateChange?.(value);
  };

  const handleAssignee = (value: string) => {
    if (!value) {
      setSelectedAssigneeId('');
      return;
    }

    const parsedId = Number(value);
    setSelectedAssigneeId(parsedId);
    onAssigneeChange?.(parsedId);
  };

  const formatDate = (value: string) => {
    if (!value) return 'Set Date';

    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="relative rounded-md border border-[#D0D5DD] bg-[#E6EEF4] px-4 py-4">
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4">
        <div className="h-6 w-6 rounded-[6px] border-2 border-[#175CD3] bg-white" />

        <div className="flex items-center gap-6">
          <span className="text-[14px] font-medium text-[#344054]">
            {index + 1}
          </span>
          <span className="text-[18px] font-medium text-[#101828]">
            {title}
          </span>
        </div>

        <div className="relative">
          <select
            value={taskStatus}
            onChange={(e) =>
              handleStatus(
                e.target.value as 'todo' | 'inprogress' | 'done' | 'blocked'
              )
            }
            className="appearance-none rounded-md border border-[#D0D5DD] bg-white px-3 py-2 pr-10 text-[16px] font-medium text-[#101828] shadow-sm outline-none"
          >
            <option value="todo"> To Do </option>
            <option value="inprogress"> In Progress </option>
            <option value="done"> Done </option>
            <option value="blocked"> Blocked </option>
          </select>

          <ChevronDown
            size={18}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#101828]"
          />
        </div>

        <div className="flex items-center gap-2 rounded-md border border-[#98A2B3] bg-white px-3 py-2 text-[14px] text-[#101828]">
          <CalendarDays size={18} className="text-[#101828]" />
          <span>{formatDate(localEndDate)}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            value={points}
            onChange={(e) => handlePoints(Number(e.target.value))}
            className="w-10 border-none bg-transparent text-center text-[18px] font-semibold text-[#101828] outline-none"
          />
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-[#98A2B3]"
            title={assigneeName || 'Unassigned'}
          >
            <UserCircle2 size={32} strokeWidth={1.5} />
          </button>

          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="text-[#344054]"
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      {showMenu && (
        <div
          ref={menuRef}
          className="absolute right-4 top-[72px] z-50 w-80 rounded-xl border border-[#D0D5DD] bg-white p-4 shadow-xl"
        >
          <h4 className="mb-3 text-sm font-semibold text-[#344054]">
            Task Options
          </h4>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-[#667085]">
              Subtasks
            </label>
            <input
              type="text"
              value={subtasks}
              onChange={(e) => setSubtasks(e.target.value)}
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
              placeholder="Enter subtasks"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-[#667085]">
              Start Date
            </label>
            <input
              type="date"
              value={localStartDate}
              onChange={(e) => handleStartDate(e.target.value)}
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-[#667085]">
              End Date
            </label>
            <input
              type="date"
              value={localEndDate}
              onChange={(e) => handleEndDate(e.target.value)}
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-xs text-[#667085]">
              Assignee
            </label>
            <select
              value={selectedAssigneeId}
              onChange={(e) => handleAssignee(e.target.value)}
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
            >
              <option value="">Select assignee</option>
              {assignees.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-xs text-[#667085]">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm outline-none"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="w-full rounded-md bg-[#D92D20] px-3 py-2 text-sm text-white hover:bg-[#B42318]"
          >
            Delete Task
          </button>
        </div>
      )}
    </div>
  );
}