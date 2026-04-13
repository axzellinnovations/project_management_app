import { useState, useCallback, useEffect, useMemo } from 'react';
import { Task, Label, DateFilter } from '../../kanban/types';
import { fetchTasksByProject, fetchProjectLabels, fetchProject, fetchTeamMembers, TeamMemberOption } from '../../kanban/api';
import api from '@/lib/axios';
import { useTaskWebSocket } from '@/hooks/useTaskWebSocket';
import { type CreateTaskData } from '@/components/shared/CreateTaskModal';
import { buildSessionCacheKey, getSessionCache, setSessionCache, removeSessionCache } from '@/lib/session-cache';

export function useBacklogData(projectId: string | null) {

    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [selectedTaskIdForModal, setSelectedTaskIdForModal] = useState<number | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Filter & group state
    const [searchTerm, setSearchTerm] = useState('');
    const [filterPriority, setFilterPriority] = useState<string[]>([]);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterAssignee, setFilterAssignee] = useState('');
    const [filterLabel, setFilterLabel] = useState<number | null>(null);
    const [filterDateRange, setFilterDateRange] = useState<DateFilter>({ startDate: null, endDate: null });
    const [groupBy, setGroupBy] = useState<'none' | 'status' | 'priority' | 'assignee'>('none');

    const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
    const [labels, setLabels] = useState<Label[]>([]);
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = useCallback((label: string) => {
        setCollapsedGroups(prev => ({ ...prev, [label]: !prev[label] }));
    }, []);

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    // ── Static Data (Run once per project) ──
    const fetchStaticData = useCallback(async () => {
        if (!projectId) return;
        const pid = parseInt(projectId, 10);
        if (isNaN(pid)) return;
        try {
            const [labelsData, project] = await Promise.all([
                fetchProjectLabels(pid),
                fetchProject(pid),
            ]);
            setLabels(labelsData);
            if (project?.teamId) {
                const members = await fetchTeamMembers(project.teamId as number);
                setTeamMembers(members);
            }
        } catch (err) {
            console.error('Error loading static backlog data:', err);
        }
    }, [projectId]);

    // ── Dynamic Data (Periodic Sync) ──
    const fetchData = useCallback(async (options: { showSpinner?: boolean, forceNetwork?: boolean } = {}) => {
        if (!projectId) return;
        const { showSpinner = true, forceNetwork = false } = options;
        const pid = parseInt(projectId, 10);
        if (isNaN(pid)) return;

        const cKey = buildSessionCacheKey('kanban-backlog', [projectId]);
        if (cKey && !forceNetwork) {
            const cached = getSessionCache<Task[]>(cKey, { allowStale: true });
            if (cached.data) {
                setTasks(cached.data);
                setLoading(false);
                if (!cached.isStale) return; // Fresh cache
            }
        }

        if (showSpinner) setLoading(true);
        setError(null);
        try {
            const fetched = await fetchTasksByProject(pid);
            setTasks(fetched);
            if (cKey) setSessionCache(cKey, fetched, 30 * 60_000);
        } catch (err) {
            console.error('Error loading backlog tasks:', err);
            if (showSpinner) setError(err instanceof Error ? err.message : 'Failed to load tasks');
        } finally {
            if (showSpinner) setLoading(false);
        }
    }, [projectId]);

    const forceRefresh = useCallback(() => void fetchData({ showSpinner: false, forceNetwork: true }), [fetchData]);

    useEffect(() => {
        if (!projectId) return;
        void fetchStaticData();
        void fetchData({ showSpinner: true });
        const id = setInterval(() => void fetchData({ showSpinner: false }), 30_000);
        return () => clearInterval(id);
    }, [projectId, fetchStaticData, fetchData]);

    useTaskWebSocket(projectId, useCallback((event) => {
        if (event.type === 'TASK_CREATED' && event.task) {
            setTasks(prev => [...prev.filter(x => x.id !== event.task!.id), event.task as Task]);
        } else if (event.type === 'TASK_UPDATED' && event.task) {
            setTasks(prev => prev.map(x => x.id === event.task!.id ? { ...x, ...event.task } as Task : x));
        } else if (event.type === 'TASK_DELETED' && event.taskId) {
            setTasks(prev => prev.filter(x => x.id !== event.taskId));
        }
    }, []));

    const handleMarkDone = useCallback(async (id: number) => {
        const task = tasks.find(t => t.id === id);
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'DONE' } : t));
        try {
            await api.patch(`/api/tasks/${id}/status`, { status: 'DONE' });
        } catch (e: unknown) {
            const status = (e as { response?: { status?: number } })?.response?.status;
            if ((status === 401 || status === 404) && task?.title) {
                try { await api.put(`/api/tasks/${id}`, { title: task.title, status: 'DONE' }); forceRefresh(); return; } catch { /* fall through */ }
            }
            forceRefresh();
        }
    }, [tasks, forceRefresh]);

    const handleDelete = useCallback(async (id: number) => {
        setTasks(prev => prev.filter(t => t.id !== id));
        try { await api.delete(`/api/tasks/${id}`); forceRefresh(); } catch { forceRefresh(); }
    }, [forceRefresh]);

    const handleAddTask = useCallback(async (data: CreateTaskData) => {
        if (!projectId) return;
        try {
            const res = await api.post('/api/tasks', {
                projectId: parseInt(projectId, 10),
                title: data.title,
                priority: data.priority,
                assigneeId: data.assigneeId,
                labelIds: data.labelIds,
            });
            const newTask = res.data as Task;
            // Deduplicate: WebSocket may have already added this task
            setTasks(prev => prev.some(t => t.id === newTask.id) ? prev : [...prev, newTask]);
            const key = buildSessionCacheKey('kanban-backlog', [projectId]);
            if (key) removeSessionCache(key);
            forceRefresh();
        } catch (err) {
            console.error('Failed to create task:', err);
        }
    }, [projectId, forceRefresh]);

    const handleStatusChange = useCallback(async (id: number, status: string) => {
        const task = tasks.find(t => t.id === id);
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
        try {
            await api.patch(`/api/tasks/${id}/status`, { status });
        } catch (e: unknown) {
            const errStatus = (e as { response?: { status?: number } })?.response?.status;
            if ((errStatus === 401 || errStatus === 404) && task?.title) {
                try { await api.put(`/api/tasks/${id}`, { title: task.title, status }); forceRefresh(); return; } catch { /* fall through */ }
            }
            forceRefresh();
        }
    }, [tasks, forceRefresh]);

    const handleDateChange = useCallback((id: number, dueDate: string | null) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, dueDate: dueDate || undefined } : t));
    }, []);

    const handleBulkDelete = useCallback(async () => {
        const ids = [...selectedIds];
        setTasks(prev => prev.filter(t => !ids.includes(t.id)));
        setSelectedIds(new Set());
        try { await Promise.all(ids.map(id => api.delete(`/api/tasks/${id}`))); forceRefresh(); } catch { forceRefresh(); }
    }, [selectedIds, forceRefresh]);

    const handleBulkDone = useCallback(async () => {
        const ids = [...selectedIds];
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, status: 'DONE' } : t));
        setSelectedIds(new Set());
        try {
            await api.patch('/api/tasks/bulk/status', { taskIds: ids, status: 'DONE' });
            forceRefresh();
        } catch {
            // Fallback: update each task individually with PUT
            try {
                const tasksToUpdate = tasks.filter(t => ids.includes(t.id));
                await Promise.all(tasksToUpdate.map(t => api.put(`/api/tasks/${t.id}`, { title: t.title, status: 'DONE' })));
                forceRefresh();
            } catch { forceRefresh(); }
        }
    }, [tasks, selectedIds, forceRefresh]);

    const toggleSelect = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }, []);

    // Filtered + grouped tasks
    const filteredTasks = useMemo(() => {
        let result = tasks;
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(t => t.title.toLowerCase().includes(lower));
        }
        if (filterPriority.length > 0) result = result.filter(t => t.priority && filterPriority.includes(t.priority));
        if (filterStatus.length > 0) result = result.filter(t => filterStatus.includes(t.status));
        if (filterAssignee) result = result.filter(t => t.assigneeName === filterAssignee);
        if (filterLabel !== null) result = result.filter(t => t.labels?.some(l => l.id === filterLabel) || t.labelId === filterLabel);
        if (filterDateRange.startDate || filterDateRange.endDate) {
            result = result.filter(t => {
                if (!t.dueDate) return false;
                const d = new Date(t.dueDate + 'T00:00:00');
                if (filterDateRange.startDate && d < filterDateRange.startDate) return false;
                if (filterDateRange.endDate && d > filterDateRange.endDate) return false;
                return true;
            });
        }
        return result;
    }, [tasks, searchTerm, filterPriority, filterStatus, filterAssignee, filterLabel, filterDateRange]);

    const groupedTasks = useMemo(() => {
        if (groupBy === 'none') return [{ label: 'Backlog', items: filteredTasks }];
        if (groupBy === 'status') {
            const groups: Record<string, Task[]> = {};
            filteredTasks.forEach(t => { (groups[t.status] = groups[t.status] || []).push(t); });
            return Object.entries(groups).map(([label, items]) => ({ label: label.replace(/_/g, ' '), items }));
        }
        if (groupBy === 'assignee') {
            const groups: Record<string, Task[]> = {};
            filteredTasks.forEach(t => { const k = t.assigneeName || 'Unassigned'; (groups[k] = groups[k] || []).push(t); });
            return Object.entries(groups).map(([label, items]) => ({ label, items }));
        }
        const groups: Record<string, Task[]> = {};
        filteredTasks.forEach(t => { const k = t.priority || 'NONE'; (groups[k] = groups[k] || []).push(t); });
        return Object.entries(groups).map(([label, items]) => ({ label, items }));
    }, [filteredTasks, groupBy]);

    return {
        tasks, loading, error, collapsedGroups, toggleGroup,
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
        filteredTasks, groupedTasks,
        handleMarkDone, handleDelete, handleAddTask,
        handleStatusChange, handleBulkDelete, handleBulkDone,
        toggleSelect, loadTasks: fetchData, handleDateChange, forceRefresh,
    };
}
