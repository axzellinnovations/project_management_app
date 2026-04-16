'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Sprintcolumn } from '../types';
import SprintCard from './SprintCard';
import { Plus, GripVertical, ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import { SprintTeamMemberOption } from '../api';

interface SprintColumnProps {
  column: Sprintcolumn;
  onInlineCreate?: (title: string, status: string) => Promise<void>;
  onOpenTask?: (id: number) => void;
  dense?: boolean;
  compactEmpty?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: (status: string) => void;
  selectedTaskIds?: Set<number>;
  onToggleTaskSelected?: (taskId: number, selected: boolean) => void;
  onUpdateTaskDueDate?: (taskId: number, dueDate: string | null) => Promise<void>;
  onAssignTaskSingle?: (taskId: number, userId: number) => Promise<void>;
  onAssignTaskMultiple?: (taskId: number, assigneeIds: number[]) => Promise<void>;
  teamMembers?: SprintTeamMemberOption[];
  projectKey?: string;
}

export default function SprintColumn({
  column,
  onInlineCreate,
  onOpenTask,
  dense = false,
  compactEmpty = true,
  collapsed = false,
  onToggleCollapsed,
  selectedTaskIds,
  onToggleTaskSelected,
  onUpdateTaskDueDate,
  onAssignTaskSingle,
  onAssignTaskMultiple,
  teamMembers = [],
  projectKey,
}: SprintColumnProps) {
  const [inlineOpen, setInlineOpen] = useState(false);
  const [inlineTitle, setInlineTitle] = useState('');
  const { setNodeRef } = useDroppable({
    id: column.columnStatus,
    data: { type: 'column', columnStatus: column.columnStatus },
  });

  const getColumnBgColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'TODO':
        return 'bg-[#F8FAFC]';
      case 'IN_PROGRESS':
        return 'bg-[#FFF8F1]';
      case 'IN_REVIEW':
        return 'bg-[#FAF5FF]';
      case 'DONE':
        return 'bg-[#F0FDF4]';
      default:
        return 'bg-gray-50';
    }
  };

  const getTitleColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'TODO':
        return 'text-[#175CD3]';
      case 'IN_PROGRESS':
        return 'text-[#B54708]';
      case 'IN_REVIEW':
        return 'text-[#6941C6]';
      case 'DONE':
        return 'text-[#027A48]';
      default:
        return 'text-gray-700';
    }
  };

  const taskIds = column.tasks.map((task) => task.taskId.toString());
  const sortable = useSortable({ id: `column-${column.id}` });
  const sortableStyle = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  const isEmpty = column.tasks.length === 0;
  const isCompact = compactEmpty && isEmpty && !inlineOpen && !collapsed;
  const columnWidth = collapsed ? 72 : (isCompact ? 220 : (dense ? 300 : 330));
  const storyPoints = column.tasks.reduce((sum, task) => sum + (task.storyPoint ?? 0), 0);
  const overdue = column.tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE').length;

  return (
    <motion.div 
      whileHover={{ scale: 1.005, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
      transition={{ duration: 0.2 }}
      animate={{ width: columnWidth }}
      style={sortableStyle}
      className={`flex flex-col h-full min-w-0 rounded-xl border border-gray-200/80 ${getColumnBgColor(column.columnStatus)} p-2 snap-center snap-always shadow-sm transition-all duration-200`}
    >
      {/* Column Header */}
      <div className="sticky top-0 z-10 rounded-lg border border-gray-100/80 bg-white/90 backdrop-blur px-2.5 py-2 flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onToggleCollapsed?.(column.columnStatus)}
            className="rounded-md p-0.5 text-gray-500 hover:bg-gray-100"
            title={collapsed ? 'Expand column' : 'Collapse column'}
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="rounded-md p-0.5 text-gray-400 hover:bg-gray-100"
            title="Drag to reorder column"
          >
            <GripVertical size={13} className="text-gray-300" />
          </button>
          {!collapsed && (
          <h3 className={`font-semibold text-[12px] uppercase tracking-wider truncate ${getTitleColor(column.columnStatus)}`}>
            {column.columnName}
          </h3>
          )}
          {(() => {
            const isWipDanger = column.columnStatus.toUpperCase() === 'IN_PROGRESS' && column.tasks.length >= 5;
            return (
              <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold border transition-colors ${
                isWipDanger
                  ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                  : 'bg-white/50 border-[#EAECF0]/50 text-[#475467]'
              }`}>
                {column.tasks.length}
              </span>
            );
          })()}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setInlineOpen(true)}
              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              title="Add task"
            >
              <Plus size={14} />
            </button>
            <div className="relative group/menu">
              <button
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Column options"
              >
                <MoreHorizontal size={14} />
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 invisible group-hover/menu:visible opacity-0 group-hover/menu:opacity-100 transition-all">
                <button className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50">Rename column</button>
                <button className="w-full px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50">Change color</button>
                <button className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">Delete column</button>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#667085] ml-1">
              <span className="rounded bg-[#F2F4F7] px-1.5 py-0.5">{storyPoints}pt</span>
              {overdue > 0 && <span className="rounded bg-[#FEF3F2] px-1.5 py-0.5 text-[#B42318]">{overdue} overdue</span>}
            </div>
          </div>
        )}
      </div>

      {/* Column Content */}
      {!collapsed && (
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-1 space-y-2.5 no-scrollbar"
        style={{ minHeight: '150px' }}
      >
        <SortableContext
          items={taskIds}
          strategy={verticalListSortingStrategy}
        >
          {column.tasks.length > 0 ? (
            column.tasks.map((task) => (
              <SprintCard
                key={task.taskId}
                task={task}
                onOpenTask={onOpenTask}
                dense={dense}
                selected={selectedTaskIds?.has(task.taskId)}
                onToggleSelect={onToggleTaskSelected}
                onUpdateDueDate={onUpdateTaskDueDate}
                onAssignSingle={onAssignTaskSingle}
                onAssignMultiple={onAssignTaskMultiple}
                teamMembers={teamMembers}
                projectKey={projectKey}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-20 text-gray-400 border-2 border-dashed border-[#EAECF0] rounded-xl bg-white/50">
              <p className="text-[11px] font-medium">Drop tasks here</p>
            </div>
          )}
        </SortableContext>
      </div>
      )}

      {/* Create Task Button / Inline Input */}
      {!collapsed && (
      <div className="mt-3 pb-1">
        {inlineOpen ? (
          <input
            autoFocus
            value={inlineTitle}
            onChange={(e) => setInlineTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inlineTitle.trim()) {
                const title = inlineTitle.trim();
                setInlineTitle('');
                setInlineOpen(false);
                void onInlineCreate?.(title, column.columnStatus);
              }
              if (e.key === 'Escape') {
                setInlineOpen(false);
                setInlineTitle('');
              }
            }}
            onBlur={() => {
              setInlineOpen(false);
              setInlineTitle('');
            }}
            className="w-full px-3 py-2 text-sm border border-[#155DFC] rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white shadow-sm"
            placeholder="Task name… (Enter to save)"
          />
        ) : (
          <button
            onClick={() => setInlineOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-gray-50 border border-[#EAECF0] rounded-xl text-[13px] font-semibold text-[#344054] shadow-sm transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label={`Add task in ${column.columnName}`}
          >
            <Plus size={18} className="text-[#98A2B3] group-hover:text-[#101828]" />
            <span>Add task</span>
          </button>
        )}
      </div>
      )}
    </motion.div>
  );
}
