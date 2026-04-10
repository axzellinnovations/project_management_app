'use client';
import React, { useState } from 'react';
import { Flag, MoreHorizontal, Edit2, Trash2 } from 'lucide-react';
import type { MilestoneResponse } from '@/types';
import { STATUS_CONFIG, type MilestoneStatus } from './milestoneConfig';
import ProgressRing from './ProgressRing';

interface MilestoneCardProps {
  milestone: MilestoneResponse;
  onEdit: (m: MilestoneResponse) => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: MilestoneStatus) => void;
}

const MilestoneCard: React.FC<MilestoneCardProps> = ({ milestone, onEdit, onDelete, onStatusChange }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const sConf = STATUS_CONFIG[milestone.status as MilestoneStatus] ?? STATUS_CONFIG.OPEN;

  const dueDateStr = milestone.dueDate
    ? new Date(milestone.dueDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null;
  const isOverdue = milestone.dueDate && milestone.status === 'OPEN' && new Date(milestone.dueDate) < new Date();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-4">
        {/* Progress ring */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <ProgressRing value={milestone.status === 'COMPLETED' ? milestone.taskCount : 0} max={milestone.taskCount} />
          <span className="text-[10px] text-gray-400">{milestone.taskCount} tasks</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Flag size={14} className={milestone.status === 'COMPLETED' ? 'text-green-500' : 'text-purple-500'} />
            <h3 className="text-sm font-semibold text-gray-900 truncate">{milestone.name}</h3>
          </div>

          {milestone.description && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-2">{milestone.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {/* Status badge */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setStatusOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold transition-all ${sConf.badge}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${sConf.dot}`} />
                {sConf.label}
              </button>
              {statusOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden min-w-[130px]">
                  {(Object.keys(STATUS_CONFIG) as MilestoneStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => { onStatusChange(milestone.id, s); setStatusOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 border-b border-gray-50 last:border-b-0 font-medium ${STATUS_CONFIG[s].badge} hover:opacity-80`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s].dot}`} />
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {dueDateStr && (
              <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                {isOverdue ? 'Overdue · ' : ''}{dueDateStr}
              </span>
            )}
          </div>
        </div>

        {/* Three-dot menu */}
        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreHorizontal size={15} />
          </button>
          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden min-w-[120px]">
              <button
                onClick={() => { onEdit(milestone); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-gray-50 text-gray-700"
              >
                <Edit2 size={13} /> Edit
              </button>
              <button
                onClick={() => { onDelete(milestone.id); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-red-50 text-red-600"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MilestoneCard;
