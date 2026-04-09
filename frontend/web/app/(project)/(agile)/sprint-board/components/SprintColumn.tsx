'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Sprintcolumn } from '../types';
import SprintCard from './SprintCard';
import { Plus } from 'lucide-react';

interface SprintColumnProps {
  column: Sprintcolumn;
  onInlineCreate?: (title: string, status: string) => Promise<void>;
  onOpenTask?: (id: number) => void;
}

export default function SprintColumn({
  column,
  onInlineCreate,
  onOpenTask,
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
        return 'bg-[#EFF8FF]';
      case 'IN_PROGRESS':
        return 'bg-[#FFFCF5]';
      case 'IN_REVIEW':
        return 'bg-[#F9F5FF]';
      case 'DONE':
        return 'bg-[#ECFDF3]';
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

  return (
    <motion.div 
      whileHover={{ scale: 1.01, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)' }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col h-full min-w-[280px] w-[85vw] sm:w-[320px] sm:min-w-[320px] max-w-[320px] rounded-2xl border border-[#EAECF0] ${getColumnBgColor(column.columnStatus)} p-2 snap-center snap-always`}
    >
      {/* Column Header */}
      <div className="px-3 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className={`font-bold text-[13px] uppercase tracking-wider ${getTitleColor(column.columnStatus)}`}>
            {column.columnName}
          </h3>
          {(() => {
            const isWipDanger = column.columnStatus.toUpperCase() === 'IN_PROGRESS' && column.tasks.length >= 5;
            return (
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] font-bold border shadow-sm transition-colors ${
                isWipDanger
                  ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                  : 'bg-white/50 border-[#EAECF0]/50 text-[#475467]'
              }`}>
                {column.tasks.length}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-1 space-y-4 no-scrollbar"
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
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-[#EAECF0] rounded-xl bg-white/30 translate-y-2">
              <p className="text-[12px] font-medium">Drop tasks here</p>
            </div>
          )}
        </SortableContext>
      </div>

      {/* Create Task Button / Inline Input */}
      <div className="mt-4 pb-2">
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
            className="w-full px-3 py-2 text-sm border border-[#155DFC] rounded-xl focus:outline-none bg-white shadow-sm"
            placeholder="Task name… (Enter to save)"
          />
        ) : (
          <button
            onClick={() => setInlineOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-gray-50 border border-[#EAECF0] rounded-xl text-[14px] font-semibold text-[#344054] shadow-sm transition-all duration-200 group"
          >
            <Plus size={18} className="text-[#98A2B3] group-hover:text-[#101828]" />
            <span>Create</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
