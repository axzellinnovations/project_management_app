'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, Pencil, Trash2, UserPlus } from 'lucide-react';
import AssigneeAvatar from './AssigneeAvatar';

// ── Types ──────────────────────────────────────────────────────────────────────

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';

export interface TaskRowTask {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected?: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  status: string;
  dueDate?: string;
  priority?: string;
}

export interface TaskRowTeamMember {
  id: number;
  user: {
    userId: number;
    fullName: string;
    username: string;
    profilePicUrl?: string | null;
  };
}

export interface TaskRowProps {
  task: TaskRowTask;
  teamMembers?: TaskRowTeamMember[];
  loadingMembers?: boolean;
  canDelete?: boolean;
  showCheckbox?: boolean;
  onToggle?: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onStoryPointsChange: (id: number, points: number) => void;
  onRenameTask: (id: number, title: string) => Promise<void>;
  onAssignTask: (id: number, userId: number) => Promise<void>;
  onDueDateChange?: (id: number, date: string) => void;
  onDeleteTask: (id: number) => void;
  onOpenTask?: (id: number) => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  TODO: 'bg-[#F2F4F7] text-[#344054]',
  IN_PROGRESS: 'bg-[#EFF8FF] text-[#175CD3]',
  IN_REVIEW: 'bg-[#FFFAEB] text-[#B54708]',
  DONE: 'bg-[#ECFDF3] text-[#027A48]',
};

const STATUS_BORDER: Record<TaskStatus, string> = {
  TODO: '#D0D5DD',
  IN_PROGRESS: '#175CD3',
  IN_REVIEW: '#F79009',
  DONE: '#12B76A',
};

const PRIORITY_STYLES: Record<string, string> = {
  CRITICAL: 'bg-[#FEF3F2] text-[#B42318]',
  HIGH: 'bg-[#FFFAEB] text-[#B54708]',
  URGENT: 'bg-[#FEF3F2] text-[#B42318]',
  MEDIUM: 'bg-[#EFF8FF] text-[#175CD3]',
  LOW: 'bg-[#F2F4F7] text-[#344054]',
};

type DueClass = 'none' | 'overdue' | 'today' | 'soon' | 'future';

const DUE_CHIP_STYLES: Record<DueClass, string> = {
  overdue: 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]',
  today: 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]',
  soon: 'bg-[#FFFAEB] text-[#B54708] border-[#FEDF89]',
  future: 'bg-[#F9FAFB] text-[#344054] border-[#EAECF0]',
  none: 'bg-[#F9FAFB] text-[#98A2B3] border-[#EAECF0]',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function classifyDue(dueDate: string | undefined, status: string): DueClass {
  if (!dueDate || status === 'DONE') return 'none';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  // Force local-time parsing to avoid off-by-one from UTC interpretation
  const due = new Date(dueDate.length === 10 ? dueDate + 'T00:00:00' : dueDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - now.getTime()) / 86_400_000);
  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'today';
  if (diffDays <= 3) return 'soon';
  return 'future';
}

