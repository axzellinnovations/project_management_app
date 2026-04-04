'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Task } from '../kanban/types';
import { fetchTasksByProject } from '../kanban/api';
import api from '@/lib/axios';
import Image from 'next/image';
import {
    AlertCircle, Plus, ChevronDown, ChevronUp,
    ArrowUp, ArrowRight, ArrowDown, Minus,
    Check, Trash2, MoreHorizontal, GripVertical
} from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import EmptyState from '@/components/shared/EmptyState';
import BottomSheet from '@/components/shared/BottomSheet';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// ── Priority helpers ──────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    URGENT: { color: '#DC2626', icon: ArrowUp,    label: 'Urgent' },
    HIGH:   { color: '#EF4444', icon: ArrowUp,    label: 'High'   },
    MEDIUM: { color: '#F59E0B', icon: ArrowRight, label: 'Medium' },
    LOW:    { color: '#22C55E', icon: ArrowDown,  label: 'Low'    },
    NONE:   { color: '#9CA3AF', icon: Minus,      label: 'None'   },
};

const STATUS_COLOR: Record<string, string> = {
    TODO:        'bg-[#F3F4F6] text-[#6A7282]',
    IN_PROGRESS: 'bg-[#EFF6FF] text-[#1D4ED8]',
    IN_REVIEW:   'bg-[#FEF3C7] text-[#92400E]',
    DONE:        'bg-[#DCFCE7] text-[#166534]',
};

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

function resolveUrl(url?: string | null) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `${API_BASE_URL}${url}`;
}

