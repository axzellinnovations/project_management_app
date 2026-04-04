'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SprintboardTask } from '../types';
import { Calendar } from 'lucide-react';
import AssigneeAvatar from '../../sprint-backlog/components/AssigneeAvatar';

interface SprintCardProps {
  task: SprintboardTask;
  onOpenTask?: (taskId: number) => void;
}

export default function SprintCard({ task, onOpenTask }: SprintCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.taskId.toString(),
    data: { type: 'task', taskId: task.taskId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const dueDateFormatted = formatDate(task.dueDate);
  const isOverdue =
    task.dueDate &&
    new Date(task.dueDate) < new Date() &&
    task.status !== 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => !isDragging && onOpenTask?.(task.taskId)}
      className={`
        rounded-xl border border-[#EAECF0] bg-white p-4 shadow-sm
        hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'ring-2 ring-[#155DFC] z-50 scale-105' : ''}
      `}
    >
      {/* Title */}
      <h3 className="text-[14px] font-semibold text-[#101828] leading-tight mb-3">
        {task.title}
      </h3>

      {/* Date */}
      {dueDateFormatted && (
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#475467] mb-4">
          <Calendar size={14} className={isOverdue ? 'text-[#F04438]' : 'text-[#98A2B3]'} />
          <span className={isOverdue ? 'text-[#F04438]' : ''}>
            {dueDateFormatted}
          </span>
        </div>
      )}

      {/* Bottom row: Story points & Assignee */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <div className="flex items-center gap-2">
          {task.storyPoint !== undefined && (
            <div className="px-2.5 py-1 rounded-md text-[12px] font-bold bg-[#F2F4F7] text-[#344054]">
              {task.storyPoint}
            </div>
          )}
        </div>
        
        {task.assigneeName && (
          <AssigneeAvatar 
            name={task.assigneeName} 
            profilePicUrl={task.assigneePhotoUrl}
            size={24} 
            className="border-2 border-white ring-1 ring-[#EAECF0]"
          />
        )}
      </div>
    </div>
  );
}
