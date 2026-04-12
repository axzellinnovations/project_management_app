'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Task } from '../kanban/types';
import { fetchTasksByProject } from '../kanban/api';
import { useTaskStore } from '@/stores/task-store';
import api from '@/lib/axios';
import {
    AlertCircle, Plus, ChevronDown, ChevronUp,
    ArrowUp, ArrowRight, ArrowDown, Minus,
    Check, Trash2, MoreHorizontal
} from 'lucide-react';
import CreateTaskModal, { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { hexToLabelStyle } from '@/components/shared/LabelPicker';
import { motion, AnimatePresence } from 'framer-motion';
import AssigneeAvatar from '../(agile)/sprint-backlog/components/AssigneeAvatar';
import EmptyState from '@/components/shared/EmptyState';
import BottomSheet from '@/components/shared/BottomSheet';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';

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

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

// ── Compact backlog task row ─────────────────────────────────────────────────
function BacklogTaskRow({
    task,
    onDelete,
    onClick,
    onStatusChange,
    onOpenModal,
}: {
    task: Task;
    onDelete: (id: number) => void;
    onClick: (task: Task) => void;
    onStatusChange: (id: number, status: string) => void;
    onOpenModal: (id: number) => void;
}) {
    const PriorityIcon = task.priority ? (PRIORITY_CONFIG[task.priority]?.icon ?? Minus) : Minus;
    const priorityColor = task.priority ? (PRIORITY_CONFIG[task.priority]?.color ?? '#9CA3AF') : '#9CA3AF';
    const statusClass = STATUS_COLOR[task.status] ?? 'bg-[#F3F4F6] text-[#6A7282]';
    const [statusOpen, setStatusOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const isOverdue = !!(task.dueDate && task.status !== 'DONE' &&
        new Date(task.dueDate + 'T00:00:00') < new Date(new Date().toDateString()));

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
            className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 min-h-[40px] rounded-lg border border-[#EAECF0] cursor-pointer select-none transition-colors ${
                isOverdue ? 'bg-[#FEE2E2] hover:bg-[#FEE2E2]' : 'bg-white hover:bg-[#F8FAFF]'
            }`}
            onClick={() => {
                if (statusOpen || menuOpen) return;
                if (window.innerWidth >= 768) onOpenModal(task.id);
                else onClick(task);
            }}
        >
            {/* Priority indicator */}
            <span className="shrink-0 w-1.5 h-6 rounded-full" style={{ background: priorityColor }} />

            {/* Task ID */}
            <span className="hidden md:block text-[11px] font-mono text-[#9CA3AF] shrink-0 w-14">#{task.id}</span>

            {/* Title + labels */}
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
                <span className="md:hidden text-[11px] font-mono text-[#9CA3AF] shrink-0">#{task.id}</span>
                <p className="text-[12px] font-medium text-[#101828] truncate">{task.title}</p>
                {task.labels && task.labels.length > 0 && (
                    <div className="hidden sm:flex gap-1">
                        {task.labels.slice(0, 2).map((l) => (
                            <span key={l.id} style={hexToLabelStyle(l.color ?? '#6366F1')} className="px-1.5 py-0.5 rounded-full text-[10px] font-medium">
                                {l.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Right side */}
            <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
                {/* Due date */}
                {task.dueDate && (
                    <span className={`hidden sm:block text-[11px] px-1.5 py-0.5 rounded-full border ${
                        isOverdue
                            ? 'bg-[#FEF3F2] text-[#B42318] border-[#FDA29B]'
                            : 'bg-[#F9FAFB] text-[#344054] border-[#EAECF0]'
                    }`}>
                        {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                )}

                {/* Assignee avatar */}
                {task.assigneeName && (
                    <AssigneeAvatar name={task.assigneeName} profilePicUrl={task.assigneePhotoUrl} size={22} />
                )}

                {/* Story points */}
                {task.storyPoint != null && (
                    <span className="text-[11px] font-semibold text-[#374151] bg-[#F3F4F6] rounded px-1.5 py-0.5">
                        {task.storyPoint}
                    </span>
                )}

                {/* Status badge */}
                <div className="relative" ref={statusRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setStatusOpen(s => !s); }}
                        className={`text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${statusClass} whitespace-nowrap`}
                    >
                        <span className="max-w-[60px] sm:max-w-none truncate">{task.status?.replace(/_/g, ' ')}</span>
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

                <PriorityIcon size={13} color={priorityColor} className="shrink-0" />

                {/* Context menu */}
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
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BacklogPage() {
    const searchParams = useSearchParams();
    const projectId    = searchParams.get('projectId');
    const projectIdNum = projectId ? parseInt(projectId, 10) : null;

    const cachedTasks      = useTaskStore((s) => (projectIdNum ? s.tasksByProject[projectIdNum] : undefined));
    const setTasksForProject = useTaskStore((s) => s.setTasksForProject);

    const [tasks,    setTasks]   = useState<Task[]>(() => cachedTasks ?? []);
    const [loading,  setLoading] = useState(!cachedTasks);
    const [error,    setError]   = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadTasks = useCallback(async () => {
        if (!projectIdNum || isNaN(projectIdNum)) return;
        // Only show spinner if there's nothing cached to display
        if (!cachedTasks) setLoading(true);
        setError(null);
        try {
            const fetched = await fetchTasksByProject(projectIdNum);
            setTasks(fetched);
            setTasksForProject(projectIdNum, fetched);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load tasks');
        } finally {
            setLoading(false);
        }
    }, [projectIdNum]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { void loadTasks(); }, [loadTasks]);

    useTaskWebSocket(projectId, useCallback((event) => {
        if (event.type === 'TASK_CREATED' && event.task) {
            setTasks(prev => [...prev.filter(x => x.id !== event.task!.id), event.task as Task]);
        } else if (event.type === 'TASK_UPDATED' && event.task) {
            setTasks(prev => prev.map(x => x.id === event.task!.id ? { ...x, ...event.task } as Task : x));
        } else if (event.type === 'TASK_DELETED' && event.taskId) {
            setTasks(prev => prev.filter(x => x.id !== event.taskId));
        }
    }, []));

    // Handle Action Triggers from TopBar
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add-task') {
            setShowCreateModal(true);
        }

        if (action) {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
        }
    }, [searchParams]);

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

    const handleAddTask = useCallback(async (data: CreateTaskData) => {
        if (!projectId) return;
        try {
            const res = await api.post('/api/tasks', {
                projectId: parseInt(projectId, 10),
                title: data.title,
                storyPoint: data.storyPoint,
                priority: data.priority,
                assigneeId: data.assigneeId,
                labelIds: data.labelIds,
            });
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
            <div className="sticky-section-header -mx-4 px-4 sm:-mx-6 sm:px-6 py-3 mb-4 flex items-center gap-3 flex-wrap">
                <div>
                    <h1 className="text-[18px] sm:text-xl font-bold text-[#101828]">Product Backlog</h1>
                    <p className="text-[12px] text-[#6A7282] mt-0.5 hidden sm:block">
                        {tasks.length} issue{tasks.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-[#155DFC] text-white text-[13px] font-medium rounded-lg hover:bg-[#0042A8] transition-colors"
                >
                    <Plus size={15} />
                    Create Task
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
                                <div className="flex flex-col gap-[5px] p-3">
                                    {tasks.map((task) => (
                                        <BacklogTaskRow
                                            key={task.id}
                                            task={task}
                                            onDelete={handleDelete}
                                            onClick={setSelectedTask}
                                            onStatusChange={handleStatusChange}
                                            onOpenModal={setSelectedTaskIdForModal}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-2">
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-[#6A7282] hover:text-[#155DFC] hover:bg-[#F8FAFF] rounded-xl border border-dashed border-[#D1D5DB] hover:border-[#155DFC] transition-colors"
                                >
                                    <Plus size={15} />
                                    Add task
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── Mobile FAB ── */}
            <button
                className="fab md:hidden flex items-center justify-center"
                aria-label="Create Task"
                onClick={() => setShowCreateModal(true)}
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

            {/* ── Create Task Modal ── */}
            {projectId && (
                <CreateTaskModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onCreateTask={handleAddTask}
                    projectId={parseInt(projectId, 10)}
                />
            )}

            {/* ── Desktop Task Card Modal ── */}
            {selectedTaskIdForModal !== null && (
                <TaskCardModal
                    taskId={selectedTaskIdForModal}
                    onClose={(wasModified) => { setSelectedTaskIdForModal(null); if (wasModified) void loadTasks(); }}
                />
            )}
        </div>
    );
}

