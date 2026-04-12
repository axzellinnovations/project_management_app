'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    AlertCircle, Plus, ChevronDown, ChevronUp,
    Check, Trash2, MoreHorizontal, X, CornerDownLeft
} from 'lucide-react';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '@/components/shared/EmptyState';
import BottomSheet from '@/components/shared/BottomSheet';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import BacklogTaskRow from './components/BacklogTaskRow';
import BacklogFilterBar from './components/BacklogFilterBar';
import BacklogTaskDetail from './components/BacklogTaskDetail';
import { useBacklogData } from './hooks/useBacklogData';
import { fetchProject } from '../kanban/api';

export default function BacklogPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const projectId = searchParams.get('projectId');
    // Start as checked if there's no projectId (nothing to redirect)
    const [typeChecked, setTypeChecked] = useState(() => !projectId);

    // Redirect agile projects to sprint-backlog
    useEffect(() => {
        if (!projectId) return;
        // Only trust the stored type if it belongs to this project
        const storedId = localStorage.getItem('currentProjectId');
        const stored = storedId === projectId ? localStorage.getItem('currentProjectType') : null;
        if (stored === 'AGILE' || stored === 'Agile Scrum' || stored === 'SCRUM') {
            router.replace(`/sprint-backlog?projectId=${projectId}`);
            return;
        }
        // Authoritative check via API
        fetchProject(parseInt(projectId, 10)).then(proj => {
            const type = proj?.type;
            if (type === 'AGILE' || type === 'Agile Scrum' || type === 'SCRUM') {
                router.replace(`/sprint-backlog?projectId=${projectId}`);
            } else {
                setTypeChecked(true);
            }
        }).catch(() => setTypeChecked(true));
    }, [projectId, router]);

    // Must be called unconditionally before any early returns
    const [
        showInlineCreate, setShowInlineCreate
    ] = useState(false);
    const [inlineTitle, setInlineTitle] = useState('');
    const {
        tasks, loading, error, collapsed, setCollapsed,
        selectedTask, setSelectedTask,
        selectedTaskIdForModal, setSelectedTaskIdForModal,
        showCreateModal, setShowCreateModal,
        searchTerm, setSearchTerm,
        filterPriority, setFilterPriority,
        filterStatus, setFilterStatus,
        filterAssignee, setFilterAssignee,
        filterLabel, setFilterLabel,
        filterDateRange, setFilterDateRange,
        groupBy, setGroupBy,
        teamMembers, labels,
        selectedIds, setSelectedIds,
        groupedTasks,
        handleMarkDone, handleDelete, handleAddTask,
        handleStatusChange, handleBulkDelete, handleBulkDone,
        toggleSelect, loadTasks,
    } = useBacklogData(projectId);

    // Handle action triggers from TopBar (e.g. ?action=add-task)
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add-task') setShowCreateModal(true);
        if (action) {
            const url = new URL(window.location.href);
            url.searchParams.delete('action');
            window.history.replaceState({}, '', url.toString());
        }
    }, [searchParams, setShowCreateModal]);

    if (!typeChecked) {
        return (
            <div className="mobile-page-padding max-w-[900px] mx-auto">
                <div className="flex items-center justify-between mb-5">
                    <div className="skeleton h-7 w-40 rounded-lg" />
                </div>
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="skeleton h-[60px] rounded-xl" />
                    ))}
                </div>
            </div>
        );
    }

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

            {/* ── Filter bar ── */}
            <BacklogFilterBar
                searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                filterPriority={filterPriority} setFilterPriority={setFilterPriority}
                filterStatus={filterStatus} setFilterStatus={setFilterStatus}
                filterAssignee={filterAssignee} setFilterAssignee={setFilterAssignee}
                filterLabel={filterLabel} setFilterLabel={setFilterLabel}
                filterDateRange={filterDateRange} setFilterDateRange={setFilterDateRange}
                groupBy={groupBy} setGroupBy={setGroupBy}
                teamMembers={teamMembers} labels={labels}
            />

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

            {/* ── Backlog section(s) ── */}
            {groupedTasks.map(group => (
              <div key={group.label} className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden mb-4">
                <button
                    onClick={() => setCollapsed((c) => !c)}
                    className="sticky-section-header w-full flex items-center gap-3 px-4 py-3 border-b border-[#E5E7EB] hover:bg-[#F9FAFB] transition-colors"
                >
                    <span className="text-[13px] font-semibold text-[#374151]">{group.label}</span>
                    <span className="text-[11px] font-semibold text-[#9CA3AF] bg-[#F3F4F6] px-2 py-0.5 rounded-full">
                        {group.items.length}
                    </span>
                    <span className="ml-auto text-[#9CA3AF]">
                        {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </span>
                </button>

                <AnimatePresence initial={false}>
                    {!collapsed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                            className="overflow-hidden"
                        >
                            {group.items.length === 0 ? (
                                <EmptyState
                                    icon={<MoreHorizontal size={24} />}
                                    title="No backlog items yet"
                                    subtitle="Create your first issue to get started."
                                />
                            ) : (
                                <div className="flex flex-col gap-[5px] p-3">
                                    {/* Table header */}
                                    <div className="hidden sm:grid grid-cols-[auto_1fr_120px_100px_120px_100px_32px] items-center gap-x-2 px-3 sm:px-4 text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">
                                        <span className="w-3.5" />
                                        <span>Title</span>
                                        <span>Label</span>
                                        <span>Priority</span>
                                        <span>Status</span>
                                        <span>Assignee</span>
                                        <span />
                                    </div>
                                    {group.items.map((task) => (
                                        <BacklogTaskRow
                                            key={task.id}
                                            task={task}
                                            onDelete={handleDelete}
                                            onClick={setSelectedTask}
                                            onStatusChange={handleStatusChange}
                                            onOpenModal={setSelectedTaskIdForModal}
                                            selected={selectedIds.has(task.id)}
                                            onToggleSelect={toggleSelect}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-2">
                                {showInlineCreate ? (
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            autoFocus
                                            type="text"
                                            value={inlineTitle}
                                            onChange={e => setInlineTitle(e.target.value)}
                                            onKeyDown={async e => {
                                                if (e.key === 'Enter' && inlineTitle.trim()) {
                                                    await handleAddTask({ title: inlineTitle.trim(), priority: 'MEDIUM', labelIds: [], storyPoint: 0 });
                                                    setInlineTitle('');
                                                    setShowInlineCreate(false);
                                                } else if (e.key === 'Escape') {
                                                    setInlineTitle('');
                                                    setShowInlineCreate(false);
                                                }
                                            }}
                                            placeholder="Task title…"
                                            className="flex-1 text-[13px] px-3 py-1.5 border border-[#D1D5DB] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#155DFC]"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (inlineTitle.trim()) {
                                                    await handleAddTask({ title: inlineTitle.trim(), priority: 'MEDIUM', labelIds: [], storyPoint: 0 });
                                                    setInlineTitle('');
                                                }
                                                setShowInlineCreate(false);
                                            }}
                                            className="p-1.5 rounded-lg bg-[#155DFC] text-white hover:bg-[#0042A8] transition-colors"
                                            title="Create (Enter)"
                                        >
                                            <CornerDownLeft size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setInlineTitle(''); setShowInlineCreate(false); }}
                                            className="p-1.5 rounded-lg text-[#6A7282] hover:bg-[#F3F4F6] transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowInlineCreate(true)}
                                        className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-[#6A7282] hover:text-[#155DFC] hover:bg-[#F8FAFF] rounded-xl border border-dashed border-[#D1D5DB] hover:border-[#155DFC] transition-colors"
                                    >
                                        <Plus size={15} />
                                        Add task
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
              </div>
            ))}

            {/* ── Bulk action floating bar ── */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-4 py-2.5 bg-[#101828] text-white rounded-2xl shadow-2xl">
                    <span className="text-[13px] font-medium">{selectedIds.size} selected</span>
                    <button onClick={handleBulkDone} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#16A34A] rounded-xl text-[12px] font-medium hover:bg-green-700 transition-colors">
                        <Check size={13} /> Mark Done
                    </button>
                    <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 rounded-xl text-[12px] font-medium hover:bg-red-700 transition-colors">
                        <Trash2 size={13} /> Delete
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-xl hover:bg-white/10 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}

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
                    <BacklogTaskDetail
                        task={selectedTask}
                        onStatusChange={(id, status) => { void handleStatusChange(id, status); setSelectedTask({ ...selectedTask, status }); }}
                        onMarkDone={handleMarkDone}
                        onDelete={handleDelete}
                        onOpenModal={setSelectedTaskIdForModal}
                        onClose={() => setSelectedTask(null)}
                    />
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