// ── Swipeable task row ────────────────────────────────────────────────────────
function SwipeableTaskRow({
    task,
    onMarkDone,
    onDelete,
    onClick,
    onStatusChange,
    onOpenModal,
    usersMap,
}: {
    task: Task;
    onMarkDone: (id: number) => void;
    onDelete: (id: number) => void;
    onClick: (task: Task) => void;
    onStatusChange: (id: number, status: string) => void;
    onOpenModal: (id: number) => void;
    usersMap: Record<string, string | null>;
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
    const [statusOpen, setStatusOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (statusRef.current && !statusRef.current.contains(e.target as Node)) setStatusOpen(false);
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const avatarUrl = task.assigneeName ? resolveUrl(usersMap[task.assigneeName] ?? usersMap[task.assigneeName?.split(' ')[0]] ?? null) : null;

    return (
        <div className="relative overflow-visible rounded-xl">
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
                onClick={() => {
                    if (statusOpen || menuOpen) return;
                    // Desktop: open modal; mobile: open bottom sheet
                    if (window.innerWidth >= 768) onOpenModal(task.id);
                    else onClick(task);
                }}
                className="relative bg-white rounded-xl border border-[#E5E7EB] cursor-pointer select-none"
            >
                <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 min-h-[60px]">
                    {/* Drag handle (desktop) */}
                    <GripVertical size={14} className="hidden sm:block text-[#D1D5DB] shrink-0 cursor-grab" />

                    {/* Priority dot (mobile: larger/styled indicator) */}
                    <span className="shrink-0 w-1.5 sm:w-2 h-7 sm:h-2 rounded-full sm:rounded-full" style={{ background: priorityColor }} />

                    {/* Task ID */}
                    <span className="hidden md:block text-[11px] font-mono text-[#9CA3AF] shrink-0 w-14">
                        #{task.id}
                    </span>

                    {/* Title + description */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                            <span className="sm:hidden text-[11px] font-mono text-[#9CA3AF] shrink-0">
                                #{task.id}
                            </span>
                            <p className="text-[13px] font-medium text-[#101828] truncate">{task.title}</p>
                        </div>
                        {task.description && (
                            <p className="text-[12px] text-[#6A7282] truncate mt-0.5">{task.description}</p>
                        )}
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

                    {/* Right side: assignee + points + status + menu */}
                    <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                        {/* Assignee avatar */}
                        {task.assigneeName && (
                            <div className="flex w-6 h-6 rounded-full bg-[#155DFC] text-white text-[10px] font-bold items-center justify-center uppercase overflow-hidden shrink-0">
                                {avatarUrl ? (
                                    <Image src={avatarUrl} alt={task.assigneeName} width={24} height={24} className="w-full h-full object-cover" unoptimized />
                                ) : (
                                    task.assigneeName.charAt(0)
                                )}
                            </div>
                        )}
                        {task.storyPoint != null && (
                            <span className="text-[11px] font-semibold text-[#374151] bg-[#F3F4F6] rounded px-1.5 py-0.5">
                                {task.storyPoint}
                            </span>
                        )}

                        {/* Status badge with dropdown */}
                        <div className="relative" ref={statusRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setStatusOpen(s => !s); }}
                                className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusClass} whitespace-nowrap`}
                            >
                                <span className="max-w-[60px] sm:max-w-none truncate sm:overflow-visible">
                                    {task.status?.replace(/_/g, ' ')}
                                </span>
                                <ChevronDown size={10} className="shrink-0" />
                            </button>
                            {statusOpen && (
                                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-lg py-1 min-w-[130px]">
                                    {STATUS_OPTIONS.map((s) => (
                                        <button
                                            key={s}
                                            onClick={(e) => { e.stopPropagation(); onStatusChange(task.id, s); setStatusOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${task.status === s ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                        >
                                            {s.replace(/_/g, ' ')}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <PriorityIcon size={14} color={priorityColor} className="shrink-0" />

                        {/* Desktop context menu */}
                        <div className="hidden sm:block relative" ref={menuRef}>
                            <button
                                onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
                                className="p-1 rounded hover:bg-[#F3F4F6] text-[#9CA3AF] transition-colors"
                            >
                                <MoreHorizontal size={15} />
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
    const [showCreateSheet, setShowCreateSheet] = useState(false);
    const [createTitle, setCreateTitle] = useState('');
    const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
    const [usersMap, setUsersMap] = useState<Record<string, string | null>>({});

    // Fetch user avatar map
    useEffect(() => {
        api.get('/api/auth/users').then((res) => {
            const map: Record<string, string | null> = {};
            for (const u of (res.data as { username?: string; fullName?: string; profilePicUrl?: string }[])) {
                const key = u.fullName || u.username || '';
                if (key) map[key] = u.profilePicUrl ?? null;
                if (u.username && u.username !== key) map[u.username] = u.profilePicUrl ?? null;
            }
            setUsersMap(map);
        }).catch(() => {/* non-critical */});
    }, []);

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

    useEffect(() => {
        const handler = () => setShowCreateSheet(true);
        document.addEventListener('backlog:open-create', handler);
        return () => document.removeEventListener('backlog:open-create', handler);
    }, []);

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

    const handleStatusChange = useCallback(async (id: number, status: string) => {
        setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
        try {
            await api.put(`/api/tasks/${id}`, { status });
        } catch {
            void loadTasks();
        }
    }, [loadTasks]);

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
                                                onStatusChange={handleStatusChange}
                                                onOpenModal={setSelectedTaskIdForModal}
                                                usersMap={usersMap}
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
                        {/* Status selector */}
                        <div>
                            <p className="text-[11px] text-[#9CA3AF] mb-2 font-medium uppercase tracking-wide">Status</p>
                            <div className="flex gap-2 flex-wrap">
                                {STATUS_OPTIONS.map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => { void handleStatusChange(selectedTask.id, s); setSelectedTask({ ...selectedTask, status: s }); }}
                                        className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${selectedTask.status === s ? 'border-[#155DFC] bg-[#EFF6FF] text-[#1D4ED8] font-semibold' : 'border-[#E5E7EB] text-[#6A7282] hover:border-[#155DFC]'}`}
                                    >
                                        {s.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {selectedTask.priority && (
                            <p className="text-[11px] font-medium text-[#6A7282]">
                                {PRIORITY_CONFIG[selectedTask.priority]?.label ?? selectedTask.priority} priority
                            </p>
                        )}
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
                        <div className="flex gap-2">
                            <button
                                onClick={() => { void handleMarkDone(selectedTask.id); setSelectedTask(null); }}
                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#16A34A] text-white rounded-xl font-medium text-[14px] active:scale-[0.98] transition-transform"
                            >
                                <Check size={16} />
                                Mark as Done
                            </button>
                            <button
                                onClick={() => { setSelectedTaskIdForModal(selectedTask.id); setSelectedTask(null); }}
                                className="px-4 py-3 border border-[#E5E7EB] text-[#374151] rounded-xl font-medium text-[14px] hover:bg-[#F9FAFB] transition-colors"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => { void handleDelete(selectedTask.id); setSelectedTask(null); }}
                                className="px-4 py-3 border border-red-200 text-red-600 rounded-xl font-medium text-[14px] hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                )}
            </BottomSheet>

            {/* ── Create issue bottom sheet ── */}
            <BottomSheet
                isOpen={showCreateSheet}
                onClose={() => { setShowCreateSheet(false); setCreateTitle(''); }}
                title="Create Issue"
                snapPoint="half"
            >
                <div className="flex flex-col gap-4 pt-1">
                    <input
                        autoFocus
                        value={createTitle}
                        onChange={(e) => setCreateTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && createTitle.trim()) {
                                void handleAddTask(createTitle.trim());
                                setCreateTitle('');
                                setShowCreateSheet(false);
                            }
                        }}
                        placeholder="Issue title…"
                        className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl text-[14px] text-[#101828] placeholder-[#9CA3AF] outline-none focus:border-[#155DFC] focus:ring-2 focus:ring-[#EAF2FF] transition-all"
                    />
                    <button
                        onClick={() => {
                            if (!createTitle.trim()) return;
                            void handleAddTask(createTitle.trim());
                            setCreateTitle('');
                            setShowCreateSheet(false);
                        }}
                        disabled={!createTitle.trim()}
                        className="flex items-center justify-center gap-2 w-full py-3 bg-[#155DFC] text-white rounded-xl font-medium text-[14px] disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                        <Plus size={16} />
                        Create Issue
                    </button>
                </div>
            </BottomSheet>

            {/* ── Desktop Task Card Modal ── */}
            {selectedTaskIdForModal !== null && (
                <TaskCardModal
                    taskId={selectedTaskIdForModal}
                    onClose={() => { setSelectedTaskIdForModal(null); void loadTasks(); }}
                />
            )}
        </div>
    );
}

