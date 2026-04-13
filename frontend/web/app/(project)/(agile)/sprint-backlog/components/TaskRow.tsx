'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, CalendarDays, ChevronDown, Pencil, Tag, Trash2, UserPlus } from 'lucide-react';
import AssigneeAvatar from './AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';

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
  labels?: Array<{ id: number; name: string; color?: string }>;
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
  projectLabels?: Array<{ id: number; name: string; color?: string }>;
  onAddLabel?: (taskId: number, labelId: number) => Promise<void>;
  onRemoveLabel?: (taskId: number, labelId: number) => Promise<void>;
  onCreateLabel?: (name: string) => Promise<{ id: number; name: string; color?: string }>;
  extraStatuses?: Array<{ value: string; label: string }>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
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
  projectLabels = [],
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
  extraStatuses = [],
  onMoveUp,
  onMoveDown,
}: TaskRowProps) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [labelOpen, setLabelOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [labelInput, setLabelInput] = useState('');
  const [creatingLabel, setCreatingLabel] = useState(false);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const [assignRect, setAssignRect] = useState<DOMRect | null>(null);
  const [labelRect, setLabelRect] = useState<DOMRect | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const assignRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const statusPortalRef = useRef<HTMLDivElement>(null);
  const assignPortalRef = useRef<HTMLDivElement>(null);
  const labelPortalRef = useRef<HTMLDivElement>(null);

  // Touch logic for double-tap and long-press
  const lastTapRef = useRef<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTouchStartInternal = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    const LONG_PRESS_DELAY = 600;

    // Double Tap Check (Rename)
    const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_DELAY;
    if (isDoubleTap) {
      e.preventDefault();
      setRenameValue(task.title);
      setRenaming(true);
      lastTapRef.current = 0;
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      return;
    }
    lastTapRef.current = now;

    // Long Press Start (Delete)
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (canDelete) {
        onDeleteTask(task.id);
      }
    }, LONG_PRESS_DELAY);
  }, [task.id, task.title, canDelete, onDeleteTask]);

  const onTouchEndInternal = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const onTouchMoveInternal = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const startRename = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRenameValue(task.title);
    setRenaming(true);
  }, [task.title]);

  const commitRename = useCallback(async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === task.title) {
      setRenaming(false);
      return;
    }
    setRenaming(false);
    try {
      await onRenameTask(task.id, trimmed);
    } catch (error) {
      console.error('Failed to rename task:', error);
    }
  }, [renameValue, task.id, task.title, onRenameTask]);

  const taskLabelIds = useMemo(() => new Set((task.labels ?? []).map((l) => l.id)), [task.labels]);

  const openLabel = useCallback(() => {
    const rect = labelRef.current?.getBoundingClientRect() ?? null;
    setLabelRect(rect);
    setLabelOpen(true);
  }, []);

  const handleLabelToggle = useCallback(async (label: { id: number; name: string; color?: string }) => {
    if (taskLabelIds.has(label.id)) {
      // Clicking active label removes it
      await onRemoveLabel?.(task.id, label.id);
    } else {
      // Remove any existing label first (single-label rule), then add new one
      if (taskLabelIds.size > 0) {
        const existingId = task.labels![0].id;
        await onRemoveLabel?.(task.id, existingId);
      }
      await onAddLabel?.(task.id, label.id);
    }
  }, [task.id, task.labels, taskLabelIds, onAddLabel, onRemoveLabel]);

  const handleCreateLabelFromInput = useCallback(async () => {
    const trimmed = labelInput.trim();
    if (!trimmed || creatingLabel || !onCreateLabel) return;
    setCreatingLabel(true);
    try {
      const newLabel = await onCreateLabel(trimmed);
      await onAddLabel?.(task.id, newLabel.id);
      setLabelInput('');
    } finally {
      setCreatingLabel(false);
    }
  }, [labelInput, creatingLabel, onCreateLabel, onAddLabel, task.id]);

  const canonicalStatus = (task.status ?? 'TODO').toUpperCase() as TaskStatus;
  const isKnownStatus = canonicalStatus in STATUS_LABELS;
  const validStatus: TaskStatus = isKnownStatus ? canonicalStatus : 'TODO';
  const displayLabel = isKnownStatus
    ? STATUS_LABELS[validStatus]
    : (extraStatuses.find(s => s.value === canonicalStatus)?.label ?? task.status ?? 'TODO');
  const displayStyle = isKnownStatus ? STATUS_COLORS[validStatus] : 'bg-[#F2F4F7] text-[#344054]';
  const dueClass = classifyDue(task.dueDate, validStatus);
  const statusBorderColor = STATUS_BORDER[validStatus];
  const priorityKey = (task.priority ?? 'LOW').toUpperCase();
  const priorityStyle = PRIORITY_STYLES[priorityKey] ?? PRIORITY_STYLES.LOW;

  // Close dropdowns on outside click (portal-aware)
  useEffect(() => {
    const handler = (e: Event) => {
      const target = e.target as Node;
      if (
        statusRef.current && !statusRef.current.contains(target) &&
        statusPortalRef.current && !statusPortalRef.current.contains(target)
      ) setStatusOpen(false);
      if (
        assignRef.current && !assignRef.current.contains(target) &&
        assignPortalRef.current && !assignPortalRef.current.contains(target)
      ) setAssignOpen(false);
      if (
        labelRef.current && !labelRef.current.contains(target) &&
        labelPortalRef.current && !labelPortalRef.current.contains(target)
      ) setLabelOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
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
  const openDatePicker = useCallback(() => {
    if (!dateRef.current) return;
    if (typeof dateRef.current.showPicker === 'function') {
      dateRef.current.showPicker();
    } else {
      dateRef.current.click();
    }
  }, []);

  // Responsive logic: check if screen is mobile size (< 768px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile) {
    return (
      <div
        className="group relative flex flex-col rounded-2xl border-l-[6px] border border-[#EAECF0] bg-white shadow-sm hover:shadow-md transition-all duration-200 mb-3 select-none overflow-hidden"
        style={{ borderLeftColor: statusBorderColor }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Main Content Area: Horizontal Scroll for Metadata */}
        <div className="flex items-center w-full min-h-[72px]">
          {/* Static Title Section (Left-aligned) */}
          <div className="flex-1 min-w-0 p-4 border-r border-[#F2F4F7]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-[#98A2B3] tracking-wider">#{task.taskNo || task.id}</span>
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>
                {priorityKey}
              </span>
            </div>
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
                onClick={(e) => e.stopPropagation()}
                className="w-full border-b-2 border-[#175CD3] bg-transparent text-[15px] font-bold text-[#101828] outline-none"
              />
            ) : (
              <h3 
                onClick={(e) => {
                  e.stopPropagation();
                  const now = Date.now();
                  const DOUBLE_TAP_DELAY = 300;
                  if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
                    startRename(e);
                  }
                  lastTapRef.current = now;
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(e);
                }}
                onTouchStart={onTouchStartInternal}
                onTouchEnd={onTouchEndInternal}
                onTouchMove={onTouchMoveInternal}
                className={`text-[15px] font-bold leading-tight truncate cursor-text select-none ${
                  task.status?.toUpperCase() === 'DONE' ? 'line-through text-[#98A2B3]' : 'text-[#101828]'
                }`}
              >
                {task.title}
              </h3>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {task.labels?.slice(0, 1).map((label) => (
                <span
                  key={label.id}
                  style={hexToLabelStyle(label.color ?? '#6366F1')}
                  className="px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap shadow-sm"
                >
                  {label.name}
                </span>
              ))}
            </div>
          </div>

          {/* Horizontally Scrollable Metadata Options */}
          <div className="flex-1 flex items-center gap-3 px-3 overflow-x-auto no-scrollbar bg-[#F9FAFB]/50 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
            {/* Actions (Pencil / Trash) */}
            <div className="flex-shrink-0 flex items-center gap-1 border-r border-[#EAECF0] pr-2" onClick={(e) => e.stopPropagation()}>
              {onMoveUp && (
                <button
                  type="button"
                  onClick={onMoveUp}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all"
                >
                  <ArrowUp size={16} />
                </button>
              )}
              {onMoveDown && (
                <button
                  type="button"
                  onClick={onMoveDown}
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all"
                >
                  <ArrowDown size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={startRename}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => canDelete && onDeleteTask(task.id)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] active:scale-90 transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {/* Status */}
            <div className="flex-shrink-0" ref={statusRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openStatus()}
                className={`flex h-11 min-w-[108px] items-center justify-center gap-1.5 rounded-lg px-2 text-[11px] font-bold uppercase tracking-wider shadow-sm transition-all active:scale-95 ${displayStyle}`}
              >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown size={10} className="opacity-60 flex-shrink-0" />
              </button>
            </div>

            {/* Assignee */}
            <div className="flex-shrink-0 flex items-center relative group/assignee" ref={assignRef} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => openAssign()}
                className="flex items-center active:scale-90 transition-transform"
              >
                {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                  <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={28} />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[#EAECF0] text-[#98A2B3]">
                    <UserPlus size={14} />
                  </div>
                )}
              </button>
              
              {/* Desktop Hover Tooltip */}
              {!isMobile && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#101828] text-white text-[10px] font-bold rounded opacity-0 group-hover/assignee:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-[1000]">
                  {task.assigneeName || 'Unassigned'}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#101828]" />
                </div>
              )}
            </div>

            {/* Points */}
            <div className="flex-shrink-0 flex items-center justify-center min-w-[32px]" onClick={(e) => e.stopPropagation()}>
              <input 
                type="number" 
                value={task.storyPoints} 
                title="Points"
                onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
                className="text-[13px] font-bold text-[#101828] bg-[#F2F4F7] rounded-lg px-2 py-2 outline-none w-11 text-center min-h-[44px]"
              />
            </div>

            {onDueDateChange && (
              <div className="flex-shrink-0 flex items-center relative" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={openDatePicker}
                  title={`Due Date: ${formatDate(task.dueDate)}`}
                  className={`text-[12px] font-bold leading-none whitespace-nowrap bg-[#F2F4F7] px-2 py-2 rounded-lg min-h-[44px] ${dueClass === 'overdue' ? 'text-red-600 bg-red-50' : 'text-[#475467]'}`}
                >
                  {formatDate(task.dueDate)}
                </button>
                <input
                  ref={dateRef}
                  type="date"
                  value={task.dueDate || ''}
                  onChange={(e) => onDueDateChange(task.id, e.target.value)}
                  className="sr-only"
                />
              </div>
            )}
          </div>
        </div>

        {/* Portals for Dropdowns */}
        {assignOpen && assignRect && typeof document !== 'undefined' && createPortal(
          <div
            ref={assignPortalRef}
            style={{
              position: 'fixed',
              top: `${assignRect.bottom + 8}px`,
              left: Math.min(assignRect.left, window.innerWidth - 220) + 'px',
              width: 'max-content',
              minWidth: '200px',
            }}
            className="z-[9999] overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-4 py-2 text-[11px] font-bold text-[#475467] border-b border-[#F2F4F7] uppercase tracking-wider">Assign Member</div>
            <div className="max-h-[240px] overflow-y-auto p-1">
              {teamMembers.map((m) => (
                <button
                  key={m.user.userId}
                  onClick={() => {
                    void onAssignTask(task.id, m.user.userId);
                    setAssignOpen(false);
                  }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#344054] hover:bg-[#F9FAFB] rounded-lg transition-colors"
                >
                  <AssigneeAvatar name={getMemberName(m)} profilePicUrl={m.user.profilePicUrl} size={24} />
                  <span className="truncate">{getMemberName(m)}</span>
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
        
        {statusOpen && statusRect && typeof document !== 'undefined' && createPortal(
          <div
            ref={statusPortalRef}
            style={{
              position: 'fixed',
              top: `${statusRect.bottom + 8}px`,
              left: Math.min(statusRect.left, window.innerWidth - 180) + 'px',
              width: '160px',
            }}
            className="z-[9999] overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="px-3 py-2 text-[11px] font-bold text-[#475467] border-b border-[#F2F4F7] uppercase tracking-wider">Move To</div>
            <div className="p-1">
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    onStatusChange(task.id, s);
                    setStatusOpen(false);
                  }}
                  className={`w-full flex items-center px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${task.status?.toUpperCase() === s ? 'bg-[#EFF8FF] text-[#175CD3]' : 'text-[#344054] hover:bg-[#F9FAFB]'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }

  const rowBg =
    dueClass === 'overdue' || dueClass === 'today'
      ? 'bg-[#FEE2E2]'
      : dueClass === 'soon'
        ? 'bg-[#FFFDF5]'
        : 'bg-white';

  return (
    <div
      className={`group relative flex items-center min-h-[36px] rounded-lg ${rowBg} hover:bg-[#F9FAFB] cursor-pointer transition-colors duration-150`}
      style={{ borderLeft: `3px solid ${statusBorderColor}` }}
      onClick={() => {
        if (!renaming) {
          onOpenTask?.(task.id);
        }
      }}
      onTouchStart={onTouchStartInternal}
      onTouchEnd={onTouchEndInternal}
      onTouchMove={onTouchMoveInternal}
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
        <span className="text-[12px] font-bold tabular-nums text-[#98A2B3]">#{task.taskNo}</span>
      </div>

      {/* Priority badge */}
      <div className="flex-shrink-0 w-[72px] px-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex h-5 items-center rounded px-1.5 text-[11px] font-bold uppercase tracking-wide truncate ${priorityStyle}`}>
          {priorityKey}
        </span>
      </div>

      {/* Title */}
      <div
        className="flex-1 min-w-0 px-2 flex items-center gap-1.5 overflow-hidden"
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
            className="w-full border-b-2 border-[#175CD3] bg-transparent text-[12px] font-semibold text-[#101828] outline-none"
          />
        ) : (
          <>
            <span
              className={`text-[12px] font-semibold text-[#101828] truncate min-w-0 select-none ${task.status.toUpperCase() === 'DONE' ? 'line-through text-[#98A2B3]' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                // If double-click isn't used (mobile behavior emulation), 
                // we'll use a timer. But for desktop/standard tests, 
                // we must allow a single click to trigger onOpenTask.
                const now = Date.now();
                const DOUBLE_TAP_DELAY = 300;
                if (lastTapRef.current > 0 && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
                  startRename(e);
                  lastTapRef.current = 0;
                } else {
                  lastTapRef.current = now;
                  onOpenTask?.(task.id);
                }
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(e);
              }}
            >
              {task.title}
            </span>
            {task.labels?.[0] && (
              <span
                style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')}
                className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
              >
                {task.labels[0].name}
              </span>
            )}
          </>
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
          className={`flex h-6 w-full items-center justify-between gap-1 rounded-md px-2 text-[11px] font-bold uppercase tracking-wide transition-all ${displayStyle}`}
        >
          <span className="truncate">{displayLabel}</span>
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
                className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB] ${task.status?.toUpperCase() === s ? 'text-[#155DFC]' : ''}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {extraStatuses.length > 0 && (
              <div className="border-t border-[#EAECF0] my-1" />
            )}
            {extraStatuses.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  onStatusChange(task.id, s.value);
                  setStatusOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB] ${task.status?.toUpperCase() === s.value ? 'text-[#155DFC]' : ''}`}
              >
                {s.label}
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
            onClick={openDatePicker}
            className={`flex h-6 w-full items-center justify-center gap-1 rounded-md px-2 text-[10px] font-bold transition-all border ${
              dueClass === 'none'
                ? 'bg-white border-[#EAECF0] text-[#667085] hover:bg-gray-50'
                : DUE_CHIP_STYLES[dueClass]
            }`}
          >
            <CalendarDays size={10} className="flex-shrink-0 opacity-60" />
            <span className="truncate">{formatDate(task.dueDate)}</span>
          </button>
          <input
            ref={dateRef}
            type="date"
            value={task.dueDate || ''}
            onChange={(e) => onDueDateChange(task.id, e.target.value)}
            className="sr-only"
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
            className="w-full text-center text-[12px] font-bold text-[#101828] outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Actions – visible on row hover */}
      {/* Label picker button */}
      {(onAddLabel || onCreateLabel) && (
        <div
          className="flex-shrink-0 w-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          ref={labelRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { if (labelOpen) setLabelOpen(false); else openLabel(); }}
            title="Labels"
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${
              labelOpen ? 'bg-[#EFF8FF] text-[#175CD3]' : 'text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF]'
            }`}
          >
            <Tag size={12} />
          </button>
          {labelOpen && labelRect && typeof document !== 'undefined' && createPortal(
            <div
              ref={labelPortalRef}
              className="fixed z-[9999] w-56 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl"
              style={{ top: labelRect.bottom + 4, left: Math.max(4, labelRect.right - 224) }}
            >
              {/* Create new label input */}
              <div className="px-3 py-2 border-b border-[#F2F4F7]">
                <input
                  autoFocus
                  type="text"
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void handleCreateLabelFromInput(); }
                    if (e.key === 'Escape') { setLabelOpen(false); setLabelInput(''); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New label name + Enter"
                  disabled={creatingLabel}
                  className="w-full text-[12px] text-[#101828] placeholder-[#98A2B3] bg-transparent outline-none"
                />
              </div>
              {/* Existing labels */}
              <div className="max-h-48 overflow-y-auto">
                {projectLabels.length === 0 && (
                  <div className="px-3 py-3 text-[12px] text-[#98A2B3]">No labels yet</div>
                )}
                {projectLabels.map((label) => {
                  const active = taskLabelIds.has(label.id);
                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={(e) => { e.stopPropagation(); void handleLabelToggle(label); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: label.color ?? '#6B7280' }}
                      />
                      <span className="flex-1 text-left truncate text-[#344054] font-medium">{label.name}</span>
                      {active && (
                        <span className="h-4 w-4 rounded-full bg-[#175CD3] flex items-center justify-center flex-shrink-0">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

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
