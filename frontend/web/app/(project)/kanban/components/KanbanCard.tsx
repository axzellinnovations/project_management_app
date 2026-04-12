'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task, Label } from '../types';
import { Calendar, GitBranch, MessageSquare, Paperclip, Check, X, Tag, Plus, ChevronDown, ChevronRight } from 'lucide-react';

interface KanbanCardProps {
  task: Task;
  onDelete?: (taskId: number) => void;
  onEdit?: (task: Task) => void;
  onOpenTask?: (taskId: number) => void;
  onInlineUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  usersMap?: Record<string, string | null>;
  labels?: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
}

const PRIORITY_COLORS: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  URGENT: { border: 'border-l-red-500',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-500' },
  HIGH:   { border: 'border-l-orange-500', bg: 'bg-orange-50',  text: 'text-orange-600',  dot: 'bg-orange-500' },
  MEDIUM: { border: 'border-l-amber-400',  bg: 'bg-amber-50',   text: 'text-amber-600',   dot: 'bg-amber-400' },
  LOW:    { border: 'border-l-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-400' },
};

const PRIORITY_LIST = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;

const LABEL_COLORS = ['#6366F1', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#EC4899', '#8B5CF6', '#14B8A6'];

export default function KanbanCard({ task, onDelete, onEdit, onOpenTask, onInlineUpdate, usersMap, labels: allLabels, onCreateLabel }: KanbanCardProps) {
  const avatarUrl =
    (task.assigneePhotoUrl && task.assigneePhotoUrl.startsWith('http') ? task.assigneePhotoUrl : null) ??
    (task.assigneeName && usersMap?.[task.assigneeName]?.startsWith('http') ? usersMap[task.assigneeName] : null);
  const completedSubtasks = task.subtasks?.filter((s) => s.status === 'DONE').length ?? 0;
  const totalSubtasks = task.subtasks?.length ?? 0;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const pStyle = task.priority ? PRIORITY_COLORS[task.priority] : null;
  const priorityBorder = pStyle ? pStyle.border : 'border-l-transparent';

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
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0]);
  const labelPickerRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title);
      setEditPriority(task.priority || 'MEDIUM');
      setTimeout(() => titleInputRef.current?.focus(), 50);
    }
  }, [isEditing, task.title, task.priority]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) setShowDatePicker(false);
      if (labelPickerRef.current && !labelPickerRef.current.contains(e.target as Node)) setShowLabelPicker(false);
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

  // Card background: overdue tasks get subtle reddish tint
  const cardBg = isOverdue ? 'bg-red-50/60' : 'bg-white';

  // ── INLINE EDIT MODE ──────────────────────────────────────
  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style} className="rounded-lg bg-white border-2 border-blue-400 shadow-lg p-3">
        <input ref={titleInputRef} type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSaveInline(); if (e.key === 'Escape') handleCancelEdit(); }}
          className="w-full text-[13px] font-medium text-gray-800 border-0 border-b border-gray-200 pb-1.5 mb-2 focus:outline-none focus:border-blue-400 bg-transparent" placeholder="Task title..." />
        <div className="mb-2">
          <p className="text-[10px] text-gray-500 font-medium mb-1">Priority</p>
          <div className="flex gap-1">
            {PRIORITY_LIST.map(p => {
              const pc = PRIORITY_COLORS[p]; const isActive = editPriority === p;
              return (
                <button key={p} type="button" onClick={() => setEditPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${isActive ? `${pc.bg} ${pc.text} border-current` : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'}`}>{p}</button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end gap-1.5 pt-1 border-t border-gray-100">
          <button onClick={handleCancelEdit} disabled={saving} className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 rounded transition-colors flex items-center gap-1"><X size={12} /> Cancel</button>
          <button onClick={() => void handleSaveInline()} disabled={saving || !editTitle.trim()}
            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1">
            {saving ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Check size={12} />} Save
          </button>
        </div>
      </div>
    );
  }

  // ── NORMAL DISPLAY MODE ───────────────────────────────────
  return (
    <div
      ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-action]')) return;
        if (!isDragging && onOpenTask) onOpenTask(task.id);
      }}
      className={`
        group relative rounded-lg ${cardBg} border border-gray-200/80 border-l-[3px] ${priorityBorder}
        shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]
        transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-blue-400/50 scale-[1.02] rotate-[1deg]' : 'hover:border-gray-300'}
        ${isOverdue ? 'border-red-200/80' : ''}
      `}
    >
      {/* Hover action bar */}
      {(onInlineUpdate || onDelete) && (
        <div className="absolute -top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 flex items-center gap-0.5 bg-white border border-gray-200 rounded-md shadow-sm px-0.5 py-0.5">
          {onInlineUpdate && (
            <button data-action="edit" onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
          )}
          {onDelete && (
            <button data-action="delete" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      )}

      <div className="p-3">
        {/* Top row: labels + task ID */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex flex-wrap gap-1 min-w-0">
            {/* Show task labels — resolve from allLabels if task.labels not populated */}
            {(() => {
              const displayLabels = (task.labels && task.labels.length > 0)
                ? task.labels
                : (task.labelId && allLabels?.length)
                  ? allLabels.filter(l => l.id === task.labelId)
                  : [];
              return displayLabels.slice(0, 3).map((label) => (
                <span key={label.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: (label.color ?? '#6366F1') + '18', color: label.color ?? '#6366F1' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: label.color ?? '#6366F1' }} />
                  {label.name}
                </span>
              ));
            })()}
          </div>
          <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap flex-shrink-0">#{task.id}</span>
        </div>

        {/* Title */}
        <p className="text-[13px] font-medium text-gray-800 leading-snug line-clamp-2 mb-2">{task.title}</p>

        {/* Priority badge */}
        {pStyle && task.priority && (
          <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold mb-2 ${pStyle.text} ${pStyle.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${pStyle.dot}`} /> {task.priority}
          </div>
        )}

        {/* Subtask checklist — ClickUp style */}
        {totalSubtasks > 0 && (
          <div className="mb-2">
            {/* Progress bar and Toggle */}
            <div 
              className="flex items-center gap-2 mb-1.5 cursor-pointer hover:bg-gray-50 rounded-md p-0.5 -ml-0.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              data-action="toggle-subtasks"
            >
              {isExpanded ? <ChevronDown size={11} className="text-gray-500" /> : <ChevronRight size={11} className="text-gray-500" />}
              <GitBranch size={11} className="text-gray-400 flex-shrink-0" />
              <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${subtaskPercent}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">{completedSubtasks}/{totalSubtasks}</span>
            </div>

            {/* Individual subtask items (only shown when expanded) */}
            {isExpanded && (
              <div className="space-y-1 pl-1">
                {task.subtasks!.map(st => (
                  <div key={st.id} className="relative bg-gray-50/50 border border-gray-200/60 rounded-md p-1.5 pl-2 mb-1 last:mb-0 hover:bg-white hover:border-blue-200 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="flex items-start gap-2">
                      <div className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${st.status === 'DONE' ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                        {st.status === 'DONE' && <Check size={10} className="text-white" />}
                      </div>
                      <span className={`text-[11px] font-medium leading-tight ${st.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
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
            {/* Due date — inline pickable */}
            <div className="relative" ref={datePickerRef}>
              <button
                data-action="date"
                onClick={(e) => { e.stopPropagation(); setShowDatePicker(o => !o); }}
                className={`flex items-center gap-1 text-[11px] rounded px-1 py-0.5 transition-colors ${
                  isOverdue ? 'text-red-600 font-semibold bg-red-100 hover:bg-red-200' :
                  isToday ? 'text-blue-600 font-medium bg-blue-50 hover:bg-blue-100' :
                  dueDateFormatted ? 'text-gray-500 hover:bg-gray-100' :
                  'text-gray-400 hover:bg-gray-100'
                }`}
                title="Set due date"
              >
                <Calendar size={11} className={isOverdue ? 'text-red-500' : isToday ? 'text-blue-500' : 'text-gray-400'} />
                {isOverdue ? 'Overdue' : isToday ? 'Today' : dueDateFormatted || ''}
              </button>

              {showDatePicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 w-48" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-gray-500 mb-1.5">Due date</p>
                  <input
                    type="date"
                    value={task.dueDate || ''}
                    onChange={(e) => void handleSetDueDate(e.target.value || undefined)}
                    className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  {task.dueDate && (
                    <button onClick={() => void handleSetDueDate(undefined)}
                      className="mt-1 text-[10px] text-red-500 hover:text-red-700 transition-colors">Remove date</button>
                  )}
                </div>
              )}
            </div>

            {/* Label — inline pickable */}
            <div className="relative" ref={labelPickerRef}>
              <button
                data-action="label"
                onClick={(e) => { e.stopPropagation(); setShowLabelPicker(o => !o); }}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:bg-gray-100 rounded px-1 py-0.5 transition-colors"
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
                    <span style={{ color: currentLabel.color ?? '#6366F1' }}>{currentLabel.name}</span>
                  ) : null;
                })()}
              </button>

              {showLabelPicker && (
                <div className="absolute bottom-full left-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2 w-52" onClick={e => e.stopPropagation()}>
                  <p className="text-[10px] font-medium text-gray-500 mb-1.5">Labels</p>
                  <div className="max-h-32 overflow-y-auto space-y-0.5 mb-1.5">
                    {/* No label option */}
                    <button onClick={() => void handleSetLabel(undefined)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 transition-colors ${!task.labelId ? 'font-semibold text-blue-600' : 'text-gray-600'}`}>
                      None
                    </button>
                    {allLabels?.map(l => (
                      <button key={l.id} onClick={() => void handleSetLabel(l.id)}
                        className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-gray-50 transition-colors flex items-center gap-2 ${task.labelId === l.id ? 'font-semibold text-blue-600 bg-blue-50/50' : 'text-gray-600'}`}>
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color ?? '#6366F1' }} />
                        {l.name}
                      </button>
                    ))}
                  </div>

                  {/* Create new label */}
                  {onCreateLabel && (
                    <div className="border-t border-gray-100 pt-1.5">
                      <p className="text-[10px] font-medium text-gray-400 mb-1">New label</p>
                      <div className="flex items-center gap-1">
                        <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') void handleCreateNewLabel(); }}
                          placeholder="Name..." className="flex-1 px-1.5 py-1 border border-gray-200 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-blue-400" />
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
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded bg-violet-50 text-violet-600 text-[10px] font-bold px-1">{task.storyPoint}</span>
            )}

            {/* Comment count */}
            {task.commentCount != null && task.commentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-gray-400"><MessageSquare size={10} /><span>{task.commentCount}</span></div>
            )}

            {/* Attachment count */}
            {task.attachmentCount != null && task.attachmentCount > 0 && (
              <div className="flex items-center gap-0.5 text-[11px] text-gray-400"><Paperclip size={10} /><span>{task.attachmentCount}</span></div>
            )}
          </div>

          {/* Assignee avatar */}
          {task.assigneeName && (
            <div className="flex-shrink-0" title={task.assigneeName}>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-[11px] font-bold flex items-center justify-center overflow-hidden ring-2 ring-white shadow-sm">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={task.assigneeName} width={28} height={28} className="w-full h-full object-cover" unoptimized />
                ) : (
                  task.assigneeName.charAt(0).toUpperCase()
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