function formatDate(value: string | undefined): string {
  if (!value) return 'Set Due';
  const d = new Date(value.length === 10 ? value + 'T00:00:00' : value);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ──────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  teamMembers = [],
  loadingMembers = false,
  canDelete = true,
  showCheckbox = false,
  onToggle,
  onStatusChange,
  onStoryPointsChange,
  onRenameTask,
  onAssignTask,
  onDueDateChange,
  onDeleteTask,
  onOpenTask,
}: TaskRowProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const [assignRect, setAssignRect] = useState<DOMRect | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const statusPortalRef = useRef<HTMLDivElement>(null);
  const assignPortalRef = useRef<HTMLDivElement>(null);

  const canonicalStatus = (task.status ?? 'TODO').toUpperCase() as TaskStatus;
  const validStatus: TaskStatus = canonicalStatus in STATUS_LABELS ? canonicalStatus : 'TODO';
  const dueClass = classifyDue(task.dueDate, validStatus);
  const statusBorderColor = STATUS_BORDER[validStatus];
  const priorityKey = (task.priority ?? 'LOW').toUpperCase();
  const priorityStyle = PRIORITY_STYLES[priorityKey] ?? PRIORITY_STYLES.LOW;

  // Close dropdowns on outside click (portal-aware)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        statusRef.current && !statusRef.current.contains(target) &&
        statusPortalRef.current && !statusPortalRef.current.contains(target)
      ) setStatusOpen(false);
      if (
        assignRef.current && !assignRef.current.contains(target) &&
        assignPortalRef.current && !assignPortalRef.current.contains(target)
      ) setAssignOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openStatus = useCallback(() => {
    if (statusRef.current) setStatusRect(statusRef.current.getBoundingClientRect());
    setStatusOpen((p) => !p);
  }, []);

  const openAssign = useCallback(() => {
    if (assignRef.current) setAssignRect(assignRef.current.getBoundingClientRect());
    setAssignOpen((p) => !p);
  }, []);

  const getMemberName = (m: TaskRowTeamMember) => m.user.fullName || m.user.username;

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(task.title);
    setRenaming(true);
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    setRenaming(false);
    if (trimmed && trimmed !== task.title) {
      await onRenameTask(task.id, trimmed);
    }
  };

  const rowBg =
    dueClass === 'overdue' || dueClass === 'today'
      ? 'bg-[#FEF9F9]'
      : dueClass === 'soon'
        ? 'bg-[#FFFDF5]'
        : 'bg-white';

  return (
    <div
      className={`group relative flex items-center min-h-[36px] border-b border-[#F2F4F7] ${rowBg} hover:bg-[#F9FAFB] cursor-pointer transition-colors duration-150`}
      style={{ borderLeft: `3px solid ${statusBorderColor}` }}
      onClick={() => !renaming && onOpenTask?.(task.id)}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div className="pl-2 pr-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={task.selected ?? false}
            onChange={() => onToggle?.(task.id)}
            className="h-4 w-4 rounded border-[#D0D5DD] text-[#155DFC] focus:ring-[#155DFC]/20 cursor-pointer"
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Task number */}
      <div className="flex-shrink-0 w-[44px] px-2 flex items-center justify-end">
        <span className="text-[11px] font-bold tabular-nums text-[#98A2B3]">#{task.taskNo}</span>
      </div>

      {/* Priority badge */}
      <div className="flex-shrink-0 w-[72px] px-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex h-5 items-center rounded px-1.5 text-[9px] font-bold uppercase tracking-wide truncate ${priorityStyle}`}>
          {priorityKey}
        </span>
      </div>

      {/* Title */}
      <div
        className="flex-1 min-w-0 px-2 py-2.5 flex items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {renaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            onBlur={() => void commitRename()}
            autoFocus
            className="w-full border-b-2 border-[#175CD3] bg-transparent text-[13px] font-semibold text-[#101828] outline-none"
          />
        ) : (
          <span
            className={`text-[13px] font-semibold text-[#101828] truncate ${validStatus === 'DONE' ? 'line-through opacity-60' : ''}`}
            onClick={(e) => { e.stopPropagation(); onOpenTask?.(task.id); }}
          >
            {task.title}
          </span>
        )}
      </div>

      {/* Assignee */}
      <div
        className="flex-shrink-0 w-[36px] flex items-center justify-center relative"
        ref={assignRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          title={task.assigneeName || 'Assign'}
          onClick={() => openAssign()}
          className="flex items-center justify-center"
        >
          {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
            <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
          ) : (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-[#EAECF0] hover:border-[#155DFC] transition-colors">
              <UserPlus size={11} className="text-[#667085]" />
            </div>
          )}
        </button>
        {assignOpen && assignRect && typeof document !== 'undefined' && createPortal(
          <div
            ref={assignPortalRef}
            className="fixed z-[9999] w-52 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl"
            style={{ top: assignRect.bottom + 4, left: Math.max(4, assignRect.right - 208) }}
          >
            <div className="px-3 py-2 text-[10px] font-bold text-[#667085] uppercase tracking-wider border-b border-[#F2F4F7] bg-[#F9FAFB]">
              Assign To
            </div>
            {loadingMembers ? (
              <div className="px-3 py-3 text-[12px] text-[#667085]">Loading…</div>
            ) : teamMembers.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                {teamMembers.map((m) => (
                  <button
                    key={m.user.userId}
                    onClick={() => {
                      void onAssignTask(task.id, m.user.userId);
                      setAssignOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium text-[#344054] hover:bg-[#F9FAFB]"
                  >
                    <AssigneeAvatar name={getMemberName(m)} profilePicUrl={m.user.profilePicUrl} size={20} />
                    <span className="truncate">{getMemberName(m)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-[#667085]">No members found</div>
            )}
          </div>,
          document.body
        )}
      </div>

      {/* Status dropdown */}
      <div
        className="flex-shrink-0 w-[110px] px-1 flex items-center relative"
        ref={statusRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => openStatus()}
          className={`flex h-6 w-full items-center justify-between gap-1 rounded-md px-2 text-[9px] font-bold uppercase tracking-wide transition-all ${STATUS_COLORS[validStatus]}`}
        >
          <span className="truncate">{STATUS_LABELS[validStatus]}</span>
          <ChevronDown size={9} className="flex-shrink-0 opacity-60" />
        </button>
        {statusOpen && statusRect && typeof document !== 'undefined' && createPortal(
          <div
            ref={statusPortalRef}
            className="fixed z-[9999] w-32 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl"
            style={{ top: statusRect.bottom + 4, left: statusRect.left }}
          >
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  onStatusChange(task.id, s);
                  setStatusOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB] ${s === validStatus ? 'text-[#155DFC]' : ''}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Due date (only if handler provided) */}
      {onDueDateChange && (
        <div
          className="flex-shrink-0 w-[88px] px-1 flex items-center relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => dateRef.current?.showPicker()}
            className={`inline-flex h-6 w-full items-center justify-center gap-1 rounded-md border px-1.5 text-[10px] font-bold ${DUE_CHIP_STYLES[dueClass]}`}
          >
            <CalendarDays size={9} className="flex-shrink-0" />
            <span className="truncate">{formatDate(task.dueDate)}</span>
          </button>
          <input
            ref={dateRef}
            type="date"
            value={task.dueDate || ''}
            onChange={(e) => onDueDateChange(task.id, e.target.value)}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
          />
        </div>
      )}

      {/* Story points */}
      <div
        className="flex-shrink-0 w-[40px] px-1 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-6 w-full items-center justify-center rounded-md border border-[#EAECF0] bg-[#F9FAFB]">
          <input
            type="number"
            min="0"
            value={task.storyPoints}
            onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
            className="w-full text-center text-[11px] font-bold text-[#101828] outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Actions – visible on row hover */}
      <div
        className="flex-shrink-0 w-[52px] pl-1 pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={startRename}
          title="Rename"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          onClick={() => canDelete && onDeleteTask(task.id)}
          disabled={!canDelete}
          title={canDelete ? 'Delete task' : 'Viewers cannot delete tasks'}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${canDelete ? 'text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2]' : 'text-[#D0D5DD] cursor-not-allowed'}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export default React.memo(TaskRow);
