'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, ArrowUp, ChevronDown, Pencil, Trash2, UserPlus } from 'lucide-react';
import AssigneeAvatar from '../AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { STATUS_LABELS, type TaskStatus } from './TaskRowConstants';
import type { TaskRowProps } from '../TaskRow';
import { useTaskRowState } from './useTaskRowState';
import { formatDate } from './TaskRowConstants';

// ── Mobile Task Row ──────────────────────────────────────────────────────────

export default function MobileTaskRow(props: TaskRowProps) {
  const {
    task, teamMembers = [], onStatusChange, onStoryPointsChange,
    onAssignTask, onDueDateChange, onDeleteTask, onMoveUp, onMoveDown, projectKey,
    canDelete = true, projectLabels = [], onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses = [],
  } = props;

  const {
    // Refs – only used for DOM attachment (ref={…}), never read during render
    statusRef, assignRef, dateRef,
    statusPortalRef, assignPortalRef,
    lastTapRef,
    // State values – safe to read during render
    statusOpen, setStatusOpen,
    assignOpen, setAssignOpen,
    renaming, setRenaming,
    renameValue, setRenameValue,
    statusPosition, assignPosition,
    // Handlers / callbacks
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename,
    openStatus, openAssign, openDatePicker,
    // Derived display values
    displayLabel, displayStyle, dueClass, statusBorderColor, priorityKey, priorityStyle,
  } = useTaskRowState(task, {
    canDelete, onDeleteTask, onRenameTask: props.onRenameTask,
    onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses, projectLabels,
  });

  const displayTaskKey = projectKey ? `#${projectKey}-${task.taskNo || task.id}` : `#${task.taskNo || task.id}`;

  return (
    <div
      className="group relative flex flex-col rounded-2xl border-l-[6px] border border-[#EAECF0] bg-white shadow-sm hover:shadow-md transition-all duration-200 mb-3 select-none overflow-hidden"
      style={{ borderLeftColor: statusBorderColor }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="flex items-center w-full min-h-[72px]">
        {/* Title Section */}
        <div className="flex-1 min-w-0 p-4 border-r border-[#F2F4F7]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-[#98A2B3] tracking-wider">{displayTaskKey}</span>
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
                if (now - lastTapRef.current < 300) startRename(e as unknown as React.MouseEvent);
                updateLastTap(now);
              }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(e as unknown as React.MouseEvent); }}
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

        {/* Scrollable Metadata */}
        <div className="flex-1 flex items-center gap-3 px-3 overflow-x-auto no-scrollbar bg-[#F9FAFB]/50 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-1 border-r border-[#EAECF0] pr-2" onClick={(e) => e.stopPropagation()}>
            {onMoveUp && (
              <button type="button" onClick={onMoveUp} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all">
                <ArrowUp size={16} />
              </button>
            )}
            {onMoveDown && (
              <button type="button" onClick={onMoveDown} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all">
                <ArrowDown size={16} />
              </button>
            )}
            <button type="button" onClick={startRename} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] active:scale-90 transition-all">
              <Pencil size={16} />
            </button>
            <button type="button" onClick={() => canDelete && onDeleteTask(task.id)} className="flex h-11 w-11 items-center justify-center rounded-lg text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2] active:scale-90 transition-all">
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
            <button type="button" onClick={() => openAssign()} className="flex items-center active:scale-90 transition-transform">
              {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
                <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={28} />
              ) : (
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-dashed border-[#EAECF0] text-[#98A2B3]">
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
              className="text-[13px] font-bold text-[#101828] bg-[#F2F4F7] rounded-lg px-2 py-2 outline-none w-11 text-center min-h-[44px]"
            />
          </div>

          {/* Due Date */}
          {onDueDateChange && (
            <div className="flex-shrink-0 flex items-center relative" onClick={(e) => e.stopPropagation()}>
              <button
                type="button" onClick={openDatePicker}
                title={`Due Date: ${formatDate(task.dueDate)}`}
                className={`text-[12px] font-bold leading-none whitespace-nowrap bg-[#F2F4F7] px-2 py-2 rounded-lg min-h-[44px] ${dueClass === 'overdue' ? 'text-red-600 bg-red-50' : 'text-[#475467]'}`}
              >
                {formatDate(task.dueDate)}
              </button>
              <input ref={dateRef} type="date" value={task.dueDate || ''} onChange={(e) => onDueDateChange(task.id, e.target.value)} className="sr-only" />
            </div>
          )}
        </div>
      </div>

      {/* Status Portal */}
      {statusOpen && typeof document !== 'undefined' && createPortal(
        <div
          ref={statusPortalRef}
          style={{ position: 'fixed', top: `${statusPosition.top}px`, left: `${statusPosition.left}px`, width: '160px' }}
          className="z-[9999] overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-3 py-2 text-[11px] font-bold text-[#475467] border-b border-[#F2F4F7] uppercase tracking-wider">Move To</div>
          <div className="p-1">
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button key={s} onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                className={`w-full flex items-center px-3 py-2 text-[13px] font-medium rounded-lg transition-colors ${task.status?.toUpperCase() === s ? 'bg-[#EFF8FF] text-[#175CD3]' : 'text-[#344054] hover:bg-[#F9FAFB]'}`}
              >
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
          style={{ position: 'fixed', top: `${assignPosition.top}px`, left: `${assignPosition.left}px`, width: 'max-content', minWidth: '200px' }}
          className="z-[9999] overflow-hidden rounded-xl border border-[#D0D5DD] bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="px-4 py-2 text-[11px] font-bold text-[#475467] border-b border-[#F2F4F7] uppercase tracking-wider">Assign Member</div>
          <div className="max-h-[240px] overflow-y-auto p-1">
            {teamMembers.map((m) => (
              <button key={m.user.userId} onClick={() => { void onAssignTask(task.id, m.user.userId); setAssignOpen(false); }}
                className="flex w-full items-center gap-3 px-3 py-2 text-[13px] font-medium text-[#344054] hover:bg-[#F9FAFB] rounded-lg transition-colors"
              >
                <AssigneeAvatar name={m.user.fullName || m.user.username} profilePicUrl={m.user.profilePicUrl} size={24} />
                <span className="truncate">{m.user.fullName || m.user.username}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
