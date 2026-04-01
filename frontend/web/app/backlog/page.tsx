'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Task } from '../kanban/types';
import { fetchTasksByProject } from '../kanban/api';
import api from '@/lib/axios';
import {
    AlertCircle, Plus, ChevronDown, ChevronUp,
    ArrowUp, ArrowRight, ArrowDown, Minus,
    Check, Trash2, MoreHorizontal, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import EmptyState from '@/components/shared/EmptyState';
import BottomSheet from '@/components/shared/BottomSheet';

// ── Priority helpers ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
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

// ── Swipeable task row ────────────────────────────────────────────────────────
function SwipeableTaskRow({
    task,
    onMarkDone,
    onDelete,
    onClick,
}: {
    task: Task;
    onMarkDone: (id: number) => void;
    onDelete: (id: number) => void;
    onClick: (task: Task) => void;
}) {
    const x = useMotionValue(0);
    const background = useTransform(
        x,
        [-72, -40, 0, 40, 72],
        ['#DC2626', '#DC2626', 'transparent', '#16A34A', '#16A34A']
    );
    const PriorityIcon = task.priority ? (PRIORITY_CONFIG[task.priority]?.icon ?? Minus) : Minus;
    const priorityColor = task.priority ? (PRIORITY_CONFIG[task.priority]?.color ?? '#9CA3AF') : '#9CA3AF';
    const statusClass = STATUS_COLOR[task.status] ?? 'bg-[#F3F4F6] text-[#6A7282]';

    return (
        <div className="relative overflow-hidden rounded-xl">
            {/* Swipe reveal backgrounds */}
            <motion.div
                className="absolute inset-0 flex items-center rounded-xl pointer-events-none"
                style={{ background }}
            >
                <Trash2 size={20} className="text-white absolute left-4 opacity-0 group-data-left:opacity-100" />
                <Check  size={20} className="text-white absolute right-4" />
            </motion.div>

            {/* Card */}
            <motion.div
                style={{ x }}
                drag="x"
                dragConstraints={{ left: -80, right: 80 }}
                dragElastic={{ left: 0.2, right: 0.2 }}
                onDragEnd={(_, info) => {
                    if (info.offset.x < -60)      onDelete(task.id);
                    else if (info.offset.x > 60)  onMarkDone(task.id);
                }}
                onClick={() => onClick(task)}
                className="relative bg-white rounded-xl border border-[#E5E7EB] cursor-pointer select-none"
            >
                <div className="flex items-center gap-3 px-4 py-3 min-h-[60px]">
                    {/* Drag handle (desktop) */}
                    <GripVertical size={14} className="hidden sm:block text-[#D1D5DB] shrink-0 cursor-grab" />

                    {/* Priority dot */}
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: priorityColor }} />

                    {/* Task ID */}
                    <span className="hidden sm:block text-[11px] font-mono text-[#9CA3AF] shrink-0 w-14">
                        #{task.id}
                    </span>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#101828] truncate">{task.title}</p>
                        {task.description && (
                            <p className="text-[12px] text-[#6A7282] truncate mt-0.5">{task.description}</p>
                        )}
                        {/* Labels */}
                        {task.labels && task.labels.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                                {task.labels.slice(0, 3).map((l) => (
                                    <span key={l.id} className="px-1.5 py-0.5 rounded-full bg-[#EEF2FF] text-[#4F46E5] text-[10px] font-medium">
                                        {l.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right side: assignee + points + status */}
                    <div className="shrink-0 flex items-center gap-2">
                        {task.assigneeName && (
                            <span className="hidden sm:flex w-6 h-6 rounded-full bg-[#155DFC] text-white text-[10px] font-bold items-center justify-center uppercase">
                                {task.assigneeName.charAt(0)}
                            </span>
                        )}
                        {task.storyPoint != null && (
                            <span className="hidden sm:block text-[11px] font-semibold text-[#374151] bg-[#F3F4F6] rounded px-1.5 py-0.5">
                                {task.storyPoint}
                            </span>
                        )}
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusClass}`}>
                            {task.status?.replace('_', ' ')}
                        </span>
                        <PriorityIcon size={14} color={priorityColor} className="shrink-0" />
                    </div>
                </div>
                {/* Mobile swipe hint */}
                <div className="sm:hidden absolute bottom-0 inset-x-0 flex justify-between px-4 pb-0.5 pointer-events-none">
                    <span className="text-[9px] text-[#DC2626] opacity-40">← Delete</span>
                    <span className="text-[9px] text-[#16A34A] opacity-40">Done →</span>
                </div>
            </motion.div>
        </div>
    );
}

// ── Add Task inline row ───────────────────────────────────────────────────────
function AddTaskRow({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const submit = async () => {
        const trimmed = value.trim();
        if (!trimmed) { setEditing(false); return; }
        setSaving(true);
        await onAdd(trimmed);
        setValue('');
        setSaving(false);
        setEditing(false);
    };

    if (!editing) {
        return (
            <button
                onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 50); }}
                className="flex items-center gap-2 w-full px-4 py-3 text-[13px] text-[#6A7282] hover:text-[#155DFC] hover:bg-[#F8FAFF] rounded-xl border border-dashed border-[#D1D5DB] hover:border-[#155DFC] transition-colors"
            >
                <Plus size={15} />
                Add task
            </button>
        );
    }

    return (
        <div className="flex gap-2 items-center px-4 py-2 bg-white rounded-xl border border-[#A5B4FC]">
            <input
                ref={inputRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') setEditing(false); }}
                placeholder="Task title…"
                className="flex-1 text-[13px] outline-none text-[#101828] placeholder-[#9CA3AF] bg-transparent"
            />
            <button
                onClick={() => void submit()}
                disabled={saving || !value.trim()}
                className="px-3 py-1 bg-[#155DFC] text-white text-[12px] font-medium rounded-lg disabled:opacity-50 transition-opacity"
            >
                {saving ? '…' : 'Add'}
            </button>
            <button onClick={() => setEditing(false)} className="text-[#9CA3AF] hover:text-[#374151] p-1">
                <Minus size={14} />
            </button>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BacklogPage() {
    const searchParams = useSearchParams();
    const projectId    = searchParams.get('projectId');

    const [tasks,    setTasks]   = useState<Task[]>([]);
    const [loading,  setLoading] = useState(false);
    const [error,    setError]   = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const loadTasks = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        setError(null);
        try {
            const n = parseInt(projectId, 10);
            if (isNaN(n)) throw new Error('Invalid project ID');
            const fetched = await fetchTasksByProject(n);
            setTasks(fetched);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => { void loadTasks(); }, [loadTasks]);

    const handleMarkDone = useCallback(async (id: number) => {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: 'DONE' } : t));
        try {
            await api.put(`/api/tasks/${id}`, { status: 'DONE' });
        } catch {
            // revert optimistically — re-fetch
            void loadTasks();
        }
    }, [loadTasks]);

    const handleDelete = useCallback(async (id: number) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        try {
            await api.delete(`/api/tasks/${id}`);
        } catch {
            void loadTasks();
        }
    }, [loadTasks]);

    const handleAddTask = useCallback(async (title: string) => {
        if (!projectId) return;
        try {
            const res = await api.post('/api/tasks', { projectId: parseInt(projectId, 10), title, storyPoint: 0 });
            setTasks((prev) => [...prev, res.data as Task]);
        } catch (err) {
            console.error('Failed to create task:', err);
        }
    }, [projectId]);

    // ── Skeletons ──────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="mobile-page-padding max-w-[900px] mx-auto">
                <div className="flex items-center justify-between mb-5">
                    <div className="skeleton h-7 w-40 rounded-lg" />
                    <div className="skeleton h-9 w-28 rounded-lg hidden sm:block" />
                </div>
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="skeleton h-[60px] rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (!projectId) {
        return (
            <div className="mobile-page-padding flex items-center justify-center min-h-[60vh]">
                <EmptyState
                    icon={<AlertCircle size={28} />}
                    title="No project selected"
                    subtitle="Open a project from the dashboard to view its backlog."
                />
            </div>
        );
    }

    return (
        <div className="mobile-page-padding max-w-[900px] mx-auto pb-28 sm:pb-8">
            {/* ── Header ── */}
            <div className="sticky-section-header -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-[18px] sm:text-xl font-bold text-[#101828]">Product Backlog</h1>
                    <p className="text-[12px] text-[#6A7282] mt-0.5 hidden sm:block">
                        {tasks.length} issue{tasks.length !== 1 ? 's' : ''} · Swipe right to complete, left to delete
                    </p>
                </div>
                <button
                    onClick={() => document.dispatchEvent(new CustomEvent('backlog:open-create'))}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-[#155DFC] text-white text-[13px] font-medium rounded-lg hover:bg-[#0042A8] transition-colors"
                >
                    <Plus size={15} />
                    Create Issue
                </button>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 mb-4">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold text-sm">Error loading backlog</p>
                        <p className="text-xs mt-0.5">{error}</p>
                    </div>
                </div>
            )}

            {/* ── Backlog section ── */}
            <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
                {/* Section header */}
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    className="sticky-section-header w-full flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                >
                    <span className="text-[13px] font-semibold text-[#374151]">Backlog</span>
                    <span className="text-[11px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                        {tasks.length}
                    </span>
                    <span className="ml-auto text-[#9CA3AF]">
                        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </span>
                </button>

                {/* Task list */}
                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            {tasks.length === 0 ? (
                                <EmptyState
                                    icon={<MoreHorizontal size={24} />}
                                    title="No backlog items yet"
                                    subtitle="Create your first issue to get started."
                                />
                            ) : (
                                <div className="flex flex-col gap-0 divide-y divide-[#F3F4F6] px-3 pt-2">
                                    {tasks.map((task) => (
                                        <div key={task.id} className="py-1">
                                            <SwipeableTaskRow
                                                task={task}
                                                onMarkDone={handleMarkDone}
                                                onDelete={handleDelete}
                                                onClick={setSelectedTask}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-3">
                                <AddTaskRow onAdd={handleAddTask} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Mobile FAB ── */}
            <button
                className="fab md:hidden flex items-center justify-center"
                aria-label="Create Issue"
                onClick={() => document.dispatchEvent(new CustomEvent('backlog:open-create'))}
            >
                <Plus size={24} strokeWidth={2.5} />
            </button>

            {/* ── Task detail bottom sheet ── */}
            <BottomSheet
                isOpen={selectedTask !== null}
                onClose={() => setSelectedTask(null)}
                title={selectedTask?.title ?? ''}
                snapPoint="full"
            >
                {selectedTask && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[selectedTask.status] ?? 'bg-[#F3F4F6] text-[#6A7282]'}`}>
                                {selectedTask.status?.replace('_', ' ')}
                            </span>
                            {selectedTask.priority && (
                                <span className="text-[11px] font-medium text-[#6A7282]">
                                    {PRIORITY_CONFIG[selectedTask.priority]?.label ?? selectedTask.priority} priority
                                </span>
                            )}
                        </div>
                        {selectedTask.description && (
                            <p className="text-[14px] text-[#374151] leading-relaxed">{selectedTask.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            {selectedTask.assigneeName && (
                                <div className="bg-[#F9FAFB] rounded-xl p-3">
                                    <p className="text-[11px] text-[#9CA3AF] mb-1">Assignee</p>
                                    <p className="text-[13px] font-medium text-[#101828]">{selectedTask.assigneeName}</p>
                                </div>
                            )}
                            {selectedTask.storyPoint != null && (
                                <div className="bg-[#F9FAFB] rounded-xl p-3">
                                    <p className="text-[11px] text-[#9CA3AF] mb-1">Story Points</p>
                                    <p className="text-[13px] font-medium text-[#101828]">{selectedTask.storyPoint}</p>
                                </div>
                            )}
                            {selectedTask.dueDate && (
                                <div className="bg-[#F9FAFB] rounded-xl p-3">
                                    <p className="text-[11px] text-[#9CA3AF] mb-1">Due Date</p>
                                    <p className="text-[13px] font-medium text-[#101828]">
                                        {new Date(selectedTask.dueDate).toLocaleDateString()}
                                    </p>
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => { void handleMarkDone(selectedTask.id); setSelectedTask(null); }}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-[#16A34A] text-white rounded-xl font-medium text-[14px] active:scale-[0.98] transition-transform"
                        >
                            <Check size={16} />
                            Mark as Done
                        </button>
                    </div>
                )}
            </BottomSheet>
        </div>
    );
}

