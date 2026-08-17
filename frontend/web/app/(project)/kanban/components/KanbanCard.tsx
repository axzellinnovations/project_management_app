'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Label } from '../types';
import { Calendar, GitBranch, GitPullRequest, MessageSquare, Paperclip, Check, X, Tag, Plus, ChevronDown, ChevronRight, Lock, RefreshCw, Pencil, Trash2, UserPen, UserRound } from 'lucide-react';
import { CIStatusBadge } from '@/components/ui';
import { resolveProfilePhotoUrl } from '@/lib/profile-photo';
import type { TeamMemberOption } from '../api';
import OverlayPortal from '@/components/ui/OverlayPortal';

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
  onOpenTask?: (taskId: number) => void;
  onInlineUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  onAssigneeChange?: (taskId: number, assigneeId: number | null) => Promise<void>;
  teamMembers?: TeamMemberOption[];
  usersMap?: Record<string, string | null>;
  labels?: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<Label | null>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
  isSyncing?: boolean;
}

const PRIORITY_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  URGENT: { border: 'border-l-red-500',    bg: 'bg-red-500/10',     text: 'text-red-500',     dot: 'bg-red-500' },
  HIGH:   { border: 'border-l-orange-500', bg: 'bg-orange-500/10',  text: 'text-orange-500',  dot: 'bg-orange-500' },
  MEDIUM: { border: 'border-l-amber-400',  bg: 'bg-amber-400/10',   text: 'text-amber-500',   dot: 'bg-amber-400' },
  LOW:    { border: 'border-l-emerald-400', bg: 'bg-emerald-500/10', text: 'text-emerald-500', dot: 'bg-emerald-400' },
};

