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
} from '../api';

/** Status → accent color for the top indicator bar */
const STATUS_ACCENT: Record<string, string> = {
  TODO:        '#94A3B8',
  IN_PROGRESS: '#3B82F6',
  IN_REVIEW:   '#F59E0B',
  DONE:        '#22C55E',
  BLOCKED:     '#EF4444',
};

/** Convert status like IN_PROGRESS → "In Progress" */
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
  onCreateTask?: (title: string, status: string) => Promise<void>;
  onEditTask?: (task: Task) => void;
  onOpenTask?: (taskId: number) => void;
  onInlineUpdate?: (taskId: number, updates: Partial<Task>) => Promise<void>;
  usersMap?: Record<string, string | null>;
  labels?: Label[];
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onColumnRenamed?: (columnId: number, name: string) => void;
  onColumnSettingsChanged?: (columnId: number, settings: { color?: string; wipLimit?: number }) => void;
  onDeleteColumn?: (columnId: number) => void;
}

type MenuMode = 'main' | 'rename' | 'wip' | 'color' | 'confirmDelete';

export default function KanbanColumn({
  column,
  columnId,
  color,
  wipLimit = 0,
  onDeleteTask,
  onCreateTask,
  onEditTask,
  onOpenTask,
  onInlineUpdate,
  usersMap,
  labels: allLabels,
  onCreateLabel,
  onColumnRenamed,
  onColumnSettingsChanged,
  onDeleteColumn,
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
    setShowInlineCreate(false);
  };

  const taskIds = column.tasks.map((task) => task.id.toString());

  return (
    <div
      className={`flex flex-col rounded-xl bg-[#F8F9FB] border border-gray-200/60 transition-all duration-200 ${
        isOver ? 'ring-2 ring-blue-400/40 bg-blue-50/30' : ''
      }`}
      style={{ minWidth: '280px' }}
    >
      {/* Colored top indicator bar */}
      <div
        className="h-1.5 rounded-t-xl"
        style={{ backgroundColor: accentColor }}
      />

      {/* Column Header — always visible, prominent title */}
      <div className="px-3.5 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Status dot */}
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white"
            style={{ backgroundColor: accentColor }}
          />
          {/* Column title — large and bold */}
          <h3 className="font-bold text-[15px] text-gray-900 truncate leading-tight">
            {displayTitle}
          </h3>
          {/* Task count */}
          {wipExceeded ? (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full whitespace-nowrap">
              <AlertTriangle size={10} />
              {taskCount}/{wipLimit}
            </span>
          ) : (
            <span
              className="inline-flex items-center justify-center min-w-[22px] h-[22px] rounded-full text-[12px] font-bold px-1.5"
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
              className="p-1 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Add task"
            >
              <Plus size={16} />
            </button>
          )}

          {columnId && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => { setMenuOpen(o => !o); setMenuMode('main'); }}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200/60 transition-colors"
                title="Column options"
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl w-52 py-1">
                  {menuMode === 'main' && (
                    <>
                      <button onClick={() => setMenuMode('rename')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Rename column</button>
                      <button onClick={() => { setWipValue(String(wipLimit ?? 0)); setMenuMode('wip'); }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Set WIP limit</button>
                      <button onClick={() => setMenuMode('color')} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Change color</button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { if (taskCount === 0) setMenuMode('confirmDelete'); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${taskCount > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                        title={taskCount > 0 ? 'Move all tasks out first' : undefined}
                      >
                        Delete column{taskCount > 0 && <span className="ml-1 text-[10px]">(has tasks)</span>}
                      </button>
                    </>
                  )}
                  {menuMode === 'rename' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-500 mb-1.5">Rename column</p>
                      <input ref={renameInputRef} type="text" value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleRenameSubmit(); if (e.key === 'Escape') { setMenuMode('main'); setRenameValue(column.title); } }}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => void handleRenameSubmit()} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">Save</button>
                        <button onClick={() => { setMenuMode('main'); setRenameValue(column.title); }} className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                  {menuMode === 'wip' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">WIP limit <span className="font-normal">(0 = unlimited)</span></p>
                      <input type="number" min={0} value={wipValue} onChange={e => setWipValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') void handleWipSubmit(); }}
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => void handleWipSubmit()} className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">Save</button>
                        <button onClick={() => setMenuMode('main')} className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                  {menuMode === 'color' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Column color</p>
                      <div className="grid grid-cols-3 gap-2">
                        {COLUMN_SWATCH_COLORS.map(swatch => (
                          <button key={swatch.value} onClick={() => void handleColorSelect(swatch.value)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-gray-50 transition-colors" title={swatch.label}>
                            <span className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center" style={{ backgroundColor: swatch.value }}>
                              {color === swatch.value && <Check size={12} className="text-gray-600" />}
                            </span>
                            <span className="text-[9px] text-gray-500">{swatch.label}</span>
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setMenuMode('main')} className="w-full mt-2 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">Back</button>
                    </div>
                  )}
                  {menuMode === 'confirmDelete' && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-red-600 mb-1">Delete column?</p>
                      <p className="text-[11px] text-gray-500 mb-2">This cannot be undone.</p>
                      <div className="flex gap-2">
                        <button onClick={handleDeleteConfirm} className="flex-1 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">Delete</button>
                        <button onClick={() => setMenuMode('main')} className="flex-1 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50 transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Column Content — droppable zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto px-2 pb-2 space-y-2 transition-colors duration-200 ${
          isOver ? 'bg-blue-50/30' : ''
        }`}
        style={{ maxHeight: 'calc(100vh - 260px)', scrollbarWidth: 'thin' }}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {column.tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">No tasks yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Drag cards here or create a new task</p>
            </div>
          ) : (
            column.tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                onDelete={onDeleteTask}
                onEdit={onEditTask}
                onOpenTask={onOpenTask}
                onInlineUpdate={onInlineUpdate}
                usersMap={usersMap}
                labels={allLabels}
                onCreateLabel={onCreateLabel}
              />
            ))
          )}
        </SortableContext>
      </div>

      {/* Inline Create Task */}
      {onCreateTask && (
        <div className="px-2 pb-2">
          {showInlineCreate ? (
            <div className="bg-white rounded-lg border border-blue-200 shadow-sm p-2">
              <input
                ref={inlineInputRef} type="text" value={inlineTitle}
                onChange={e => setInlineTitle(e.target.value)}
                onKeyDown={async e => {
                  if (e.key === 'Enter' && inlineTitle.trim()) await handleInlineCreate();
                  else if (e.key === 'Escape') { setInlineTitle(''); setShowInlineCreate(false); }
                }}
                placeholder="Task name..."
                className="w-full text-sm px-2 py-1.5 border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400"
              />
              <div className="flex items-center justify-end mt-1.5 gap-1.5">
                <button onClick={() => { setInlineTitle(''); setShowInlineCreate(false); }}
                  className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 rounded transition-colors">Cancel</button>
                <button onClick={handleInlineCreate} disabled={!inlineTitle.trim()}
                  className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Add</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowInlineCreate(true)}
              className="w-full flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 rounded-lg py-1.5 px-2 transition-colors group"
            >
              <Plus size={14} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
              Add task
            </button>
          )}
        </div>
      )}
    </div>
  );
}
