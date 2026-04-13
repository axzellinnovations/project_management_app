'use client';

import React from 'react';
import { Task } from '../../kanban/types';
import { Check, Trash2 } from 'lucide-react';

const PRIORITY_CONFIG: Record<string, { label: string }> = {
    HIGH:   { label: 'High'   },
    MEDIUM: { label: 'Medium' },
    LOW:    { label: 'Low'    },
};

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

interface BacklogTaskDetailProps {
    task: Task;
    onStatusChange: (id: number, status: string) => void;
    onMarkDone: (id: number) => void;
    onDelete: (id: number) => void;
    onOpenModal: (id: number) => void;
    onClose: () => void;
}

export default function BacklogTaskDetail({
    task, onStatusChange, onMarkDone, onDelete, onOpenModal, onClose,
}: BacklogTaskDetailProps) {
    return (
        <div className="flex flex-col gap-4">
            {/* Status selector */}
            <div>
                <p className="text-[11px] text-[#9CA3AF] mb-2 font-medium uppercase tracking-wide">Status</p>
                <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => onStatusChange(task.id, s)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${task.status === s ? 'border-[#155DFC] bg-[#EFF6FF] text-[#1D4ED8] font-semibold' : 'border-[#E5E7EB] text-[#6A7282] hover:border-[#155DFC]'}`}
                        >
                            {s.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </div>
            {task.priority && (
                <p className="text-[11px] font-medium text-[#6A7282]">
                    {PRIORITY_CONFIG[task.priority]?.label ?? task.priority} priority
                </p>
            )}
            {task.description && (
                <p className="text-[14px] text-[#374151] leading-relaxed">{task.description}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
                {task.assigneeName && (
                    <div className="bg-[#F9FAFB] rounded-xl p-3">
                        <p className="text-[11px] text-[#9CA3AF] mb-1">Assignee</p>
                        <p className="text-[13px] font-medium text-[#101828]">{task.assigneeName}</p>
                    </div>
                )}
                {task.dueDate && (
                    <div className="bg-[#F9FAFB] rounded-xl p-3">
                        <p className="text-[11px] text-[#9CA3AF] mb-1">Due Date</p>
                        <p className="text-[13px] font-medium text-[#101828]">
                            {new Date(task.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => { onMarkDone(task.id); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#16A34A] text-white rounded-xl font-medium text-[14px] active:scale-[0.98] transition-transform"
                >
                    <Check size={16} />
                    Mark as Done
                </button>
                <button
                    onClick={() => { onOpenModal(task.id); onClose(); }}
                    className="px-4 py-3 border border-[#E5E7EB] text-[#374151] rounded-xl font-medium text-[14px] hover:bg-[#F9FAFB] transition-colors"
                >
                    Edit
                </button>
                <button
                    onClick={() => { onDelete(task.id); onClose(); }}
                    className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-medium text-[14px] hover:bg-red-50 transition-colors"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
}