const PRIORITY_LIST = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const LABEL_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function KanbanCard({
  task,
  onDelete,
  onOpenTask,
  onInlineUpdate,
  onAssigneeChange,
  teamMembers = [],
  usersMap,
  labels: allLabels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  isSyncing,
}: KanbanCardProps) {
  const avatarUrl =
    resolveProfilePhotoUrl(task.assigneePhotoUrl, task.assigneeId) ??
    (task.assigneeName ? resolveProfilePhotoUrl(usersMap?.[task.assigneeName]) : null);
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const pStyle = task.priority ? PRIORITY_COLORS[task.priority] : null;
  const priorityBorder = pStyle ? pStyle.border : 'border-l-transparent';
  const isBlocked = task.dependencies?.some(d => d.relation === 'BLOCKED_BY' && d.status !== 'DONE') ?? false;

  // Inline editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editPriority, setEditPriority] = useState(task.priority || 'MEDIUM');
  const [saving, setSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Inline date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Inline label picker
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState(LABEL_COLORS[0]);
  const [isSavingLabelEdit, setIsSavingLabelEdit] = useState(false);
  const [deletingLabelId, setDeletingLabelId] = useState<number | null>(null);
  const [isDeletingLabel, setIsDeletingLabel] = useState(false);
  const labelPickerRef = useRef<HTMLDivElement>(null);
  const assigneePickerRef = useRef<HTMLDivElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const [assigneeMenuPosition, setAssigneeMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isEditing) {
      queueMicrotask(() => {
        setEditTitle(task.title);
        setEditPriority(task.priority || 'MEDIUM');
      });
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isEditing, task.title, task.priority]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) {
        setShowLabelPicker(false);
        setEditingLabelId(null);
        setDeletingLabelId(null);
      }
      if (
        assigneePickerRef.current &&
        !assigneePickerRef.current.contains(e.target as Node) &&
        assigneeMenuRef.current &&
        !assigneeMenuRef.current.contains(e.target as Node)
      ) {
        setShowAssigneePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveInline = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    try {
      if (onInlineUpdate) await onInlineUpdate(task.id, { title: editTitle.trim(), priority: editPriority });
      setIsEditing(false);
    } catch (err) { console.error('Inline save failed:', err); }
    finally { setSaving(false); }
  };

  const handleCancelEdit = () => { setEditTitle(task.title); setEditPriority(task.priority || 'MEDIUM'); setIsEditing(false); };

  const handleSetDueDate = async (date: string | undefined) => {
    if (!onInlineUpdate) return;
    await onInlineUpdate(task.id, { dueDate: date, title: task.title });
    setShowDatePicker(false);
  };

  const handleSetLabel = async (labelId: number | undefined) => {
    if (!onInlineUpdate) return;
    await onInlineUpdate(task.id, { labelId: labelId, title: task.title });
    setShowLabelPicker(false);
  };

  const handleCreateNewLabel = async () => {
    if (!onCreateLabel || !newLabelName.trim()) return;
    const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
    if (label && onInlineUpdate) {
      await onInlineUpdate(task.id, { labelId: label.id, title: task.title });
    }
    setNewLabelName('');
    setShowLabelPicker(false);
  };

  const handleSaveLabelEdit = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!editingLabelId || !editLabelName.trim() || isSavingLabelEdit || !onUpdateLabel) return;
    setIsSavingLabelEdit(true);
    try {
      await onUpdateLabel(editingLabelId, editLabelName.trim(), editLabelColor);
      setEditingLabelId(null);
    } catch (err) {
      console.error('Failed to update label:', err);
    } finally {
      setIsSavingLabelEdit(false);
    }
  };

  const handleConfirmDeleteLabel = async (e: React.MouseEvent, labelId: number) => {
    e.stopPropagation();
    if (isDeletingLabel || !onDeleteLabel) return;
    setIsDeletingLabel(true);
    try {
      await onDeleteLabel(labelId);
      setDeletingLabelId(null);
    } catch (err) {
      console.error('Failed to delete label:', err);
    } finally {
      setIsDeletingLabel(false);
    }
  };

  const handleSetAssignee = async (assigneeId: number | null) => {
    if (!onAssigneeChange) return;
    await onAssigneeChange(task.id, assigneeId);
    setShowAssigneePicker(false);
  };

  const openAssigneePicker = (button: HTMLButtonElement) => {
    const rect = button.getBoundingClientRect();
    const menuWidth = 224;
    setAssigneeMenuPosition({
      top: Math.min(rect.bottom + 6, window.innerHeight - 48),
      left: Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)),
    });
    setShowAssigneePicker(o => !o);
  };

  const assigneeMenu = showAssigneePicker && assigneeMenuPosition ? (
    <OverlayPortal>
      <div
        ref={assigneeMenuRef}
        className="fixed z-[var(--cu-z-modal-popover)] w-56 rounded-xl border border-cu-border bg-cu-bg p-2 shadow-cu-xl"
        style={{ top: assigneeMenuPosition.top, left: assigneeMenuPosition.left }}
        onClick={e => e.stopPropagation()}
      >
        <p className="mb-1.5 text-[10px] font-medium text-cu-text-muted">Edit assignee</p>
        <div className="max-h-80 space-y-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => void handleSetAssignee(null)}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-cu-hover ${!task.assigneeName ? 'font-semibold text-cu-primary' : 'text-cu-text-secondary'}`}
          >
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-cu-bg-tertiary text-cu-text-muted">
              <UserRound size={11} />
            </span>
            <span className="min-w-0 truncate">Unassigned</span>
          </button>
          {teamMembers.map((member) => {
            const isSelected = task.assigneeId === member.id || task.assigneeId === member.memberId;
            return (
              <button
                key={member.id}
                type="button"
                onClick={() => void handleSetAssignee(member.id)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-cu-hover ${isSelected ? 'bg-cu-primary/5 font-semibold text-cu-primary' : 'text-cu-text-secondary'}`}
              >
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-cu-bg-tertiary text-[10px]">
                  {member.photoUrl ? (
                    <Image src={member.photoUrl} alt={member.name} width={20} height={20} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </span>
                <span className="min-w-0 truncate">{member.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </OverlayPortal>
  ) : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id.toString(),
    data: { type: 'task', taskId: task.id },
    disabled: isEditing,
  });

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return null; }
  };

  const dueDateFormatted = formatDate(task.dueDate);
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date(new Date().toDateString()) && task.status !== 'DONE';
  const isToday = task.dueDate && new Date(task.dueDate).toDateString() === new Date().toDateString();
  const hasOpenPopover = showDatePicker || showLabelPicker || showAssigneePicker;

  // Card background: overdue tasks get subtle reddish tint
  const cardBg = isOverdue ? 'bg-red-500/[0.06] dark:bg-red-500/[0.08]' : '';

  // ── INLINE EDIT MODE ──────────────────────────────────────
  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-lg glass-panel border-2 border-cu-primary p-3">
        <input ref={titleInputRef} type="text" maxLength={255} value={editTitle} onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSaveInline(); if (e.key === 'Escape') handleCancelEdit(); }}
          className="w-full text-[13px] font-medium text-cu-text-primary border-0 border-b border-cu-border pb-1.5 mb-2 focus:outline-none focus:border-cu-primary bg-transparent" placeholder="Task title..." />
        {editTitle.length > 200 && (
          <p className="text-xs text-amber-500 mt-1">
            {255 - editTitle.length} characters remaining
          </p>
        )}
        <div className="mb-2">
          <p className="text-[10px] text-cu-text-muted font-medium mb-1">Priority</p>
          <div className="flex gap-1">
            {PRIORITY_LIST.map(p => {
              const pc = PRIORITY_COLORS[p]; const isActive = editPriority === p;
              return (
                <button key={p} type="button" onClick={() => setEditPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${isActive ? `${pc.bg} ${pc.text} border-current` : 'bg-cu-bg-secondary text-cu-text-muted border-cu-border hover:border-cu-border'}`}>{p}</button>
              );
            })}
          </div>
        </div>
        <div className="mb-2">
          <p className="text-[10px] text-cu-text-muted font-medium mb-1">Assignee</p>
          <select
            value={teamMembers.find((member) => task.assigneeId === member.id || task.assigneeId === member.memberId)?.id ?? ''}
            onChange={(e) => void handleSetAssignee(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-lg border border-cu-border bg-cu-bg px-2 py-1.5 text-xs text-cu-text-primary focus:outline-none focus:ring-2 focus:ring-cu-primary/40"
            disabled={!onAssigneeChange || saving}
          >
            <option value="">Unassigned</option>
            {teamMembers.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </div>
        <div className="flex justify-end gap-1.5 pt-1 border-t border-cu-border">
          <button onClick={handleCancelEdit} disabled={saving} className="px-2 py-1 text-xs text-cu-text-secondary hover:text-cu-text-primary rounded transition-colors flex items-center gap-1"><X size={12} /> Cancel</button>
          <button onClick={() => void handleSaveInline()} disabled={saving || !editTitle.trim()}
            className="px-2.5 py-1 text-xs font-medium text-white bg-cu-primary rounded hover:bg-cu-primary-hover disabled:opacity-40 transition-colors flex items-center gap-1">
            {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      </div>
    );
  }

  // Normal display mode
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (!isDragging && onOpenTask) onOpenTask(task.id);
      }}
      className={`
        group relative rounded-lg glass-panel liquid-glass-interactive border-l-[3px] ${priorityBorder} ${cardBg}
        transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-cu-primary/50 scale-[1.02] rotate-[1deg]' : ''}
        ${isOverdue ? 'border-red-500/30' : ''}
        ${hasOpenPopover ? 'z-[var(--cu-z-modal-popover)]' : 'z-auto'}
      `}
    >
      {assigneeMenu}
      <div className="p-3">
        {/* Subtle syncing indicator when a background mutation is in-flight for this task */}
        {/** Position absolute to not affect layout */}
        {/** Renders a small spinner badge in the top-left */}
        {/* actual indicator (no-op placeholder removed) */}
        {/* Top row: labels + task ID */}
        {isSyncing && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-2 text-[11px] text-cu-text-muted">
            <div className="w-3 h-3 border border-cu-border border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">Syncing</span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex flex-wrap gap-1 min-w-0">
            {/* Show task labels: resolve from allLabels if task.labels not populated */}
            {(() => {
              const displayLabels = (task.labels && task.labels.length > 0)
                ? task.labels
                : (task.labelId && allLabels?.length)
                  ? allLabels.filter(l => l.id === task.labelId)
                  : [];
              return displayLabels.slice(0, 3).map((label) => (
                <span key={label.id} className="inline-flex max-w-full items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase"
                  style={{ backgroundColor: (label.color ?? '#6366F1') + '18', color: label.color ?? '#6366F1' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6366F1' }} />
                  <span className="min-w-0 truncate">{label.name}</span>
                </span>
              ));
            })()}
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <span className="text-[10px] text-cu-text-muted font-mono whitespace-nowrap px-1">#{task.id}</span>
            {onInlineUpdate && (
              <button
                data-action="edit"
                type="button"
                onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cu-text-muted hover:bg-cu-primary/10 hover:text-cu-primary transition-colors"
                title="Edit task"
                aria-label="Edit task"
              >
                <Pencil size={12} />
              </button>
            )}
            {onDelete && (
              <button
                data-action="delete"
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-cu-text-muted hover:bg-cu-danger/10 hover:text-cu-danger transition-colors"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Title */}
        <p className="mb-2 break-words text-[13px] font-medium leading-snug text-cu-text-primary line-clamp-2">{task.title}</p>

        {/* Priority and Blocked badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {isBlocked && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-500">
              <Lock size={10} className="flex-shrink-0" /> Blocked
            </div>
          )}
          {pStyle && task.priority && (
            <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${pStyle.text} ${pStyle.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} /> {task.priority}
            </div>
          )}
          {task.recurrenceRule && (
            <div
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                task.recurrenceActive === false
                  ? 'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30'
                  : 'bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/30'
              }`}
              title={task.recurrenceActive === false ? 'Recurring (Paused)' : `Recurring (${task.recurrenceRule})`}
            >
              <RefreshCw size={10} className="flex-shrink-0" />
              <span>Recurring{task.recurrenceActive === false ? ' (Paused)' : ''}</span>
            </div>
          )}
        </div>

        {/* Subtask checklist: ClickUp style */}
        {totalSubtasks > 0 && (
          <div className="mb-2">
            {/* Progress bar and Toggle */}
            <div 
              className="flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-cu-hover rounded-md p-0.5 -ml-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              data-action="toggle-subtasks"
            >
              {isExpanded ? <ChevronDown size={11} className="text-cu-text-muted" /> : <ChevronRight size={11} className="text-cu-text-muted" />}
              <GitBranch size={11} className="text-cu-text-muted flex-shrink-0" />
              <div className="flex-1 h-1 rounded-full bg-cu-bg-tertiary overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${subtaskPercent}%` }} />
              </div>
              <span className="text-[10px] text-cu-text-secondary font-medium whitespace-nowrap">{completedSubtasks}/{totalSubtasks}</span>
            </div>

            {/* Individual subtask items (only shown when expanded) */}
            {isExpanded && (
              <div className="space-y-1 pl-1">
                {task.subtasks!.map(st => (
                  <div key={st.id} className="relative bg-cu-bg-secondary/50 border border-cu-border rounded-md p-1.5 pl-2 mb-1 last:mb-0 hover:bg-cu-bg hover:border-cu-primary/30 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${st.status === 'DONE' ? 'bg-cu-primary border-cu-primary' : 'border-cu-border'}`}>
                        {st.status === 'DONE' && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] font-medium leading-tight ${st.status === 'DONE' ? 'text-cu-text-muted line-through' : 'text-cu-text-primary'}`}>
                        {st.title}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


        {/* Bottom meta row: due date (clickable), label (clickable), story points, assignee */}
        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {/* Due date: inline pickable */}
            <div className="relative" ref={datePickerRef}>
              <button
                data-action="date"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLabelPicker(false);
                  setShowAssigneePicker(false);
                  setShowDatePicker(o => !o);
                }}
                className={`flex items-center gap-1 text-[11px] rounded px-1 py-0.5 transition-colors ${
                  isOverdue ? 'text-red-500 font-semibold bg-red-500/10 hover:bg-red-500/20' :
                  isToday ? 'text-cu-primary font-medium bg-cu-primary/10 hover:bg-cu-primary/20' :
                  dueDateFormatted ? 'text-cu-text-secondary hover:bg-cu-hover' :
                  'text-cu-text-muted hover:bg-cu-hover'
                }`}
                title="Set due date"
              >
                <Calendar size={11} className={isOverdue ? 'text-red-500' : isToday ? 'text-cu-primary' : 'text-cu-text-muted'} />
                {isOverdue ? 'Overdue' : isToday ? 'Today' : dueDateFormatted || ''}
              </button>

              {showDatePicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-50 p-2 w-48" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-cu-text-muted mb-1.5">Due date</p>
                  <input
                    type="date"
                    value={task.dueDate || ''}
                    onChange={(e) => void handleSetDueDate(e.target.value || undefined)}
                    className="w-full px-2 py-1.5 border border-cu-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary"
                  />
                  {task.dueDate && (
                    <button onClick={() => void handleSetDueDate(undefined)}
                      className="mt-1 text-[10px] text-red-500 hover:text-red-700 transition-colors">Remove date</button>
                  )}
                </div>
              )}
            </div>

            {/* Label: inline pickable */}
            <div className="relative" ref={labelPickerRef}>
              <button
                data-action="label"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDatePicker(false);
                  setShowAssigneePicker(false);
                  setShowLabelPicker(o => !o);
                }}
                className="flex items-center gap-1 text-[11px] text-cu-text-muted hover:bg-cu-hover rounded px-1 py-0.5 transition-colors"
                title="Set label"
              >
                <Tag size={10} />
                {(() => {
                  const currentLabel = (task.labels && task.labels.length > 0)
                    ? task.labels[0]
                    : (task.labelId && allLabels?.length)
                      ? allLabels.find(l => l.id === task.labelId)
                      : null;
                  return currentLabel ? (
              <span className="max-w-[96px] truncate" style={{ color: currentLabel.color ?? '#6366F1' }}>{currentLabel.name}</span>
                  ) : null;
                })()}
              </button>

              {showLabelPicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl z-50 p-2 w-60" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-semibold text-cu-text-muted uppercase tracking-wider">Labels</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-0.5 mb-1.5">
                    {/* No label option */}
                    <button onClick={() => void handleSetLabel(undefined)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded-lg hover:bg-cu-hover transition-colors ${!task.labelId && (!task.labels || task.labels.length === 0) ? 'font-semibold text-cu-primary' : 'text-cu-text-secondary'}`}>
                      None
                    </button>
                    {allLabels?.map(l => {
                      const isAssigned = task.labelId === l.id || task.labels?.some(tl => tl.id === l.id);
                      const isEditing = editingLabelId === l.id;
                      const isDeleting = deletingLabelId === l.id;

                      if (isEditing) {
                        return (
                          <div key={l.id} className="p-1.5 bg-cu-primary/10 rounded-lg space-y-1 my-0.5 border border-cu-primary/30" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: editLabelColor }} />
                              <input
                                autoFocus
                                type="text"
                                value={editLabelName}
                                onChange={e => setEditLabelName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') void handleSaveLabelEdit();
                                  if (e.key === 'Escape') setEditingLabelId(null);
                                }}
                                className="flex-1 text-[11px] px-1 py-0.5 bg-cu-bg border border-cu-border rounded outline-none focus:border-cu-primary text-cu-text-primary min-w-0"
                              />
                              <button
                                type="button"
                                onClick={handleSaveLabelEdit}
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
                              {LABEL_COLORS.map(c => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setEditLabelColor(c)}
                                  className={`w-3 h-3 rounded-full transition-transform ${editLabelColor === c ? 'ring-2 ring-offset-1 ring-cu-primary scale-110' : ''}`}
                                  style={{ backgroundColor: c }}
                                />
                              ))}
                            </div>
                          </div>
                        );
                      }

                      if (isDeleting) {
                        return (
                          <div key={l.id} className="p-1.5 bg-red-500/10 rounded-lg flex items-center justify-between gap-1 my-0.5 border border-red-500/30" onClick={e => e.stopPropagation()}>
                            <span className="text-[10px] font-medium text-red-500 truncate">
                              Delete &quot;{l.name}&quot;?
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => void handleConfirmDeleteLabel(e, l.id)}
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

                      return (
                        <div key={l.id} className={`group flex items-center justify-between gap-1 px-2 py-1 rounded-lg hover:bg-cu-hover transition-colors ${isAssigned ? 'font-semibold text-cu-primary bg-cu-primary/5' : 'text-cu-text-secondary'}`}>
                          <button
                            type="button"
                            onClick={() => void handleSetLabel(l.id)}
                            className="flex-1 flex items-center gap-2 text-left min-w-0 text-xs py-0.5"
                          >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                            <span className="truncate">{l.name}</span>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {isAssigned && <Check size={11} className="text-cu-primary mr-1" />}
                            {onUpdateLabel && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLabelId(l.id);
                                  setEditLabelName(l.name);
                                  setEditLabelColor(l.color || LABEL_COLORS[0]);
                                  setDeletingLabelId(null);
                                }}
                                title="Edit label"
                                className="p-0.5 text-cu-text-muted hover:text-cu-primary hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Pencil size={10} />
                              </button>
                            )}
                            {onDeleteLabel && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingLabelId(l.id);
                                  setEditingLabelId(null);
                                }}
                                title="Delete label"
                                className="p-0.5 text-cu-text-muted hover:text-red-500 hover:bg-cu-bg rounded opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Create new label */}
                  {onCreateLabel && (
                    <div className="border-t border-cu-border pt-1.5">
                      <p className="text-[10px] font-medium text-cu-text-muted mb-1">New label</p>
                      <div className="flex items-center gap-1">
                        <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void handleCreateNewLabel(); }}
                          placeholder="Name..." className="flex-1 px-1.5 py-1 border border-cu-border rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary" />
                        <button onClick={() => void handleCreateNewLabel()} disabled={!newLabelName.trim()}
                          className="p-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors">
                          <Plus size={10} />
                        </button>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {LABEL_COLORS.map(c => (
                          <button key={c} onClick={() => setNewLabelColor(c)}
                            className={`w-4 h-4 rounded-full transition-transform ${newLabelColor === c ? 'ring-2 ring-offset-1 ring-blue-400 scale-110' : ''}`}
                            style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Story points */}
            {task.storyPoint != null && task.storyPoint > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded bg-violet-500/10 text-violet-500 text-[10px] font-bold px-1">{task.storyPoint}</span>
            )}

            {/* Comment count */}
            {task.commentCount != null && task.commentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-cu-text-muted"><MessageSquare size={10} /><span>{task.commentCount}</span></div>
            )}

            {/* Attachment count */}
            {task.attachmentCount != null && task.attachmentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-cu-text-muted"><Paperclip size={10} /><span>{task.attachmentCount}</span></div>
            )}

            {/* GitHub: CI status (icon-only) + open PR count */}
            {task.ciStatus && (
              <CIStatusBadge status={task.ciStatus} size="sm" showLabel={false} />
            )}
            {(task.openPrCount ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-purple-500">
                <GitPullRequest size={9} aria-hidden="true" />
                {task.openPrCount}
              </span>
            )}
          </div>

          {/* Assignee */}
          <div className="relative min-w-0 flex-shrink-0" ref={assigneePickerRef}>
            <button
              data-action="assignee"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowDatePicker(false);
                setShowLabelPicker(false);
                openAssigneePicker(e.currentTarget);
              }}
              className="group flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-[11px] font-bold text-white shadow-sm ring-2 ring-cu-bg transition-all hover:ring-cu-primary/40"
              title={task.assigneeName ? `Edit assignee: ${task.assigneeName}` : 'Assign task'}
              aria-label={task.assigneeName ? `Edit assignee for ${task.title}` : `Assign ${task.title}`}
            >
              {task.assigneeName ? (
                avatarUrl ? (
                  <Image src={avatarUrl} alt={task.assigneeName} width={28} height={28} className="h-full w-full object-cover" unoptimized />
                ) : (
                  task.assigneeName.charAt(0).toUpperCase()
                )
              ) : (
                <UserPen size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
