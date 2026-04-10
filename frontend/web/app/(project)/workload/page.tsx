'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { fetchTasksByProject } from '@/app/(project)/kanban/api';
import { Task } from '@/app/(project)/kanban/types';
import TaskCardModal from '@/app/taskcard/TaskCardModal';

interface Member {
    userId: number;
    username: string;
    fullName: string | null;
    profilePicUrl: string | null;
}

interface WorkloadUser {
    member: Member;
    tasks: Task[];
}

const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    TODO:        { label: 'To Do',       bg: 'bg-gray-100',   text: 'text-gray-600' },
    IN_PROGRESS: { label: 'In Progress', bg: 'bg-blue-100',   text: 'text-blue-700' },
    IN_REVIEW:   { label: 'In Review',   bg: 'bg-amber-100',  text: 'text-amber-700' },
    DONE:        { label: 'Done',        bg: 'bg-green-100',  text: 'text-green-700' },
};

function initials(member: Member): string {
    const name = member.fullName || member.username || '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ member, size = 32 }: { member: Member; size?: number }) {
    const [imgError, setImgError] = useState(false);
    const dim = `${size}px`;
    if (member.profilePicUrl && !imgError) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={member.profilePicUrl}
                alt={member.fullName || member.username}
                width={size}
                height={size}
                onError={() => setImgError(true)}
                style={{ width: dim, height: dim }}
                className="rounded-full object-cover flex-shrink-0"
            />
        );
    }
    return (
        <div
            className="rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center flex-shrink-0 text-xs"
            style={{ width: dim, height: dim }}
        >
            {initials(member)}
        </div>
    );
}

