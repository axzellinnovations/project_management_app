'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Task, Label, KanbanColumn as KanbanColumnType } from '../types';
import KanbanCard from './KanbanCard';
import { MoreHorizontal, Check, AlertTriangle, Plus } from 'lucide-react';
import { COLUMN_SWATCH_COLORS } from '../constants';
import {
  renameKanbanColumn,
  updateKanbanColumnSettings,
  TeamMemberOption,
} from '../api';

/** Status to accent color for the top indicator bar */
const STATUS_ACCENT: Record<string, string> = {
  TODO:        '#94A3B8',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW:   '#F59E0B',
  DONE:        '#22C55E',
  BLOCKED:     '#EF4444',
};

/** Convert status like IN_PROGRESS to "In Progress" */
function humanizeStatus(status: string | null | undefined): string {
  if (!status) return 'Untitled';
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

interface KanbanColumnProps {
  column: KanbanColumnType;
  columnId?: number;
  color?: string;
  wipLimit?: number;
  onDeleteTask?: (taskId: number) => void;
  onCreateTask?: (title: string, status: string) => Promise<void> | void;
  onOpenTask?: (taskId: number) => void;
  onInlineUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  onAssigneeChange?: (taskId: number, assigneeId: number | null) => Promise<void>;
  teamMembers?: TeamMemberOption[];
  usersMap?: Record<string, string | null>;
  labels?: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onUpdateLabel?: (id: number, name: string, color: string) => Promise<Label | null>;
  onDeleteLabel?: (id: number) => Promise<boolean>;
  onColumnRenamed?: (columnId: number, name: string) => void;
  onColumnSettingsChanged?: (columnId: number, settings: { color?: string; wipLimit?: number }) => void;
  onDeleteColumn?: (columnId: number) => Promise<void> | void;
  updatingTaskId?: number | null;
}

type MenuMode = 'main' | 'rename' | 'wip' | 'color' | 'confirmDelete';

export default function KanbanColumn({
  column,
  columnId,
  color,
  wipLimit = 0,
  onDeleteTask,
  onCreateTask,
  onOpenTask,
  onInlineUpdate,
  onAssigneeChange,
  teamMembers = [],
  usersMap,
  labels: allLabels,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onColumnRenamed,
  onColumnSettingsChanged,
  onDeleteColumn,
  updatingTaskId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.status,
    data: { type: 'column', columnStatus: column.status },
  });

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>('main');
  const [renameValue, setRenameValue] = useState(column.title);
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const [inlineTitleLength, setInlineTitleLength] = useState(0);
  const [wipValue, setWipValue] = useState(String(wipLimit ?? 0));
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const taskCount = column.tasks.length;
  const wipExceeded = wipLimit && wipLimit > 0 && taskCount > wipLimit;
  const accentColor = color || STATUS_ACCENT[column.status] || '#94A3B8';
  // Use the column title from config; fall back to humanized status
  const displayTitle = column.title || humanizeStatus(column.status);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMenuMode('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (menuMode === 'rename') setTimeout(() => renameInputRef.current?.focus(), 50);
  }, [menuMode]);

  useEffect(() => {
    if (showInlineCreate) setTimeout(() => inlineInputRef.current?.focus(), 50);
  }, [showInlineCreate]);

  const handleRenameSubmit = async () => {
    if (!columnId || !renameValue.trim()) return;
    try {
      await renameKanbanColumn(columnId, renameValue.trim());
      onColumnRenamed?.(columnId, renameValue.trim());
    } catch { setRenameValue(column.title); }
    setMenuOpen(false);
    setMenuMode('main');
  };

  const handleWipSubmit = async () => {
    if (!columnId) return;
    const num = parseInt(wipValue, 10);
    const value = isNaN(num) || num < 0 ? 0 : num;
    try {
      await updateKanbanColumnSettings(columnId, { wipLimit: value });
      onColumnSettingsChanged?.(columnId, { wipLimit: value });
    } catch { setWipValue(String(wipLimit ?? 0)); }
    setMenuOpen(false);
    setMenuMode('main');
  };

  const handleColorSelect = async (hex: string) => {
    if (!columnId) return;
    try {
      await updateKanbanColumnSettings(columnId, { color: hex });
      onColumnSettingsChanged?.(columnId, { color: hex });
    } catch { /* ignore */ }
    setMenuOpen(false);
    setMenuMode('main');
  };

  const handleDeleteConfirm = () => {
    if (!columnId) return;
    onDeleteColumn?.(columnId);
    setMenuOpen(false);
    setMenuMode('main');
  };

  const handleInlineCreate = async () => {
    if (!inlineTitle.trim() || !onCreateTask) return;
    await onCreateTask(inlineTitle.trim(), column.status);
    setInlineTitle('');
    setInlineTitleLength(0);
    setShowInlineCreate(false);
  };

  const taskIds = column.tasks.map((task) => task.id.toString());

  return (
    <div
      className={`flex flex-col rounded-xl glass-panel transition-all duration-200 ${
        isOver ? 'ring-2 ring-cu-primary/40 bg-cu-primary/5' : ''
      }`}
      style={{ minWidth: '280px' }}
    >
      {/* Colored top indicator bar */}
      <div
        className="h-1.5 rounded-t-xl"
        style={{ backgroundColor: accentColor }}
      />

      {/* Column Header: always visible, prominent title */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {/* Status dot */}
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-cu-bg-secondary"
            style={{ backgroundColor: accentColor }}
          />
          {/* Column title — large and bold */}
          <h3 className="font-bold text-[15px] text-cu-text-primary truncate leading-tight">
            {displayTitle}
          </h3>
          {/* Task count */}
          {wipExceeded ? (
            <span className="flex flex-shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
              <AlertTriangle size={10} className="flex-shrink-0" />
              {taskCount}/{wipLimit}
            </span>
          ) : (
            <span
              className="inline-flex h-[22px] min-w-[22px] flex-shrink-0 items-center justify-center rounded-full px-1.5 text-[12px] font-bold"
              style={{
                backgroundColor: accentColor + '18',
                color: accentColor,
              }}
            >
              {taskCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onCreateTask && (
            <button
              onClick={() => setShowInlineCreate(true)}
              className="p-1 rounded-md text-cu-text-muted hover:text-cu-primary hover:bg-cu-primary/10 transition-colors"
              title="Add task"
            >
              <Plus size={16} />
            </button>
          )}

          {columnId && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(o => !o); setMenuMode('main'); }}
                className="p-1 rounded-md text-cu-text-muted hover:text-cu-text-secondary hover:bg-cu-hover transition-colors"
                title="Column options"
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-cu-border bg-cu-bg py-1 shadow-cu-xl">
                  {menuMode === 'main' && (
                    <>
                      <button onClick={() => setMenuMode('rename')} className="w-full px-3 py-2 text-left text-sm text-cu-text-primary transition-colors hover:bg-cu-hover">Rename column</button>
                      <button onClick={() => { setWipValue(String(wipLimit ?? 0)); setMenuMode('wip'); }} className="w-full px-3 py-2 text-left text-sm text-cu-text-primary transition-colors hover:bg-cu-hover">Set WIP limit</button>
                      <button onClick={() => setMenuMode('color')} className="w-full px-3 py-2 text-left text-sm text-cu-text-primary transition-colors hover:bg-cu-hover">Change color</button>
                      <div className="border-t border-cu-border my-1" />
                      <button
                        onClick={() => { if (taskCount === 0) setMenuMode('confirmDelete'); }}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${taskCount > 0 ? 'cursor-not-allowed text-cu-text-muted/50' : 'text-cu-danger hover:bg-cu-danger/10'}`}
                        title={taskCount > 0 ? 'Move all tasks out first' : undefined}
                      >
                        <span className="inline-flex max-w-full items-center">
                          <span className="truncate">Delete column</span>
                          {taskCount > 0 && <span className="ml-1 flex-shrink-0 text-[10px]">(has tasks)</span>}
                        </span>
                      </button>
                    </>
                  )}
                  {menuMode === 'rename' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-cu-text-muted mb-1.5">Rename column</p>
                      <input ref={renameInputRef} type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleRenameSubmit(); if (e.key === 'Escape') { setMenuMode('main'); setRenameValue(column.title); } }}
                        className="w-full px-2.5 py-1.5 border border-cu-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => void handleRenameSubmit()} className="flex-1 py-1.5 bg-cu-primary text-white rounded-lg text-xs font-medium hover:bg-cu-primary-hover transition-colors">Save</button>
                        <button onClick={() => { setMenuMode('main'); setRenameValue(column.title); }} className="flex-1 py-1.5 border border-cu-border text-cu-text-secondary rounded-lg text-xs hover:bg-cu-hover transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                  {menuMode === 'wip' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-cu-text-muted mb-1">WIP limit <span className="font-normal">(0 = unlimited)</span></p>
                      <input type="number" min={0} value={wipValue} onChange={e => setWipValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleWipSubmit(); }}
                        className="w-full px-2.5 py-1.5 border border-cu-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/40 bg-cu-bg text-cu-text-primary" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => void handleWipSubmit()} className="flex-1 py-1.5 bg-cu-primary text-white rounded-lg text-xs font-medium hover:bg-cu-primary-hover transition-colors">Save</button>
                        <button onClick={() => setMenuMode('main')} className="flex-1 py-1.5 border border-cu-border text-cu-text-secondary rounded-lg text-xs hover:bg-cu-hover transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                  {menuMode === 'color' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-cu-text-muted mb-2">Column color</p>
                      <div className="grid grid-cols-3 gap-2">
                        {COLUMN_SWATCH_COLORS.map(swatch => (
                          <button key={swatch.value} onClick={() => void handleColorSelect(swatch.value)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-cu-hover transition-colors" title={swatch.label}>
                            <span className="w-7 h-7 rounded-lg border border-cu-border flex items-center justify-center" style={{ backgroundColor: swatch.value }}>
                              {color === swatch.value && <Check size={12} className="text-cu-text-secondary" />}
                            </span>
                            <span className="max-w-full truncate text-[9px] text-cu-text-muted">{swatch.label}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setMenuMode('main')} className="w-full mt-2 py-1.5 border border-cu-border text-cu-text-secondary rounded-lg text-xs hover:bg-cu-hover transition-colors">Back</button>
                    </div>
                  )}
                  {menuMode === 'confirmDelete' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-cu-danger mb-1">Delete column?</p>
                      <p className="text-[11px] text-cu-text-muted mb-2">This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={handleDeleteConfirm} className="flex-1 py-1.5 bg-cu-danger text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">Delete</button>
                        <button onClick={() => setMenuMode('main')} className="flex-1 py-1.5 border border-cu-border text-cu-text-secondary rounded-lg text-xs hover:bg-cu-hover transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Column Content: droppable zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-2 pb-2 space-y-2 transition-colors duration-200 ${
          isOver ? 'bg-cu-primary/5' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin' }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
              {column.tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-cu-bg-tertiary flex items-center justify-center mb-3">
                <svg className="text-cu-text-muted" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <p className="text-sm text-cu-text-muted font-medium">No tasks yet</p>
              <p className="text-xs text-cu-text-muted/60 mt-0.5">Drag cards here or create a new task</p>
            </div>
          ) : (
            column.tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onDelete={onDeleteTask}
                onOpenTask={onOpenTask}
                onInlineUpdate={onInlineUpdate}
                onAssigneeChange={onAssigneeChange}
                teamMembers={teamMembers}
                usersMap={usersMap}
                labels={allLabels}
                onCreateLabel={onCreateLabel}
                onUpdateLabel={onUpdateLabel}
                onDeleteLabel={onDeleteLabel}
                isSyncing={updatingTaskId === task.id}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Inline Create Task */}
      {onCreateTask && (
        <div className="px-2 pb-2">
          {showInlineCreate ? (
            <div className="bg-cu-bg rounded-lg border border-cu-primary/30 shadow-cu-sm p-2">
              <input
                ref={inlineInputRef} type="text" value={inlineTitle}
                maxLength={255}
                onChange={e => {
                  setInlineTitle(e.target.value);
                  setInlineTitleLength(e.target.value.length);
                }}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && inlineTitle.trim()) await handleInlineCreate();
                  else if (e.key === 'Escape') { setInlineTitle(''); setInlineTitleLength(0); setShowInlineCreate(false); }
                }}
                placeholder="Task name..."
                className="w-full border-0 bg-transparent px-2 py-1.5 text-sm text-cu-text-primary placeholder:text-cu-text-muted focus:outline-none focus:ring-0"
              />
              {inlineTitleLength > 200 && (
                <p className="text-xs text-amber-500 mt-1">
                  {255 - inlineTitleLength} characters remaining
                </p>
              )}
              <div className="flex items-center justify-end mt-1.5 gap-1.5">
                <button onClick={() => { setInlineTitle(''); setInlineTitleLength(0); setShowInlineCreate(false); }}
                  className="px-2.5 py-1 text-xs text-cu-text-secondary hover:text-cu-text-primary rounded transition-colors">Cancel</button>
                <button onClick={handleInlineCreate} disabled={!inlineTitle.trim()}
                  className="px-3 py-1 text-xs font-medium text-white bg-cu-primary rounded hover:bg-cu-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInlineCreate(true)}
              className="group flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary"
            >
              <Plus size={14} className="text-cu-text-muted group-hover:text-cu-primary transition-colors" />
              <span className="truncate">Add task</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
