'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Minus, MoreHorizontal } from 'lucide-react';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import type { Task } from '@/types';
import { PRIORITY_CONFIG, STATUS_CONFIG, STATUS_ORDER } from '../lib/list-config';

const TaskRow = React.memo(function TaskRow({
  task,
  onOpenModal,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onOpenModal: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const assigneePhotoUrl = task.assigneePhotoUrl?.startsWith('http') ? task.assigneePhotoUrl : null;

  const sConf = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.TODO;
  const pConf = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const PriorityIcon = pConf?.icon ?? Minus;
  const priorityColor = pConf?.color ?? '#9CA3AF';

  const isOverdue = !!(
    task.dueDate &&
    task.status !== 'DONE' &&
    new Date(task.dueDate + 'T00:00:00') < new Date(new Date().toDateString())
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-4 min-h-[42px] border-b border-[#EAECF0] bg-white hover:bg-[#F8FAFF] cursor-pointer transition-colors group"
      onClick={() => { if (!statusOpen && !menuOpen) onOpenModal(task.id); }}
    >
      {/* Priority bar */}
      <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: priorityColor }} />

      {/* Priority label */}
      <div className="w-16 shrink-0 hidden lg:flex items-center gap-1">
        <PriorityIcon size={12} color={priorityColor} className="shrink-0" />
        <span className="text-[11px] font-medium truncate" style={{ color: priorityColor }}>
          {pConf?.label ?? '—'}
        </span>
      </div>

      {/* Title */}
      <p className="flex-1 min-w-0 text-[13px] font-medium text-[#101828] truncate">
        {task.title}
      </p>

      {/* Labels */}
      <div className="w-28 shrink-0 hidden lg:flex gap-1 overflow-hidden">
        {task.labels && task.labels.length > 0
          ? task.labels.slice(0, 2).map((l) => (
              <span key={l.id} style={hexToLabelStyle(l.color ?? '#6366F1')} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap">
                {l.name}
              </span>
            ))
          : <span className="text-[11px] text-[#9CA3AF]">—</span>
        }
      </div>

      {/* Milestone */}
      <div className="w-28 shrink-0 hidden xl:block overflow-hidden">
        {task.milestoneName
          ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 truncate max-w-full">
              {task.milestoneName}
            </span>
          : <span className="text-[11px] text-[#9CA3AF]">—</span>
        }
      </div>

      {/* Assignee */}
      <div className="w-28 shrink-0 hidden md:flex items-center gap-1.5 overflow-hidden">
        {task.assigneeName ? (
          <>
            <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-[10px] font-bold overflow-hidden shrink-0">
              <span>{task.assigneeName.charAt(0).toUpperCase()}</span>
              {assigneePhotoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img
                    key={assigneePhotoUrl}
                    src={assigneePhotoUrl}
                    alt={task.assigneeName}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                : null
              }
            </div>
            <span className="text-[11px] text-[#374151] truncate">{task.assigneeName}</span>
          </>
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">—</span>
        )}
      </div>

      {/* Status */}
      <div className="w-28 shrink-0 relative" ref={statusRef} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setStatusOpen((v) => !v)}
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium w-full justify-between ${sConf.badge}`}
        >
          <span className="truncate">{sConf.label}</span>
          <ChevronDown size={10} className="shrink-0" />
        </button>
        {statusOpen && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[130px]">
            {STATUS_ORDER.map((s) => (
              <button
                key={s}
                onClick={() => { onStatusChange(task.id, s); setStatusOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${task.status === s ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
              >
                {STATUS_CONFIG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Due date */}
      <div className="w-20 shrink-0 hidden sm:block">
        {task.dueDate ? (
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full border ${
            isOverdue
              ? 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]'
              : 'bg-[#F9FAFB] text-[#344054] border-[#EAECF0]'
          }`}>
            {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ) : (
          <span className="text-[11px] text-[#9CA3AF]">—</span>
        )}
      </div>

      {/* Actions menu */}
      <div className="w-8 shrink-0 relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors"
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[120px]">
            <button
              onClick={() => { setMenuOpen(false); onOpenModal(task.id); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => { setMenuOpen(false); onDelete(task.id); }}
              className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default TaskRow;
