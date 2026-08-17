'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Trash2, UserPlus, RefreshCw } from 'lucide-react';
import AssigneeAvatar from '../AssigneeAvatar';
import { STATUS_LABELS, type TaskStatus } from './TaskRowConstants';
import type { TaskRowProps } from '../TaskRow';
import { useTaskRowState } from './useTaskRowState';
import { formatDate } from './TaskRowConstants';

function hexToLabelStyle(hex: string): React.CSSProperties {
  return { backgroundColor: `${hex}20`, color: hex, border: `1px solid ${hex}40` };
}

export default function MobileTaskRow(props: TaskRowProps) {
  const {
    task, teamMembers = [], onStatusChange, onStoryPointsChange,
    onAssignTask, onAssignMultiple, onDueDateChange, onDeleteTask,
    canDelete = true, projectLabels = [], onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses = [],
    hideStatus = false, projectKey, onMoveUp, onMoveDown,
  } = props;

  const [assignMode, setAssignMode] = React.useState<'single' | 'multi'>('multi');

  const [localAssigneeUserIds, setLocalAssigneeUserIds] = React.useState<number[]>(() => {
    if (task.assignees && task.assignees.length > 0) {
      return task.assignees
        .map((a) => a.userId ?? a.memberId ?? a.id)
        .filter((id): id is number => typeof id === 'number');
    }
    return [];
  });
  const [isAssigning, setIsAssigning] = React.useState(false);

  React.useEffect(() => {
    if (task.assignees) {
      const ids = task.assignees
        .map((a) => a.userId ?? a.memberId ?? a.id)
        .filter((id): id is number => typeof id === 'number');
      setLocalAssigneeUserIds(ids);
    }
  }, [task.assignees]);

  const currentAssigneeUserIds = localAssigneeUserIds;

  const handleToggleMember = async (userId: number) => {
    if (isAssigning) return;
    if (assignMode === 'single') {
      setIsAssigning(true);
      setLocalAssigneeUserIds([userId]);
      try {
        if (onAssignMultiple) {
          await onAssignMultiple(task.id, [userId]);
        } else {
          await onAssignTask(task.id, userId);
        }
      } finally {
        setIsAssigning(false);
        setAssignOpen(false);
      }
      return;
    }

    const isAlready = currentAssigneeUserIds.includes(userId);
    const updated = isAlready
      ? currentAssigneeUserIds.filter((id) => id !== userId)
      : [...currentAssigneeUserIds, userId];

    setLocalAssigneeUserIds(updated);
    setIsAssigning(true);
    try {
      if (onAssignMultiple) {
        await onAssignMultiple(task.id, updated);
      } else {
        await onAssignTask(task.id, updated.length > 0 ? updated[0] : 0);
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClearAssignees = async () => {
    if (isAssigning) return;
    setLocalAssigneeUserIds([]);
    setIsAssigning(true);
    try {
      if (onAssignMultiple) {
        await onAssignMultiple(task.id, []);
      } else {
        await onAssignTask(task.id, 0);
      }
    } finally {
      setIsAssigning(false);
      setAssignOpen(false);
    }
  };

  const {
    statusRef, assignRef, dateRef,
    statusPortalRef, assignPortalRef,
    lastTapRef,
    statusOpen, setStatusOpen,
    assignOpen, setAssignOpen,
    renaming,
    renameValue, setRenameValue,
    statusPosition, assignPosition,
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename, cancelRename,
    openStatus, openAssign, openDatePicker,
    displayLabel, displayStyle, dueClass, statusBorderColor, priorityKey, priorityStyle,
  } = useTaskRowState(task, {
    canDelete, onDeleteTask, onRenameTask: props.onRenameTask,
    onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses, projectLabels,
  });

  const displayTaskKey = projectKey ? `#${projectKey}-${task.taskNo || task.id}` : `#${task.taskNo || task.id}`;

  const rowBg =
    dueClass === 'five_days' ? 'bg-amber-50 dark:bg-amber-900/15'
    : dueClass === 'old' || dueClass === 'overdue' || dueClass === 'today' ? 'bg-cu-danger-light'
    : 'bg-cu-bg';

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border-l-[6px] border border-cu-border shadow-cu-sm hover:shadow-cu-md transition-all duration-200 mb-3 select-none overflow-hidden ${rowBg}`}
      style={{ borderLeftColor: statusBorderColor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center w-full min-h-[72px]">
        {/* Title Section */}
        <div className="flex-1 min-w-0 p-4 border-r border-cu-border-light">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-cu-text-tertiary tracking-wider">{displayTaskKey}</span>
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${priorityStyle}`}>
              {priorityKey}
            </span>
          </div>
          {renaming ? (
            <div className="flex-1 min-w-0">
              <input
                type="text"
                maxLength={255}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
                  if (e.key === 'Escape') cancelRename();
                }}
                onBlur={() => void commitRename()}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                className="w-full border-b-2 border-cu-primary bg-transparent text-[15px] font-bold text-cu-text-primary outline-none"
              />
              {renameValue.length > 200 && (
                <p className="text-xs text-amber-500 mt-1">{255 - renameValue.length} characters remaining</p>
              )}
            </div>
          ) : (
            <h3
              onClick={(e) => {
                e.stopPropagation();
                const now = Date.now();
                if (now - lastTapRef.current < 300) startRename(e as unknown as React.MouseEvent);
                updateLastTap(now);
              }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(e as unknown as React.MouseEvent); }}
              onTouchStart={onTouchStartInternal}
              onTouchEnd={onTouchEndInternal}
              onTouchMove={onTouchMoveInternal}
              className={`text-[15px] font-bold leading-tight truncate cursor-text select-none flex items-center gap-2 ${
                dueClass === 'five_days' ? 'text-amber-800 dark:text-amber-300' :
                task.status?.toUpperCase() === 'DONE' ? 'line-through text-cu-text-muted' : 'text-cu-text-primary'
              }`}
            >
              <span className="truncate">{task.title}</span>
              {task.recurrenceRule && (
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${
                    task.recurrenceActive === false
                      ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
                      : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
                  }`}
                >
                  <RefreshCw size={8} className="flex-shrink-0" />
                  <span>Recur{task.recurrenceActive === false ? ' (P)' : ''}</span>
                </span>
              )}
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

        {/* Scrollable Metadata */}
        <div className="flex-1 flex items-center gap-3 px-3 overflow-x-auto no-scrollbar bg-cu-bg-secondary/50 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-1 border-r border-cu-border pr-2" onClick={(e) => e.stopPropagation()}>
            {onMoveUp && (
              <button type="button" onClick={onMoveUp} className="flex h-11 w-11 items-center justify-center rounded-lg text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light active:scale-90 transition-all">
                <ArrowUp size={16} />
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={onMoveDown} className="flex h-11 w-11 items-center justify-center rounded-lg text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light active:scale-90 transition-all">
                <ArrowDown size={16} />
              </button>
            )}
            <button type="button" onClick={startRename} className="flex h-11 w-11 items-center justify-center rounded-lg text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light active:scale-90 transition-all">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={() => canDelete && onDeleteTask(task.id)} className="flex h-11 w-11 items-center justify-center rounded-lg text-cu-text-secondary hover:text-cu-danger hover:bg-cu-danger-light active:scale-90 transition-all">
              <Trash2 size={16} />
            </button>
          </div>

          {/* Priority → Status → Delete */}
          <div className="flex-shrink-0 flex items-center gap-1.5 border-r border-[#F2F4F7] pr-2" onClick={(e) => e.stopPropagation()}>
            {/* Priority pill */}
            <span className={`flex-shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${priorityStyle}`}>
              {priorityKey}
            </span>
            {/* Status */}
            {!hideStatus && (
              <div ref={statusRef}>
                <button
                  type="button"
                  onClick={() => openStatus()}
                  className={`flex h-[26px] min-w-[78px] items-center justify-center gap-1 rounded-md px-2 text-[10px] font-semibold uppercase tracking-wide transition-all active:scale-95 ${displayStyle}`}
                >
                  <span className="truncate">{displayLabel}</span>
                  <ChevronDown size={8} className="opacity-50 flex-shrink-0" />
                </button>
              </div>
            )}
            {/* Delete */}
            <button
              type="button"
              onClick={() => canDelete && onDeleteTask(task.id)}
              className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-[#C1C9D4] hover:text-[#F04438] hover:bg-[#FEF3F2] active:scale-90 transition-all"
            >
              <Trash2 size={12} />
            </button>
          </div>

          {/* Assignee */}
          <div className="flex-shrink-0 flex items-center relative" ref={assignRef} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => openAssign()}
              className="flex items-center active:scale-90 transition-transform"
              title={
                task.assignees && task.assignees.length > 0
                  ? task.assignees.map((a) => a.name).join(', ')
                  : (task.assigneeName || 'Assign')
              }
            >
              {task.assignees && task.assignees.length > 0 ? (
                <div className="flex items-center">
                  {task.assignees.slice(0, 3).map((a, idx) => (
                    <span
                      key={a.userId ?? a.memberId ?? a.id ?? idx}
                      className="inline-block ring-2 ring-cu-bg rounded-full"
                      style={{ marginLeft: idx === 0 ? 0 : -7, zIndex: task.assignees!.length - idx }}
                    >
                      <AssigneeAvatar name={a.name} profilePicUrl={a.photoUrl || a.avatar || a.profilePicUrl} size={22} />
                    </span>
                  ))}
                  {task.assignees.length > 3 && (
                    <span
                      className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-cu-primary/10 ring-2 ring-cu-bg text-[9px] font-bold text-cu-primary"
                      style={{ marginLeft: -7 }}
                    >
                      +{task.assignees.length - 3}
                    </span>
                  )}
                </div>
              ) : task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-cu-border text-cu-text-tertiary">
                  <UserPlus size={14} />
                </div>
              )}
            </button>
          </div>


          {/* Points */}
          <div className="flex-shrink-0 flex items-center justify-center min-w-[32px]" onClick={(e) => e.stopPropagation()}>
            <input
              type="number" value={task.storyPoints} title="Points"
              onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
              className="text-[13px] font-bold text-cu-text-primary bg-cu-bg-tertiary rounded-lg px-2 py-2 outline-none w-11 text-center min-h-[44px]"
            />
          </div>

          {/* Due Date */}
          {onDueDateChange && (
            <div className="flex-shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={openDatePicker}
                title={formatDate(task.dueDate)}
                className={`text-[12px] font-bold leading-none whitespace-nowrap px-2 py-2 rounded-lg min-h-[44px] ${
                  dueClass === 'overdue' || dueClass === 'old' || dueClass === 'today'
                    ? 'text-cu-danger bg-cu-danger-light'
                    : dueClass === 'five_days' || dueClass === 'soon'
                      ? 'text-amber-800 bg-amber-50 dark:text-amber-300 dark:bg-amber-900/15'
                      : 'text-cu-text-secondary bg-cu-bg-tertiary'
                }`}
              >
                {dueClass === 'overdue' ? 'Overdue' : dueClass === 'today' ? 'Due today' : formatDate(task.dueDate)}
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

      {/* Status Portal */}
      {!hideStatus && statusOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={statusPortalRef}
          style={{ position: 'fixed', top: `${statusPosition.top}px`, left: `${statusPosition.left}px`, width: '160px' }}
          className="z-[var(--cu-z-dropdown)] overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-3 py-2 text-[11px] font-bold text-cu-text-secondary border-b border-cu-border uppercase tracking-wider">Move To</div>
          <div className="p-1">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button key={s} onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                className={`w-full flex items-center px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${task.status?.toUpperCase() === s ? 'bg-cu-primary-light text-cu-primary' : 'text-cu-text-primary hover:bg-cu-hover'}`}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                  background: task.status?.toUpperCase() === s ? '#175CD3' : '#D0D5DD'
                }} />
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Assignee Portal */}
      {assignOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={assignPortalRef}
          style={{ position: 'fixed', top: `${assignPosition.top}px`, left: `${assignPosition.left}px`, width: 'max-content', minWidth: '220px' }}
          className="z-[var(--cu-z-dropdown)] overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-cu-border bg-cu-bg-secondary">
            <span className="text-[11px] font-bold text-cu-text-secondary uppercase tracking-wider">Assign Member</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setAssignMode('single')}
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${assignMode === 'single' ? 'bg-cu-primary text-white' : 'bg-cu-bg text-cu-text-secondary hover:text-cu-text-primary'}`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setAssignMode('multi')}
                className={`rounded px-1.5 py-0.5 text-[9px] font-semibold transition-colors ${assignMode === 'multi' ? 'bg-cu-primary text-white' : 'bg-cu-bg text-cu-text-secondary hover:text-cu-text-primary'}`}
              >
                Multi
              </button>
            </div>
          </div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => void handleClearAssignees()}
              className={`flex w-full items-center justify-between px-3 py-2 text-[13px] font-medium transition-colors hover:bg-cu-hover rounded-lg ${currentAssigneeUserIds.length === 0 ? 'text-cu-primary font-semibold' : 'text-cu-text-secondary'}`}
            >
              <span>Unassigned</span>
              {currentAssigneeUserIds.length === 0 && <span className="text-cu-primary font-bold">✓</span>}
            </button>

            {teamMembers.map((m) => {
              const isSelected = currentAssigneeUserIds.includes(m.user.userId);
              return (
                <button
                  key={m.user.userId}
                  onClick={() => void handleToggleMember(m.user.userId)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-[13px] font-medium hover:bg-cu-hover rounded-lg transition-colors ${isSelected ? 'text-cu-primary bg-cu-primary/5 font-semibold' : 'text-cu-text-primary'}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <AssigneeAvatar name={m.user.fullName || m.user.username} profilePicUrl={m.user.profilePicUrl} size={22} />
                    <span className="truncate">{m.user.fullName || m.user.username}</span>
                  </div>
                  {isSelected && (
                    <span className="flex-shrink-0 text-cu-primary font-bold text-[11px]">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