export default function WorkloadPage() {
    const searchParams = useSearchParams();
    const projectId = searchParams.get('projectId');

    const [workload, setWorkload] = useState<WorkloadUser[]>([]);
    const [unassigned, setUnassigned] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

    const loadData = useCallback(async () => {
        if (!projectId) { setError('No project ID provided.'); return; }
        setIsLoading(true);
        setError(null);
        try {
            const pid = Number(projectId);
            const [tasks, projectRes] = await Promise.all([
                fetchTasksByProject(pid),
                api.get<{ teamId: number }>(`/api/projects/${pid}`),
            ]);
            const teamId = projectRes.data.teamId;
            const membersRes = await api.get<Member[]>(`/api/teams/${teamId}/members`);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rawMembers: Member[] = (membersRes.data as any[]).map((m: any) => {
                const u = m.user ?? m;
                return {
                    userId: u.userId ?? u.id,
                    username: u.username ?? '',
                    fullName: u.fullName ?? null,
                    profilePicUrl: u.profilePicUrl ?? null,
                };
            });

            const map = new Map<number, Task[]>();
            rawMembers.forEach((m) => map.set(m.userId, []));

            const noAssignee: Task[] = [];
            tasks.forEach((t) => {
                const aid = t.assigneeId ?? (t.assignee?.id ?? null);
                if (aid && map.has(aid)) {
                    map.get(aid)!.push(t);
                } else {
                    noAssignee.push(t);
                }
            });

            setWorkload(rawMembers.map((m) => ({ member: m, tasks: map.get(m.userId) ?? [] })));
            setUnassigned(noAssignee);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to load workload data.');
        } finally {
            setIsLoading(false);
        }
    }, [projectId]);

    useEffect(() => { void loadData(); }, [loadData]);

    if (!projectId) return <p className="p-8 text-sm text-[#6A7282]">No project selected.</p>;
    if (isLoading) return <p className="p-8 text-sm text-[#6A7282]">Loading workload…</p>;
    if (error) return <p className="p-8 text-sm text-red-600">{error}</p>;

    const totalTasks = workload.reduce((s, w) => s + w.tasks.length, 0) + unassigned.length;

    return (
        <div className="mobile-page-padding max-w-5xl mx-auto pb-28 sm:pb-8">
            <div className="mb-6">
                <h1 className="text-[26px] font-semibold text-[#101828]">Workload</h1>
                <p className="text-sm text-[#6A7282] mt-1">{totalTasks} task{totalTasks !== 1 ? 's' : ''} across {workload.length} member{workload.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="space-y-4">
                {workload.map(({ member, tasks }) => (
                    <MemberRow
                        key={member.userId}
                        member={member}
                        tasks={tasks}
                        onTaskClick={setSelectedTaskId}
                    />
                ))}

                {unassigned.length > 0 && (
                    <UnassignedRow tasks={unassigned} onTaskClick={setSelectedTaskId} />
                )}

                {workload.length === 0 && unassigned.length === 0 && (
                    <p className="text-sm text-[#6A7282] text-center py-16">No tasks found for this project.</p>
                )}
            </div>

            {selectedTaskId !== null && (
                <TaskCardModal
                    taskId={selectedTaskId}
                    onClose={() => { setSelectedTaskId(null); void loadData(); }}
                />
            )}
        </div>
    );
}

function MemberRow({
    member,
    tasks,
    onTaskClick,
}: {
    member: Member;
    tasks: Task[];
    onTaskClick: (id: number) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const done = tasks.filter((t) => t.status === 'DONE').length;
    const pct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

    const byStatus = STATUS_ORDER.reduce<Record<string, Task[]>>((acc, s) => {
        acc[s] = tasks.filter((t) => t.status === s);
        return acc;
    }, {});

    return (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            {/* Header */}
            <button
                type="button"
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F9FAFB] transition-colors text-left"
                onClick={() => setExpanded((v) => !v)}
            >
                <Avatar member={member} size={36} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#101828] truncate">
                        {member.fullName || member.username}
                    </p>
                    <p className="text-xs text-[#6A7282]">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Status breakdown */}
                <div className="hidden sm:flex items-center gap-2">
                    {STATUS_ORDER.map((s) => {
                        const count = byStatus[s].length;
                        if (!count) return null;
                        const cfg = STATUS_CONFIG[s];
                        return (
                            <span key={s} className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                                {count} {cfg.label}
                            </span>
                        );
                    })}
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-2 ml-2">
                    <div className="w-24 h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden hidden sm:block">
                        <div
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                        />
                    </div>
                    <span className="text-xs text-[#6A7282] w-8 text-right">{pct}%</span>
                    <svg
                        className={`w-4 h-4 text-[#6A7282] transition-transform ${expanded ? '' : '-rotate-90'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            {/* Tasks */}
            {expanded && tasks.length > 0 && (
                <div className="border-t border-[#F3F4F6]">
                    {tasks.map((task) => (
                        <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
                    ))}
                </div>
            )}

            {expanded && tasks.length === 0 && (
                <div className="border-t border-[#F3F4F6] px-5 py-4 text-sm text-[#9CA3AF]">No tasks assigned.</div>
            )}
        </div>
    );
}

function UnassignedRow({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (id: number) => void }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <button
                type="button"
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F9FAFB] transition-colors text-left"
                onClick={() => setExpanded((v) => !v)}
            >
                <div className="w-9 h-9 rounded-full bg-[#F3F4F6] flex items-center justify-center flex-shrink-0">
                    <span className="text-xs text-[#9CA3AF] font-semibold">—</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#344054]">Unassigned</p>
                    <p className="text-xs text-[#6A7282]">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
                </div>
                <svg
                    className={`w-4 h-4 text-[#6A7282] transition-transform ${expanded ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {expanded && (
                <div className="border-t border-[#F3F4F6]">
                    {tasks.map((task) => (
                        <TaskRow key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
                    ))}
                </div>
            )}
        </div>
    );
}

function TaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
    const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG['TODO'];
    const overdue = task.dueDate && task.status !== 'DONE' && new Date(task.dueDate) < new Date();
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex items-center gap-3 px-5 py-3 hover:bg-[#F9FAFB] transition-colors text-left border-b border-[#F3F4F6] last:border-b-0"
        >
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} shrink-0`}>
                {cfg.label}
            </span>
            <span className="flex-1 text-sm text-[#344054] truncate">{task.title}</span>
            {task.dueDate && (
                <span className={`text-xs shrink-0 ${overdue ? 'text-red-500 font-medium' : 'text-[#9CA3AF]'}`}>
                    {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {overdue ? ' (overdue)' : ''}
                </span>
            )}
            {task.priority && (
                <span className="text-xs text-[#9CA3AF] shrink-0 hidden sm:inline">{task.priority}</span>
            )}
        </button>
    );
}
