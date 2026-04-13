'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../../kanban/types';
import {
    ChevronDown, ArrowUp, ArrowRight, ArrowDown, Minus,
    MoreHorizontal
} from 'lucide-react';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import AssigneeAvatar from '../../(agile)/sprint-backlog/components/AssigneeAvatar';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import { format, parseISO } from 'date-fns';
import api from '@/lib/axios';
import 'react-day-picker/dist/style.css';

const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    URGENT: { color: '#EF4444', icon: ArrowUp,    label: 'Urgent' },
    HIGH:   { color: '#EF4444', icon: ArrowUp,    label: 'High'   },
    MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
    LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
};

const STATUS_COLOR: Record<string, string> = {
    TODO:        'bg-[#F3F4F6] text-[#6A7282]',
    IN_PROGRESS: 'bg-[#EFF6FF] text-[#1D4ED8]',
    IN_REVIEW:   'bg-[#FEF3C7] text-[#92400E]',
    DONE:        'bg-[#DCFCE7] text-[#166534]',
};

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

interface BacklogTaskRowProps {
    task: Task;
    onDelete: (id: number) => void;
    onClick: (task: Task) => void;
    onStatusChange: (id: number, status: string) => void;
    onOpenModal: (id: number) => void;
    selected?: boolean;
    onToggleSelect?: (id: number) => void;
    onDateChange?: (id: number, dueDate: string | null) => void;
}

export default function BacklogTaskRow({
    task, onDelete, onClick, onStatusChange, onOpenModal,
    selected, onToggleSelect, onDateChange,
}: BacklogTaskRowProps) {
    const PriorityIcon = task.priority ? (PRIORITY_CONFIG[task.priority]?.icon ?? Minus) : Minus;
    const priorityColor = task.priority ? (PRIORITY_CONFIG[task.priority]?.color ?? '#9CA3AF') : '#9CA3AF';
    const priorityLabel = task.priority ? (PRIORITY_CONFIG[task.priority]?.label ?? task.priority) : '—';
    const normalizedStatus = (task.status ?? '').toUpperCase();
    const statusClass = STATUS_COLOR[normalizedStatus] ?? 'bg-[#F3F4F6] text-[#6A7282]';
    const [statusOpen, setStatusOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isOverdue = !!(task.dueDate && normalizedStatus !== 'DONE' &&
        new Date(task.dueDate + 'T00:00:00') < new Date(new Date().toDateString()));

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleDateChange = async (date: Date | undefined) => {
        const formattedDate = date ? date.toISOString().split('T')[0] : null;
        // Optimistic update
        onDateChange?.(task.id, formattedDate);
        try {
            await api.patch(`/api/tasks/${task.id}/dates`, { dueDate: formattedDate || "" });
        } catch (err) {
            console.error('Failed to update date:', err);
            // Revert state hook could be added if needed
        }
    };

    return (
        <div
            className={`grid grid-cols-[auto_1fr_120px_100px_120px_100px_100px_32px] sm:grid-cols-[auto_1.5fr_140px_110px_130px_110px_120px_32px] items-center gap-x-2 px-3 sm:px-4 min-h-[52px] rounded-lg border border-[#EAECF0] cursor-pointer select-none transition-colors ${
                selected ? 'bg-[#EFF6FF] border-[#BFDBFE]' : isOverdue ? 'bg-[#FEE2E2] hover:bg-[#FEE2E2]' : 'bg-white hover:bg-[#F8FAFF]'
            }`}
            onClick={() => {
                if (statusOpen || menuOpen) return;
                if (window.innerWidth >= 768) onOpenModal(task.id);
                else onClick(task);
            }}
        >
            {/* Checkbox */}
            <input
                type="checkbox"
                checked={selected ?? false}
                onChange={e => { e.stopPropagation(); onToggleSelect?.(task.id); }}
                onClick={e => e.stopPropagation()}
                className="shrink-0 w-3.5 h-3.5 accent-[#155DFC] cursor-pointer"
            />

            {/* Title + ID */}
            <div className="min-w-0 flex items-center gap-2 py-2.5">
                <span className="text-[11px] font-mono text-[#9CA3AF] shrink-0">#{task.id}</span>
                <p className={`text-[14px] font-medium truncate ${normalizedStatus === 'DONE' ? 'line-through text-[#9CA3AF]' : 'text-[#101828]'}`}>
                    {task.title}
                </p>
            </div>

            {/* Label */}
            <div className="min-w-0 hidden sm:flex items-center">
                {task.labels && task.labels.length > 0 ? (
                    <span style={hexToLabelStyle(task.labels[0].color ?? '#6366F1')} className="px-2 py-0.5 rounded-full text-[10px] font-medium truncate max-w-[110px]">
                        {task.labels[0].name}
                    </span>
                ) : (
                    <span className="text-[11px] text-[#D1D5DB]">—</span>
                )}
            </div>

            {/* Priority */}
            <div className="min-w-0 flex items-center gap-1">
                <PriorityIcon size={13} color={priorityColor} className="shrink-0" />
                <span className="text-[11px] font-medium text-[#374151] hidden sm:inline">{priorityLabel}</span>
            </div>

            {/* Status */}
            <div className="relative" ref={statusRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setStatusOpen(s => !s); }}
                    className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusClass} whitespace-nowrap`}
                >
                    <span className="max-w-[70px] truncate">{normalizedStatus.replace(/_/g, ' ')}</span>
                    <ChevronDown size={10} className="shrink-0" />
                </button>
                {statusOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[130px]">
                        {STATUS_OPTIONS.map((s) => (
                            <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, s); setStatusOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${normalizedStatus === s ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                            >
                                {s.replace(/_/g, ' ')}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Assignee */}
            <div className="min-w-0 flex items-center">
                {task.assigneeName ? (
                    <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
                ) : (
                    <span className="text-[11px] text-[#D1D5DB]">—</span>
                )}
            </div>

            {/* Due Date */}
            <div className="min-w-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                <Popover.Root>
                    <Popover.Trigger asChild>
                        <button className="text-[11px] text-[#6A7282] hover:text-[#155DFC] bg-transparent border border-transparent hover:border-[#155DFC]/20 hover:bg-[#155DFC]/5 px-2 py-1 rounded transition-colors truncate">
                            {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'No date'}
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content className="z-[10000] p-3 bg-white rounded-xl shadow-xl border border-gray-200" sideOffset={5}>
                            <DayPicker
                                mode="single"
                                selected={task.dueDate ? parseISO(task.dueDate) : undefined}
                                onSelect={handleDateChange}
                                showOutsideDays
                            />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>

            {/* Menu */}
            <div className="relative" ref={menuRef}>
                <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                    className="p-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors"
                >
                    <MoreHorizontal size={14} />
                </button>
                {menuOpen && (
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[120px]">
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onOpenModal(task.id); }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                        >
                            Edit
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(task.id); }}
                            className="w-full text-left px-3 py-1.5 text-[12px] text-red-600 hover:bg-red-50 transition-colors"
                        >
                            Delete
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
