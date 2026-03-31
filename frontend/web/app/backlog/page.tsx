'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Sidebar from '../nav/Sidebar';
import TopBar from '../nav/TopBar';
import { Task } from '../kanban/types';
import { fetchTasksByProject, createTask, updateTask, deleteTask } from '../kanban/api';
import CreateTaskModal from '../kanban/components/CreateTaskModal';
import EditTaskModal from '../kanban/components/EditTaskModal';
import { AlertCircle, Loader, Plus, Search, Filter, RefreshCw, Trash2, PencilLine } from 'lucide-react';

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

type StatusFilter = 'ALL' | (typeof STATUS_OPTIONS)[number];
type SortBy = 'dueDate' | 'status' | 'id';

const statusLabel: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

function statusBadgeClass(status?: string) {
  switch (status) {
    case 'DONE':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'IN_REVIEW':
      return 'bg-violet-100 text-violet-700 border-violet-200';
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export default function BacklogPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');

  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('dueDate');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [rowBusyTaskId, setRowBusyTaskId] = useState<number | null>(null);

  // Fetch tasks from backend
  const loadTasks = useCallback(async () => {
    if (!projectId) {
      setError('No project ID provided. Use ?projectId=<id> in URL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const projectIdNum = parseInt(projectId as string);
      if (isNaN(projectIdNum)) {
        throw new Error('Invalid project ID');
      }
      const fetchedTasks = await fetchTasksByProject(projectIdNum);
      setTasks(fetchedTasks);
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMsg);
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    const rows = tasks.filter((task) => {
      const matchesSearch =
        !normalizedSearch ||
        task.title.toLowerCase().includes(normalizedSearch) ||
        task.description?.toLowerCase().includes(normalizedSearch) ||
        String(task.id).includes(normalizedSearch);

      const matchesStatus = statusFilter === 'ALL' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    rows.sort((a, b) => {
      if (sortBy === 'dueDate') {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
        return aDate - bDate;
      }

      if (sortBy === 'status') {
        const rank = { TODO: 1, IN_PROGRESS: 2, IN_REVIEW: 3, DONE: 4 } as Record<string, number>;
        return (rank[a.status] || 99) - (rank[b.status] || 99);
      }

      return a.id - b.id;
    });

    return rows;
  }, [tasks, search, statusFilter, sortBy]);

  const projectIdNum = useMemo(() => {
    if (!projectId) return null;
    const value = parseInt(projectId, 10);
    return Number.isNaN(value) ? null : value;
  }, [projectId]);

  const handleCreateTask = async (payload: Partial<Task>) => {
    setIsSaving(true);
    try {
      const created = await createTask(payload);
      setTasks((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditOpen = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = async (taskId: number, payload: Partial<Task>) => {
    setIsSaving(true);
    try {
      const updated = await updateTask(taskId, payload);
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
      setIsEditModalOpen(false);
      setEditingTask(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Delete this issue from backlog?')) return;
    setRowBusyTaskId(taskId);
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete issue';
      setError(message);
    } finally {
      setRowBusyTaskId(null);
    }
  };

  const handleInlineStatusChange = async (taskId: number, status: string) => {
    const previous = tasks;
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, status } : task)));
    setRowBusyTaskId(taskId);
    try {
      const updated = await updateTask(taskId, { status });
      setTasks((prev) => prev.map((task) => (task.id === taskId ? updated : task)));
    } catch (err) {
      setTasks(previous);
      const message = err instanceof Error ? err.message : 'Failed to update status';
      setError(message);
    } finally {
      setRowBusyTaskId(null);
    }
  };

  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Missing Project ID
          </h1>
          <p className="text-gray-600">
            Please provide a project ID in the URL: <code className="bg-gray-100 px-2 py-1 rounded">/backlog?projectId=1</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar */}
        <TopBar />
        
        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Product Backlog</h1>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Plus size={16} />
                Create Issue
              </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-2 relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by issue title, description, or ID"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>

                <div className="relative">
                  <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="ALL">All Status</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel[status]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="dueDate">Sort: Due Date</option>
                    <option value="status">Sort: Status</option>
                    <option value="id">Sort: ID</option>
                  </select>
                  <button
                    onClick={loadTasks}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
                    title="Refresh backlog"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Error</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <Loader className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                <p className="text-gray-600">Loading backlog items...</p>
              </div>
            </div>
          ) : (
            /* Backlog Items */
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <p className="text-gray-500">No backlog issues match your current filters.</p>
                </div>
              ) : (
                <table className="w-full min-w-[950px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-xs uppercase tracking-wide text-gray-500">
                      <th className="text-left py-3 px-4">Issue</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Assignee</th>
                      <th className="text-left py-3 px-4">Due Date</th>
                      <th className="text-right py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr key={task.id} className="border-b border-gray-100 hover:bg-blue-50/30">
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500">KAN-{task.id}</span>
                            <span className="text-sm font-medium text-gray-900">{task.title}</span>
                            {task.description && (
                              <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <select
                            value={task.status}
                            onChange={(e) => void handleInlineStatusChange(task.id, e.target.value)}
                            disabled={rowBusyTaskId === task.id}
                            className={`text-xs rounded-md border px-2 py-1 ${statusBadgeClass(task.status)}`}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel[status]}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="py-3 px-4 text-sm text-gray-700">{task.assigneeName || 'Unassigned'}</td>

                        <td className="py-3 px-4 text-sm text-gray-700">{task.dueDate || '-'}</td>


                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditOpen(task)}
                              className="p-2 rounded-md text-gray-500 hover:text-blue-700 hover:bg-blue-100"
                              title="Edit issue"
                            >
                              <PencilLine size={14} />
                            </button>
                            <button
                              onClick={() => void handleDeleteTask(task.id)}
                              className="p-2 rounded-md text-gray-500 hover:text-red-700 hover:bg-red-100"
                              title="Delete issue"
                            >
                              {rowBusyTaskId === task.id ? <Loader size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {projectIdNum && (
            <CreateTaskModal
              isOpen={isCreateModalOpen}
              onClose={() => setIsCreateModalOpen(false)}
              onCreateTask={handleCreateTask}
              columnStatus="TODO"
              projectId={projectIdNum}
              loading={isSaving}
            />
          )}

          <EditTaskModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingTask(null);
            }}
            onUpdateTask={handleUpdateTask}
            task={editingTask}
            loading={isSaving}
          />
        </div>
      </div>
    </div>
  );
}