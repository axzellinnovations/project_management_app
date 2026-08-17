'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    AlertCircle, Plus, ChevronDown, ChevronUp,
    Archive, Check, Trash2, MoreHorizontal, X, CornerDownLeft
} from 'lucide-react';
import { RefreshCw } from 'lucide-react';
import CreateTaskModal from '@/components/shared/CreateTaskModal';
import { motion, AnimatePresence } from 'framer-motion';
import EmptyState from '@/components/shared/EmptyState';
import BottomSheet from '@/components/shared/BottomSheet';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import BacklogTaskRow from './components/BacklogTaskRow';
import BacklogFilterBar from './components/BacklogFilterBar';
import BacklogTaskDetail from './components/BacklogTaskDetail';
import { useBacklogData } from './hooks/useBacklogData';
import { RouteLoadingState } from '@/components/shared/RouteBoundaryState';
import { stripQueryParam } from '@/lib/url';
import { fetchProject } from '../kanban/api';
function BacklogPageContent() {
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
    const [inlineTitleLength, setInlineTitleLength] = useState(0);
    const [showArchived, setShowArchived] = useState(false);
    const {
        tasks, archivedTasks, archivedLoading, loading, error, collapsedGroups, toggleGroup,
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
        handleStatusChange, handleAssigneeChange, handleAssignMultiple, handleBulkDelete, handleBulkDone,
        handleArchiveTask, handleUnarchiveTask,
        toggleSelect, loadTasks, handleDateChange
    } = useBacklogData(projectId, showArchived);

    // Handle action triggers from TopBar (e.g. ?action=add-task)
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'add-task') setShowCreateModal(true);
        if (action) {
            stripQueryParam('action');
        }
    }, [searchParams, setShowCreateModal]);

    if (!typeChecked) {
        return (
            <div className="mobile-page-padding max-w-[1400px] mx-auto">
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
            <div className="mobile-page-padding max-w-[1400px] mx-auto">
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
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar touch-pan-y px-4 sm:px-6 lg:px-8 pb-6 bg-[radial-gradient(circle_at_top_left,rgba(21,93,252,0.08),transparent_28%),linear-gradient(180deg,var(--cu-bg-secondary),var(--cu-bg-secondary))]" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="w-full max-w-[1400px] mx-auto">
            {/* ── Header ── */}
            <div className="sticky-section-header border border-cu-border rounded-2xl px-4 sm:px-6 py-4 mb-4 flex items-center justify-between gap-3 flex-wrap flex-shrink-0 z-40 bg-cu-bg/90 backdrop-blur shadow-cu-sm">
                <div>
                    <h1 className="text-[20px] sm:text-2xl font-bold text-cu-text-primary">Product Backlog</h1>
                    <p
                        data-testid="issue-count"
                        aria-live="polite"
                        className="text-[12px] sm:text-[13px] text-cu-text-secondary mt-0.5"
                    >
                        {tasks.length} issue{tasks.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="hidden sm:flex items-center gap-2 h-10 px-4 bg-cu-primary text-white text-[13px] font-semibold rounded-xl hover:bg-cu-primary-hover transition-colors shadow-sm"
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
                showArchived={showArchived} setShowArchived={setShowArchived}
                teamMembers={teamMembers} labels={labels}
            />

            {/* ── Error ── */}
            {error && (
                <div className="flex items-start justify-between gap-3 p-4 bg-red-500/10 border border-red-500/25 rounded-xl text-red-500 mb-4 flex-wrap">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <p className="font-semibold text-sm">Error loading backlog</p>
                            <p className="text-xs mt-0.5">{error}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadTasks()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-white/80 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-white transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry
                    </button>
                </div>
            )}

            {/* ── Backlog section(s) ── */}
            {groupedTasks.map(group => (
              <div key={group.label} className="bg-cu-bg rounded-2xl border border-cu-border overflow-hidden mb-4 shadow-cu-sm">
                <button
                    onClick={() => toggleGroup(group.label)}
                    className="sticky-section-header w-full flex items-center gap-3 px-4 py-3 border-b border-cu-border bg-cu-bg/95 hover:bg-cu-hover transition-colors"
                >
                    <span className="text-[13px] font-semibold text-cu-text-primary">{group.label}</span>
                    <span className="text-[11px] font-semibold text-cu-text-tertiary bg-cu-bg-tertiary px-2 py-0.5 rounded-full">
                        {group.items.length}
                    </span>
                    <span className="ml-auto text-cu-text-tertiary">
                        {collapsedGroups[group.label] ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </span>
                </button>

                <AnimatePresence initial={false}>
                    {!collapsedGroups[group.label] && (
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
                                <div className="flex flex-col gap-[5px] p-3 sm:p-4">
                                    {/* Table header */}
                                    <div className="hidden sm:grid grid-cols-[auto_1.5fr_140px_110px_130px_110px_120px_32px] items-center gap-x-2 px-3 sm:px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-cu-text-muted mb-1 rounded-lg bg-cu-bg-secondary border border-cu-border-light">
                                        <span className="w-3.5" />
                                        <span>Title</span>
                                        <span>Label</span>
                                        <span>Priority</span>
                                        <span>Status</span>
                                        <span>Assignee</span>
                                        <span>Due Date</span>
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
                                            onArchive={handleArchiveTask}
                                            onUnarchive={handleUnarchiveTask}
                                            selected={selectedIds.has(task.id)}
                                            onToggleSelect={toggleSelect}
                                            onDateChange={handleDateChange}
                                            onAssigneeChange={handleAssigneeChange}
                                            onAssignMultiple={handleAssignMultiple}
                                            teamMembers={teamMembers}
                                        />
                                    ))}
                                </div>
                            )}
                            <div className="px-3 py-2 border-t border-cu-border-light">
                                {showInlineCreate ? (
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex-1">
                                            <input
                                                autoFocus
                                                type="text"
                                                maxLength={255}
                                                value={inlineTitle}
                                                onChange={e => {
                                                    setInlineTitle(e.target.value);
                                                    setInlineTitleLength(e.target.value.length);
                                                }}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Enter' && inlineTitle.trim()) {
                                                        await handleAddTask({ title: inlineTitle.trim(), priority: 'MEDIUM', labelIds: [], storyPoint: 0 });
                                                        setInlineTitle('');
                                                        setInlineTitleLength(0);
                                                        setShowInlineCreate(false);
                                                    } else if (e.key === 'Escape') {
                                                        setInlineTitle('');
                                                        setInlineTitleLength(0);
                                                        setShowInlineCreate(false);
                                                    }
                                                }}
                                                placeholder="Task title…"
                                                className="w-full text-[13px] px-3 py-1.5 border border-cu-border rounded-xl focus:outline-none focus:ring-2 focus:ring-cu-primary bg-cu-bg text-cu-text-primary"
                                            />
                                            {inlineTitleLength > 200 && (
                                                <p className="text-xs text-amber-500 mt-1">
                                                    {255 - inlineTitleLength} characters remaining
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={async () => {
                                                if (inlineTitle.trim()) {
                                                    await handleAddTask({ title: inlineTitle.trim(), priority: 'MEDIUM', labelIds: [], storyPoint: 0 });
                                                    setInlineTitle('');
                                                    setInlineTitleLength(0);
                                                }
                                                setShowInlineCreate(false);
                                            }}
                                            className="p-1.5 rounded-lg bg-cu-primary text-white hover:bg-cu-primary-hover transition-colors"
                                            title="Create (Enter)"
                                        >
                                            <CornerDownLeft size={14} />
                                        </button>
                                        <button
                                            onClick={() => { setInlineTitle(''); setInlineTitleLength(0); setShowInlineCreate(false); }}
                                            className="p-1.5 rounded-lg text-cu-text-secondary hover:bg-cu-hover transition-colors"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowInlineCreate(true)}
                                        className="flex items-center gap-2 w-full px-4 py-2.5 text-[13px] text-cu-text-secondary hover:text-cu-primary hover:bg-cu-primary/10 rounded-xl border border-dashed border-cu-border hover:border-cu-primary/60 transition-colors"
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

            {showArchived && (
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <Archive className="w-4 h-4 text-amber-500" />
                        <h3 className="text-sm font-medium text-cu-text-secondary">
                            Archived Tasks ({archivedTasks.length})
                        </h3>
                    </div>
                    {archivedLoading ? (
                        <div className="text-sm text-cu-text-secondary px-4 py-2">Loading...</div>
                    ) : archivedTasks.length === 0 ? (
                        <div className="text-sm text-cu-text-secondary px-4 py-8 text-center">
                            No archived tasks
                        </div>
                    ) : (
                        <div className="opacity-60 flex flex-col gap-[5px]">
                            {archivedTasks.map(task => (
                                <BacklogTaskRow
                                    key={task.id}
                                    task={{ ...task, archived: true }}
                                    onDelete={handleDelete}
                                    onClick={setSelectedTask}
                                    onStatusChange={handleStatusChange}
                                    onOpenModal={setSelectedTaskIdForModal}
                                    onArchive={handleArchiveTask}
                                    onUnarchive={handleUnarchiveTask}
                                    isArchived
                                    selected={false}
                                    onDateChange={handleDateChange}
                                    onAssigneeChange={handleAssigneeChange}
                                    onAssignMultiple={handleAssignMultiple}
                                    teamMembers={teamMembers}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Bulk action floating bar ── */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-[var(--cu-z-toast)] flex items-center gap-2 px-4 py-2.5 bg-cu-bg text-cu-text-primary border border-cu-border rounded-2xl shadow-2xl">
                    <span className="text-[13px] font-medium">{selectedIds.size} selected</span>
                    <button onClick={handleBulkDone} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[12px] font-medium hover:bg-emerald-700 transition-colors">
                        <Check size={13} /> Mark Done
                    </button>
                    <button onClick={handleBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-xl text-[12px] font-medium hover:bg-red-700 transition-colors">
                        <Trash2 size={13} /> Delete
                    </button>
                    <button onClick={() => setSelectedIds(new Set())} className="p-1.5 rounded-xl text-cu-text-secondary hover:text-cu-text-primary hover:bg-cu-hover transition-colors">
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
        </div>
    );
}

export default function BacklogPage() {
    return (
        <Suspense fallback={<RouteLoadingState title="Loading backlog" subtitle="Preparing backlog tasks and filters." variant="table" />}>
            <BacklogPageContent />
        </Suspense>
    );
}
