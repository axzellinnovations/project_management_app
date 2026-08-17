'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, Loader2, Pencil, Plus, Tag, Trash2, UserPlus, RefreshCw, X } from 'lucide-react';
import AssigneeAvatar from '../AssigneeAvatar';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { STATUS_LABELS, DUE_CHIP_STYLES, type TaskStatus, formatDate } from './TaskRowConstants';
import type { TaskRowProps } from '../TaskRow';
import { useTaskRowState } from './useTaskRowState';

const LABEL_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16',
  '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#6366F1', '#8B5CF6', '#EC4899', '#6B7280',
];

function getMemberName(m: NonNullable<TaskRowProps['teamMembers']>[number]) {
  return m.user.fullName || m.user.username;
}

export default function DesktopTaskRow(props: TaskRowProps) {
  const {
    task, projectKey, teamMembers = [], loadingMembers = false,
    canDelete = true, showCheckbox = false, onToggle, onStatusChange,
    onStoryPointsChange, onAssignTask, onAssignMultiple, onDueDateChange, onDeleteTask,
    onOpenTask, projectLabels = [], onAddLabel, onCreateLabel,
    onUpdateLabel, onDeleteLabel,
    extraStatuses = [], hideStatus = false,
  } = props;

  const [assignMode, setAssignMode] = React.useState<'single' | 'multi'>('multi');
  const [assignSearch, setAssignSearch] = React.useState('');

  const state = useTaskRowState(task, props);
  const {
    statusOpen, setStatusOpen, assignOpen, setAssignOpen,
    labelOpen, setLabelOpen, renaming, renameValue, setRenameValue,
    labelInput, setLabelInput, creatingLabel,
    editingLabelId, setEditingLabelId, editLabelName, setEditLabelName,
    editLabelColor, setEditLabelColor, isSavingLabelEdit,
    deletingLabelId, setDeletingLabelId, isDeletingLabel,
    statusPosition, assignPosition, labelPosition,
    statusRef, assignRef, labelRef, dateRef,
    statusPortalRef, assignPortalRef, labelPortalRef,
    lastTapRef,
    onTouchStartInternal, onTouchEndInternal, onTouchMoveInternal,
    startRename, updateLastTap, commitRename, cancelRename,
    taskLabelIds, openLabel, handleLabelToggle, handleCreateLabelFromInput,
    handleSaveLabelEdit, handleConfirmDeleteLabel,
    openStatus, openAssign, openDatePicker,
    displayLabel, displayStyle, dueClass, statusBorderColor, priorityKey, priorityStyle,
  } = state;

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

  const filteredMembers = React.useMemo(() => {
    if (!assignSearch.trim()) return teamMembers;
    const q = assignSearch.toLowerCase();
    return teamMembers.filter((m) => getMemberName(m).toLowerCase().includes(q) || m.user.username.toLowerCase().includes(q));
  }, [teamMembers, assignSearch]);

  const displayTaskKey = projectKey ? `#${projectKey}-${task.taskNo || task.id}` : `#${task.taskNo || task.id}`;

  const rowBg =
    dueClass === 'five_days' ? 'bg-amber-50 dark:bg-amber-900/15'
    : dueClass === 'old' ? 'bg-cu-danger-light'
    : dueClass === 'overdue' || dueClass === 'today' ? 'bg-cu-danger-light'
    : dueClass === 'soon' ? 'bg-cu-bg-secondary'
    : 'bg-cu-bg';

  return (
    <div
      className={`group relative flex items-center min-h-[40px] rounded-lg border-2 border-transparent ${rowBg} hover:opacity-90 transition-colors duration-150`}
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
            className="h-4 w-4 rounded border-cu-border accent-cu-primary cursor-pointer"
            aria-label={`Select ${task.title}`}
          />
        </div>
      )}

      {/* Task number */}
      <div className="flex-shrink-0 w-[130px] pl-2 pr-1 flex items-center justify-start">
        <span className="inline-flex max-w-full items-center rounded-md bg-cu-bg-secondary px-2 py-0.5 text-[11px] font-semibold tabular-nums text-cu-text-secondary truncate" title={displayTaskKey}>
          {displayTaskKey}
        </span>
      </div>

      {/* Priority */}
      <div className="flex-shrink-0 w-[78px] px-1 flex items-center" onClick={(e) => e.stopPropagation()}>
        <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold uppercase tracking-wide truncate ${priorityStyle}`}>
          {priorityStyle ? priorityKey : '—'}
        </span>
      </div>

      {/* Title */}
      <div className="flex-1 min-w-0 px-2 flex items-center gap-2 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {renaming ? (
          <div className="flex-1 min-w-0">
            <input
              type="text" value={renameValue}
              maxLength={255}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); void commitRename(); }
                if (e.key === 'Escape') cancelRename();
              }}
              onBlur={() => void commitRename()}
              autoFocus
              className="w-full border-b-2 border-cu-primary bg-transparent text-[12px] font-semibold text-cu-text-primary outline-none"
            />
            {renameValue.length > 200 && (
              <p className="text-xs text-amber-500 mt-1">{255 - renameValue.length} characters remaining</p>
            )}
          </div>
        ) : (
          <>
            <span
              className={`text-[12px] font-medium truncate min-w-0 select-none ${
                dueClass === 'five_days' ? 'text-amber-800 dark:text-amber-300' :
                task.status?.toUpperCase() === 'DONE' ? 'line-through text-cu-text-muted' : 'text-cu-text-primary'
              }`}
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
            {task.recurrenceRule && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                  task.recurrenceActive === false
                    ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
                    : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
                }`}
                title={task.recurrenceActive === false ? 'Recurring (Paused)' : `Recurring (${task.recurrenceRule})`}
              >
                <RefreshCw size={9} className="flex-shrink-0" />
                <span>Recurring{task.recurrenceActive === false ? ' (Paused)' : ''}</span>
              </span>
            )}
            {task.labels?.[0] && (
              <span style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')} className="flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap border border-white/40">
                {task.labels[0].name}
              </span>
            )}
          </>
        )}
      </div>

      {/* Assignee */}
      <div className="flex-shrink-0 w-[52px] flex items-center justify-center relative" ref={assignRef} onClick={(e) => e.stopPropagation()}>
        <button type="button"
          title={
            task.assignees && task.assignees.length > 0
              ? task.assignees.map((a) => a.name).join(', ')
              : (task.assigneeName || 'Assign')
          }
          onClick={() => openAssign()}
          className="flex items-center"
        >
          {task.assignees && task.assignees.length > 0 ? (
            // Multi-assignee avatar stack
            <div className="flex items-center">
              {task.assignees.slice(0, 3).map((a, idx) => (
                <span
                  key={a.userId ?? a.memberId ?? a.id ?? idx}
                  className="inline-block ring-2 ring-cu-bg rounded-full"
                  style={{ marginLeft: idx === 0 ? 0 : -6, zIndex: task.assignees!.length - idx }}
                >
                  <AssigneeAvatar name={a.name} profilePicUrl={a.photoUrl || a.avatar || a.profilePicUrl} size={20} />
                </span>
              ))}
              {task.assignees.length > 3 && (
                <span
                  className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cu-primary/10 ring-2 ring-cu-bg text-[9px] font-bold text-cu-primary"
                  style={{ marginLeft: -6 }}
                >
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          ) : task.assigneeName && task.assigneeName !== 'Unassigned' ? (
            <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
          ) : (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-dashed border-cu-border hover:border-cu-primary transition-colors">
              <UserPlus size={11} className="text-cu-text-secondary" />
            </div>
          )}
        </button>
        {assignOpen && typeof document !== 'undefined' && createPortal(
          <div ref={assignPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-56 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: assignPosition.top, left: assignPosition.left }}>
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-cu-border bg-cu-bg-secondary">
              <span className="text-[10px] font-bold text-cu-text-secondary uppercase tracking-wider">Assign To</span>
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

            {teamMembers.length > 5 && (
              <div className="p-1.5 border-b border-cu-border">
                <input
                  type="text"
                  placeholder="Search members..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="w-full text-[11px] px-2 py-1 rounded-md border border-cu-border bg-cu-bg-secondary text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:border-cu-primary"
                />
              </div>
            )}

            {loadingMembers ? (
              <div className="px-3 py-3 text-[12px] text-cu-text-secondary">Loading…</div>
            ) : filteredMembers.length > 0 ? (
              <div className="max-h-52 overflow-y-auto py-1">
                <button
                  type="button"
                  onClick={() => void handleClearAssignees()}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-cu-hover ${currentAssigneeUserIds.length === 0 ? 'text-cu-primary font-semibold' : 'text-cu-text-secondary'}`}
                >
                  <span>Unassigned</span>
                  {currentAssigneeUserIds.length === 0 && <span className="text-cu-primary font-bold">✓</span>}
                </button>

                {filteredMembers.map((m) => {
                  const isSelected = currentAssigneeUserIds.includes(m.user.userId);
                  return (
                    <button
                      key={m.user.userId}
                      type="button"
                      onClick={() => void handleToggleMember(m.user.userId)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-1.5 text-[12px] font-medium transition-colors hover:bg-cu-hover ${isSelected ? 'text-cu-primary bg-cu-primary/5 font-semibold' : 'text-cu-text-primary'}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AssigneeAvatar name={getMemberName(m)} profilePicUrl={m.user.profilePicUrl} size={20} />
                        <span className="truncate">{getMemberName(m)}</span>
                      </div>
                      {isSelected && (
                        <span className="flex-shrink-0 text-cu-primary font-bold text-[11px]">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-3 text-[12px] text-cu-text-secondary">No members found</div>
            )}
          </div>,
          document.body
        )}
      </div>


      {/* Status dropdown */}
      {!hideStatus && (
        <div className="flex-shrink-0 w-[116px] px-1 flex items-center relative" ref={statusRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => openStatus()}
            className={`flex h-6 w-full items-center justify-between gap-1 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide transition-all ${displayStyle}`}
          >
            <span className="truncate">{displayLabel}</span>
            <ChevronDown size={9} className="flex-shrink-0 opacity-60" />
          </button>
          {statusOpen && typeof document !== 'undefined' && createPortal(
            <div ref={statusPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-32 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: statusPosition.top, left: statusPosition.left }}>
              {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                <button key={s} onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-cu-hover ${task.status?.toUpperCase() === s ? 'text-cu-primary' : 'text-cu-text-primary'}`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {extraStatuses.length > 0 && <div className="border-t border-cu-border my-1" />}
              {extraStatuses.map((s) => (
                <button key={s.value} onClick={() => { onStatusChange(task.id, s.value); setStatusOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-[11px] font-bold hover:bg-cu-hover ${task.status?.toUpperCase() === s.value ? 'text-cu-primary' : 'text-cu-text-primary'}`}
                >
                  {s.label}
                </button>
              ))}
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Due date */}
      {onDueDateChange && (
        <div className="flex-shrink-0 w-[88px] px-1 flex items-center relative" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={openDatePicker} title={dueClass === 'overdue' ? formatDate(task.dueDate) : undefined}
            className={`flex h-6 w-full items-center justify-center gap-1 rounded-md px-2 text-[10px] font-bold transition-all border ${
              dueClass === 'none' ? 'bg-cu-bg border-cu-border text-cu-text-secondary hover:bg-cu-hover' : DUE_CHIP_STYLES[dueClass]
            }`}
          >
            <CalendarDays size={10} className="flex-shrink-0 opacity-60" />
            <span className="truncate">{dueClass === 'overdue' ? 'Overdue' : formatDate(task.dueDate)}</span>
          </button>
          <input ref={dateRef} type="date" value={task.dueDate || ''} onChange={(e) => onDueDateChange(task.id, e.target.value)} className="sr-only" />
        </div>
      )}

      {/* Story points */}
      <div className="flex-shrink-0 w-[40px] px-1 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex h-6 w-full items-center justify-center rounded-md border border-cu-border bg-cu-bg-secondary">
          <input type="number" min="0" value={task.storyPoints}
            onChange={(e) => onStoryPointsChange(task.id, Number(e.target.value))}
            className="w-full text-center text-[12px] font-bold text-cu-text-primary outline-none bg-transparent"
          />
        </div>
      </div>

      {/* Label picker */}
      {(onAddLabel || onCreateLabel) && (
        <div className="flex-shrink-0 w-[26px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" ref={labelRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => { if (labelOpen) setLabelOpen(false); else openLabel(); }} title="Labels"
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${labelOpen ? 'bg-cu-primary-light text-cu-primary' : 'text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light'}`}
          >
            <Tag size={12} />
          </button>
          {labelOpen && typeof document !== 'undefined' && createPortal(
            <div ref={labelPortalRef} className="fixed z-[var(--cu-z-dropdown)] w-60 overflow-hidden rounded-xl border border-cu-border bg-cu-bg shadow-cu-xl" style={{ top: labelPosition.top, left: labelPosition.left }}>
              {/* Search or Create input */}
              <div className="p-2 border-b border-cu-border bg-cu-bg-secondary/40 space-y-1.5">
                <div className="flex items-center gap-1 bg-cu-bg border border-cu-border rounded-lg px-2 py-1 focus-within:border-cu-primary focus-within:ring-1 focus-within:ring-cu-primary/20 transition-all">
                  <input autoFocus type="text" value={labelInput}
                    onChange={(e) => setLabelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleCreateLabelFromInput();
                      }
                      if (e.key === 'Escape') {
                        setLabelOpen(false);
                        setLabelInput('');
                        setEditingLabelId(null);
                        setDeletingLabelId(null);
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Search or new label…" disabled={creatingLabel}
                    className="flex-1 text-[11px] text-cu-text-primary placeholder:text-cu-text-tertiary bg-transparent outline-none min-w-0"
                  />
                  {labelInput.trim() && !projectLabels.some(l => l.name.toLowerCase() === labelInput.trim().toLowerCase()) && onCreateLabel && (
                    <button
                      type="button"
                      onClick={() => void handleCreateLabelFromInput()}
                      disabled={creatingLabel}
                      className="p-1 rounded bg-cu-primary text-white hover:bg-cu-primary/90 transition-colors"
                      title="Create label"
                    >
                      {creatingLabel ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Labels list */}
              <div className="max-h-52 overflow-y-auto p-1 divide-y divide-cu-border/30">
                {(() => {
                  const term = labelInput.toLowerCase().trim();
                  const filtered = term
                    ? projectLabels.filter(l => l.name.toLowerCase().includes(term))
                    : projectLabels;

                  if (filtered.length === 0) {
                    return (
                      <div className="px-3 py-3 text-[11px] text-center text-cu-text-tertiary">
                        {term ? `No labels matching "${labelInput}"` : 'No labels yet'}
                      </div>
                    );
                  }

                  return filtered.map((label) => {
                    const active = taskLabelIds.has(label.id);
                    const isEditing = editingLabelId === label.id;
                    const isDeleting = deletingLabelId === label.id;

                    // Inline Edit
                    if (isEditing) {
                      return (
                        <div key={label.id} className="p-1.5 bg-cu-primary/10 rounded-lg space-y-1 my-0.5 border border-cu-primary/30" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: editLabelColor }} />
                            <input
                              autoFocus
                              type="text"
                              value={editLabelName}
                              onChange={(e) => setEditLabelName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void handleSaveLabelEdit(label.id, editLabelName, editLabelColor);
                                }
                                if (e.key === 'Escape') setEditingLabelId(null);
                              }}
                              className="flex-1 text-[11px] px-1 py-0.5 bg-cu-bg border border-cu-border rounded outline-none focus:border-cu-primary text-cu-text-primary min-w-0"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSaveLabelEdit(label.id, editLabelName, editLabelColor)}
                              disabled={!editLabelName.trim() || isSavingLabelEdit}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                              title="Save"
                            >
                              <Check size={10} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingLabelId(null)}
                              className="p-1 rounded bg-cu-bg-secondary text-cu-text-secondary hover:bg-cu-hover"
                              title="Cancel"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {LABEL_PALETTE.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditLabelColor(c)}
                                className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${
                                  editLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    }

                    // Inline Delete Confirmation
                    if (isDeleting) {
                      return (
                        <div key={label.id} className="p-1.5 bg-red-500/10 rounded-lg flex items-center justify-between gap-1 my-0.5 border border-red-500/30" onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] font-medium text-red-500 truncate">
                            Delete &quot;{label.name}&quot;?
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleConfirmDeleteLabel(label.id)}
                              disabled={isDeletingLabel}
                              className="px-1.5 py-0.5 text-[9px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingLabelId(null)}
                              className="px-1.5 py-0.5 text-[9px] bg-cu-bg-secondary text-cu-text-secondary rounded hover:bg-cu-hover"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Normal row
                    return (
                      <div
                        key={label.id}
                        className={`group flex items-center justify-between gap-1 px-2 py-1 rounded-lg hover:bg-cu-hover transition-colors ${
                          active ? 'bg-cu-primary/5' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); void handleLabelToggle(label); }}
                          className="flex-1 flex items-center gap-2 text-left min-w-0 py-0.5"
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6B7280' }} />
                          <span className={`flex-1 truncate text-[11px] ${active ? 'text-cu-primary font-bold' : 'text-cu-text-primary font-medium'}`}>
                            {label.name}
                          </span>
                          {active && (
                            <span className="h-3.5 w-3.5 rounded-full bg-cu-primary flex items-center justify-center flex-shrink-0 mr-1">
                              <svg width="7" height="7" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </span>
                          )}
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {onUpdateLabel && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingLabelId(label.id);
                                setEditLabelName(label.name);
                                setEditLabelColor(label.color || LABEL_PALETTE[0]);
                                setDeletingLabelId(null);
                              }}
                              title="Edit label"
                              className="p-0.5 text-cu-text-muted hover:text-cu-primary hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                            >
                              <Pencil size={10} />
                            </button>
                          )}
                          {onDeleteLabel && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingLabelId(label.id);
                                setEditingLabelId(null);
                              }}
                              title="Delete label"
                              className="p-0.5 text-cu-text-muted hover:text-red-500 hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all focus:opacity-100"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>,
            document.body
          )}
        </div>
      )}

      {/* Rename / Delete actions */}
      <div className="flex-shrink-0 w-[52px] pl-1 pr-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={startRename} title="Rename" className="flex h-6 w-6 items-center justify-center rounded-md text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary-light transition-all">
          <Pencil size={12} />
        </button>
        <button type="button" onClick={() => canDelete && onDeleteTask(task.id)} disabled={!canDelete} title={canDelete ? 'Delete task' : 'Viewers cannot delete tasks'}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all ${canDelete ? 'text-cu-text-secondary hover:text-cu-danger hover:bg-cu-danger-light' : 'text-cu-text-muted cursor-not-allowed'}`}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}
