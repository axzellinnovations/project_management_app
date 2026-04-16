'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, Pencil, Tag, Trash2, UserPlus } from 'lucide-react';
import AssigneeAvatar from '../AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { STATUS_LABELS, DUE_CHIP_STYLES, type TaskStatus, formatDate } from './TaskRowConstants';
import type { TaskRowProps } from '../TaskRow';
import { useTaskRowState } from './useTaskRowState';

// ── Desktop Task Row ─────────────────────────────────────────────────────────

export default function DesktopTaskRow(props: TaskRowProps) {
  const {
    task, projectKey, teamMembers = [], loadingMembers = false,
    canDelete = true, showCheckbox = false, onToggle, onStatusChange,
    onStoryPointsChange, onAssignTask, onDueDateChange, onDeleteTask,
    onOpenTask, projectLabels = [], onAddLabel, onRemoveLabel, onCreateLabel,
    extraStatuses = [],
  } = props;

  const {
    // Refs – only used for DOM attachment (ref={…}), never read during render
    statusRef, assignRef, labelRef, dateRef,
    statusPortalRef, assignPortalRef, labelPortalRef,
    lastTapRef,
    // State values – safe to read during render
    statusOpen, setStatusOpen,
    assignOpen, setAssignOpen,
    labelOpen, setLabelOpen,
    renaming, setRenaming,
    renameValue, setRenameValue,
    labelInput, setLabelInput,
    creatingLabel,
    statusPosition, assignPosition, labelPosition,
    // Handlers / callbacks
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename,
    taskLabelIds, openLabel, handleLabelToggle, handleCreateLabelFromInput,
    openStatus, openAssign, openDatePicker,
    // Derived display values
    displayLabel, displayStyle, dueClass, statusBorderColor, priorityKey, priorityStyle,
  } = useTaskRowState(task, {
    canDelete, onDeleteTask, onRenameTask: props.onRenameTask,
    onAddLabel, onRemoveLabel, onCreateLabel, extraStatuses, projectLabels,
  });

  const displayTaskKey = projectKey ? `#${projectKey}-${task.taskNo || task.id}` : `#${task.taskNo || task.id}`;
  const getMemberName = (m: NonNullable<typeof teamMembers>[number]) => m.user.fullName || m.user.username;

  const rowBg =
    dueClass === 'overdue' || dueClass === 'today' ? 'bg-[#FEE2E2]'
    : dueClass === 'soon' ? 'bg-[#FFFDF5]'
    : 'bg-white';

  return (
    <div
      className={`group relative flex items-center min-h-[40px] rounded-lg border border-transparent ${rowBg} hover:bg-[#F9FAFB] hover:border-[#EAECF0] cursor-pointer transition-colors duration-150`}
      style={{ borderLeft: `3px solid ${statusBorderColor}` }}
      onClick={() => { if (!renaming) onOpenTask?.(task.id); }}
      onTouchStart={onTouchStartInternal}
      onTouchEnd={onTouchEndInternal}
      onTouchMove={onTouchMoveInternal}
    >
      {/* Checkbox */}
      {showCheckbox && (
        <div className="pl-2 pr-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox" checked={task.selected ?? false}
            onChange={() => onToggle?.(task.id)}
            className="h-4 w-4 rounded border-[#D0D5DD] text-[#155DFC] focus:ring-[#155DFC]/20 cursor-pointer"
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Task number */}
      <div className="flex-shrink-0 w-[130px] pl-2 pr-1 flex items-center justify-start">
        <span className="inline-flex max-w-full items-center rounded-md bg-[#F8F9FC] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#667085] truncate" title={displayTaskKey}>
          {displayTaskKey}
        </span>
      </div>

      {/* Priority */}
      <div className="flex-shrink-0 w-[78px] px-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide truncate ${priorityStyle}`}>
          {priorityKey}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 px-2 flex items-center gap-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {renaming ? (
          <input
            type="text" value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            onBlur={() => void commitRename()}
            autoFocus
            className="w-full border-b-2 border-[#175CD3] bg-transparent text-[12px] font-semibold text-[#101828] outline-none"
          />
        ) : (
          <>
            <span
              className={`text-[12px] font-medium text-[#101828] truncate min-w-0 select-none ${task.status.toUpperCase() === 'DONE' ? 'line-through text-[#98A2B3]' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                const now = Date.now();
                if (lastTapRef.current > 0 && now - lastTapRef.current < 300) {
                  startRename(e);
                  updateLastTap(0);
                } else {
                  updateLastTap(now);
                  onOpenTask?.(task.id);
                }
              }}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(e); }}
            >
              {task.title}
            </span>
            {task.labels?.[0] && (
              <span style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')} className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border border-white/40">
                {task.labels[0].name}
              </span>
            )}
          </>
        )}
      </div>

      {/* Assignee */}
      <div className="flex-shrink-0 w-[36px] flex items-center justify-center relative" ref={assignRef} onClick={(e) => e.stopPropagation()}>
        <button type="button" title={task.assigneeName || 'Assign'} onClick={() => openAssign()} className="flex items-center justify-center">
          {task.assigneeName && task.assigneeName !== 'Unassigned' ? (
            <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
          ) : (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-[#EAECF0] hover:border-[#155DFC] transition-colors">
              <UserPlus size={11} className="text-[#667085]" />
            </div>
          )}
        </button>
        {assignOpen && typeof document !== 'undefined' && createPortal(
          <div ref={assignPortalRef} className="fixed z-[9999] w-52 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl" style={{ top: assignPosition.top, left: assignPosition.left }}>
            <div className="px-3 py-2 text-[10px] font-bold text-[#667085] uppercase tracking-wider border-b border-[#F2F4F7] bg-[#F9FAFB]">Assign To</div>
            {loadingMembers ? (
              <div className="px-3 py-3 text-[12px] text-[#667085]">Loading…</div>
            ) : teamMembers.length > 0 ? (
              <div className="max-h-52 overflow-y-auto">
                {teamMembers.map((m) => (
                  <button key={m.user.userId} onClick={() => { void onAssignTask(task.id, m.user.userId); setAssignOpen(false); }}
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
      <div className="flex-shrink-0 w-[116px] px-1 flex items-center relative" ref={statusRef} onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => openStatus()}
          className={`flex h-6 w-full items-center justify-between gap-1 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide transition-all ${displayStyle}`}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown size={9} className="flex-shrink-0 opacity-60" />
        </button>
        {statusOpen && typeof document !== 'undefined' && createPortal(
          <div ref={statusPortalRef} className="fixed z-[9999] w-32 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl" style={{ top: statusPosition.top, left: statusPosition.left }}>
            {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
              <button key={s} onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB] ${task.status?.toUpperCase() === s ? 'text-[#155DFC]' : ''}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {extraStatuses.length > 0 && <div className="border-t border-[#EAECF0] my-1" />}
            {extraStatuses.map((s) => (
              <button key={s.value} onClick={() => { onStatusChange(task.id, s.value); setStatusOpen(false); }}
                className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-[#F9FAFB] ${task.status?.toUpperCase() === s.value ? 'text-[#155DFC]' : ''}`}
              >
                {s.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>

      {/* Due date */}
      {onDueDateChange && (
        <div className="flex-shrink-0 w-[88px] px-1 flex items-center relative" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={openDatePicker}
            className={`flex h-6 w-full items-center justify-center gap-1 rounded-md px-2 text-[10px] font-bold transition-all border ${
              dueClass === 'none' ? 'bg-white border-[#EAECF0] text-[#667085] hover:bg-gray-50' : DUE_CHIP_STYLES[dueClass]
            }`}
          >
            <CalendarDays size={10} className="flex-shrink-0 opacity-60" />
            <span className="truncate">{formatDate(task.dueDate)}</span>
          </button>
          <input ref={dateRef} type="date" value={task.dueDate || ''} onChange={(e) => onDueDateChange(task.id, e.target.value)} className="sr-only" />
        </div>
      )}

      {/* Story points */}
      <div className="flex-shrink-0 w-[40px] px-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-6 w-full items-center justify-center rounded-md border border-[#EAECF0] bg-[#F9FAFB]">
          <input type="number" min="0" value={task.storyPoints}
            onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
            className="w-full text-center text-[12px] font-bold text-[#101828] outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Label picker */}
      {(onAddLabel || onCreateLabel) && (
        <div className="flex-shrink-0 w-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" ref={labelRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { if (labelOpen) setLabelOpen(false); else openLabel(); }} title="Labels"
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${labelOpen ? 'bg-[#EFF8FF] text-[#175CD3]' : 'text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF]'}`}
          >
            <Tag size={12} />
          </button>
          {labelOpen && typeof document !== 'undefined' && createPortal(
            <div ref={labelPortalRef} className="fixed z-[9999] w-56 overflow-hidden rounded-xl border border-[#E4E7EC] bg-white shadow-xl" style={{ top: labelPosition.top, left: labelPosition.left }}>
              <div className="px-3 py-2 border-b border-[#F2F4F7]">
                <input autoFocus type="text" value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateLabelFromInput(); } if (e.key === 'Escape') { setLabelOpen(false); setLabelInput(''); } }}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="New label name + Enter" disabled={creatingLabel}
                  className="w-full text-[12px] text-[#101828] placeholder-[#98A2B3] bg-transparent outline-none"
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {projectLabels.length === 0 && <div className="px-3 py-3 text-[12px] text-[#98A2B3]">No labels yet</div>}
                {projectLabels.map((label) => {
                  const active = taskLabelIds.has(label.id);
                  return (
                    <button key={label.id} type="button" onClick={(e) => { e.stopPropagation(); void handleLabelToggle(label); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[12px] hover:bg-[#F9FAFB] transition-colors"
                    >
                      <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6B7280' }} />
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

      {/* Rename / Delete actions */}
      <div className="flex-shrink-0 w-[52px] pl-1 pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={startRename} title="Rename" className="flex h-6 w-6 items-center justify-center rounded-md text-[#667085] hover:text-[#175CD3] hover:bg-[#EFF8FF] transition-all">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => canDelete && onDeleteTask(task.id)} disabled={!canDelete} title={canDelete ? 'Delete task' : 'Viewers cannot delete tasks'}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${canDelete ? 'text-[#667085] hover:text-[#D92D20] hover:bg-[#FEF3F2]' : 'text-[#D0D5DD] cursor-not-allowed'}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
