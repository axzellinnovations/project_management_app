'use client';

import React from 'react';
import { Task } from '../../kanban/types';
import { Check, Trash2 } from 'lucide-react';
import AssigneeAvatar from '../../(agile)/sprint-backlog/components/AssigneeAvatar';

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
                <p className="text-[11px] text-cu-text-muted mb-2 font-medium uppercase tracking-wide">Status</p>
                <div className="flex gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((s) => (
                        <button
                            key={s}
                            onClick={() => onStatusChange(task.id, s)}
                            className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${task.status === s ? 'border-cu-primary/50 bg-cu-primary/10 text-cu-primary font-semibold' : 'border-cu-border text-cu-text-secondary hover:border-cu-primary/60 hover:bg-cu-hover'}`}
                        >
                            {s.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            </div>
            {task.priority && (
                <p className="text-[11px] font-medium text-cu-text-secondary">
                    {PRIORITY_CONFIG[task.priority]?.label ?? task.priority} priority
                </p>
            )}
            {task.description && (
                <p className="text-[14px] text-cu-text-primary leading-relaxed">{task.description}</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-cu-bg-secondary rounded-xl p-3">
                    <p className="text-[11px] text-cu-text-muted mb-1.5 font-medium">Assignees</p>
                    {task.assignees && task.assignees.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            {task.assignees.map((a, idx) => (
                                <div key={a.userId ?? a.memberId ?? a.id ?? idx} className="inline-flex items-center gap-1.5 bg-cu-bg border border-cu-border rounded-lg px-2 py-1">
                                    <AssigneeAvatar name={a.name} profilePicUrl={a.photoUrl || a.avatar || a.profilePicUrl} size={20} />
                                    <span className="text-[12px] font-medium text-cu-text-primary truncate max-w-[120px]">{a.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : task.assigneeName ? (
                        <div className="inline-flex items-center gap-1.5 bg-cu-bg border border-cu-border rounded-lg px-2 py-1">
                            <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={20} />
                            <span className="text-[12px] font-medium text-cu-text-primary truncate">{task.assigneeName}</span>
                        </div>
                    ) : (
                        <span className="text-[12px] text-cu-text-muted italic">Unassigned</span>
                    )}
                </div>
                {task.dueDate && (
                    <div className="bg-cu-bg-secondary rounded-xl p-3">
                        <p className="text-[11px] text-cu-text-muted mb-1 font-medium">Due Date</p>
                        <p className="text-[13px] font-medium text-cu-text-primary">
                            {new Date(task.dueDate.length === 10 ? `${task.dueDate}T00:00:00` : task.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                )}
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => { onMarkDone(task.id); onClose(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-medium text-[14px] active:scale-[0.98] hover:bg-emerald-700 transition-all"
                >
                    <Check size={16} />
                    Mark as Done
                </button>
                <button
                    onClick={() => { onOpenModal(task.id); onClose(); }}
                    className="px-4 py-3 border border-cu-border text-cu-text-primary rounded-xl font-medium text-[14px] hover:bg-cu-hover transition-colors"
                >
                    Edit
                </button>
                <button
                    onClick={() => { onDelete(task.id); onClose(); }}
                    className="px-4 py-3 border border-red-500/25 text-red-500 rounded-xl font-medium text-[14px] hover:bg-red-500/10 transition-colors"
                >
                    <Trash2 size={15} />
                </button>
            </div>
        </div>
    );
}
