// ══════════════════════════════════════════════════════════════════════════════
//  reportUtils.ts  ·  Data-processing helpers — Planora Project Management
// ══════════════════════════════════════════════════════════════════════════════
import { Task, Sprint, ProjectMetrics, MilestoneResponse } from '@/types';

// ── Colour palettes (used by UI charts + PDF/Excel) ──────────────────────────
export const PRIORITY_COLORS: Record<string, string> = {
  URGENT:     '#DC2626',
  HIGH:       '#F97316',
  MEDIUM:     '#EAB308',
  NORMAL:     '#155DFC',
  LOW:        '#16A34A',
  UNASSIGNED: '#6B7280',
};

export const STATUS_COLORS: Record<string, string> = {
  TODO:        '#667085',
  IN_PROGRESS: '#155DFC',
  IN_REVIEW:   '#F59E0B',
  DONE:        '#16A34A',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function fmtDate(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';
}

export function humanStatus(s: string): string {
  const map: Record<string, string> = {
    TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done',
    ACTIVE: 'Active', COMPLETED: 'Completed', NOT_STARTED: 'Not Started',
    OPEN: 'Open', ARCHIVED: 'Archived',
  };
  return map[s?.toUpperCase()] ?? s;
}

// ── Core data types ───────────────────────────────────────────────────────────

export interface TaskSummary {
  id: number;
  title: string;
  // Human-readable
  status: string;
  priority: string;
  assignee: string;
  sprint: string;
  storyPoints: number;
  dueDate: string;       // formatted display string
  createdAt: string;
  completedAt: string;
  // Raw keys for filtering
  statusKey: string;     // 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
  priorityKey: string;   // 'URGENT' | 'HIGH' | 'MEDIUM' | 'NORMAL' | 'LOW'
  // Computed for UI / PDF
  rawDueDate: string | null;
  rawCompletedAt: string | null;
  isOverdue: boolean;
  isUpcoming: boolean;   // due within 7 days (and not done)
  daysOverdue: number;   // > 0 means overdue
  daysUntilDue: number;  // negative = past, positive = future
}

export interface PriorityDist { name: string; count: number; pct: number }
export interface StatusDist   { name: string; count: number; pct: number }

export interface SprintStat {
  name: string;
  status: string;
  start: string;
  end: string;
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
}

export interface MemberStat {
  name: string;
  role: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
  isIdle: boolean;
  isOverloaded: boolean;
}

export interface ReportData {
  generatedAt: string;
  projectName: string;
  projectType: string;
  projectDescription: string;
  isAgile: boolean;

  // Core metrics
  metrics: ProjectMetrics;
  completionPct: number;
  overduePct: number;

  // Task breakdown
  tasks: TaskSummary[];                  // all valid tasks
  overdueTasks: TaskSummary[];           // pre-filtered: past due, not done
  upcomingTasks: TaskSummary[];          // pre-filtered: due in ≤ 7 days
  recentlyCompletedTasks: TaskSummary[]; // pre-filtered: done in last 7 days
  unassignedCount: number;
  priorityDist: PriorityDist[];
  statusDist: StatusDist[];
  avgLeadTimeDays: number;

  // Sprint (agile) — only sprints with ≥ 1 task
  sprintStats: SprintStat[];
  activeSprint?: SprintStat;
  avgVelocity: number;

  // Milestones & members
  milestones: MilestoneResponse[];
  memberStats: MemberStat[];
  idleMemberCount: number;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildReportData(
  projectDetails: { name?: string; description?: string; type?: string },
  rawTasks: Task[],
  rawSprints: Sprint[],
  metrics: ProjectMetrics,
  milestones: MilestoneResponse[],
  members: Array<{ id: number; userId: number; role?: string; user: { fullName: string; username: string } }>,
  isAgile: boolean,
): ReportData {
  const now   = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const in7Days = new Date(today);
  in7Days.setDate(today.getDate() + 7);

  const last7Days = new Date(today);
  last7Days.setDate(today.getDate() - 7);

  // ── Data cleaning ──────────────────────────────────────────────────────────
  // Remove tasks with blank / empty titles
  const cleanTasks = rawTasks.filter(t => t.title?.trim().length > 0);

  // Deduplicate sprints by name, skip blank names
  const seenSprints = new Set<string>();
  const cleanSprints = rawSprints.filter(s => {
    const key = s.name?.trim();
    if (!key) return false;
    if (seenSprints.has(key)) return false;
    seenSprints.add(key);
    return true;
  });

  // ── Build TaskSummary rows ─────────────────────────────────────────────────
  const taskRows: TaskSummary[] = cleanTasks.map(t => {
    const rawDue  = t.dueDate   || null;
    const rawDone = t.completedAt || null;
    const dueMs   = rawDue ? new Date(rawDue).getTime() : null;

    const statusKey  = (t.status   || 'TODO').toUpperCase();
    const priorityKey = (t.priority || 'NORMAL').toUpperCase();
    const isDone = statusKey === 'DONE';

    const isOverdue   = !isDone && dueMs !== null && dueMs < today.getTime();
    const isUpcoming  = !isDone && dueMs !== null
      && dueMs >= today.getTime() && dueMs <= in7Days.getTime();
    const daysUntilDue = dueMs !== null
      ? Math.ceil((dueMs - today.getTime()) / 86400000) : 0;
    const daysOverdue  = isOverdue ? Math.abs(daysUntilDue) : 0;

    return {
      id:            t.id,
      title:         t.title.trim(),
      status:        humanStatus(statusKey),
      statusKey,
      priority:      capitalize(t.priority || 'Normal'),
      priorityKey,
      assignee:      t.assigneeName?.trim() || '—',
      sprint:        t.sprintName?.trim()   || '—',
      storyPoints:   t.storyPoint || 0,
      dueDate:       fmtDate(rawDue),
      createdAt:     fmtDate(t.createdAt),
      completedAt:   fmtDate(rawDone),
      rawDueDate:    rawDue,
      rawCompletedAt: rawDone,
      isOverdue,
      isUpcoming,
      daysOverdue,
      daysUntilDue,
    };
  });

  // ── Pre-filtered lists ─────────────────────────────────────────────────────
  const overdueTasks = taskRows
    .filter(t => t.isOverdue)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const upcomingTasks = taskRows
    .filter(t => t.isUpcoming)
    .sort((a, b) => (a.daysUntilDue ?? 0) - (b.daysUntilDue ?? 0));

  const recentlyCompletedTasks = taskRows
    .filter(t => {
      if (t.statusKey !== 'DONE' || !t.rawCompletedAt) return false;
      return new Date(t.rawCompletedAt).getTime() >= last7Days.getTime();
    })
    .sort((a, b) =>
      new Date(b.rawCompletedAt!).getTime() - new Date(a.rawCompletedAt!).getTime(),
    );

  const unassignedCount = taskRows.filter(t => t.assignee === '—').length;

  // ── Priority distribution ──────────────────────────────────────────────────
  const PRIORITY_ORDER = ['URGENT', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW', 'UNASSIGNED'];
  const priorityCount: Record<string, number> = {};
  cleanTasks.forEach(t => {
    const p = (t.priority || 'NORMAL').toUpperCase();
    priorityCount[p] = (priorityCount[p] || 0) + 1;
  });
  const priorityDist: PriorityDist[] = Object.entries(priorityCount)
    .map(([name, count]) => ({
      name, count,
      pct: cleanTasks.length ? Math.round((count / cleanTasks.length) * 100) : 0,
    }))
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.name) - PRIORITY_ORDER.indexOf(b.name));

  // ── Status distribution ────────────────────────────────────────────────────
  const STATUS_ORDER = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const statusCount: Record<string, number> = {};
  cleanTasks.forEach(t => {
    const s = (t.status || 'TODO').toUpperCase();
    statusCount[s] = (statusCount[s] || 0) + 1;
  });
  const statusDist: StatusDist[] = Object.entries(statusCount)
    .map(([name, count]) => ({
      name, count,
      pct: cleanTasks.length ? Math.round((count / cleanTasks.length) * 100) : 0,
    }))
    .sort((a, b) => STATUS_ORDER.indexOf(a.name) - STATUS_ORDER.indexOf(b.name));

  // ── Average lead time ──────────────────────────────────────────────────────
  const doneTasks = cleanTasks.filter(t =>
    t.status === 'DONE' && t.completedAt && t.createdAt,
  );
  const avgLeadTimeDays = doneTasks.length
    ? Math.round(
        doneTasks.reduce((acc, t) =>
          acc + (new Date(t.completedAt!).getTime() - new Date(t.createdAt!).getTime()) / 86400000,
        0) / doneTasks.length * 10) / 10
    : 0;

  // ── Sprint stats (only non-empty sprints) ──────────────────────────────────
  const sprintStats: SprintStat[] = cleanSprints
    .map(s => {
      const sprintTasks  = cleanTasks.filter(t => t.sprintId === s.id);
      const completedTasks   = sprintTasks.filter(t => t.status === 'DONE').length;
      const totalPoints      = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
      const completedPoints  = sprintTasks
        .filter(t => t.status === 'DONE')
        .reduce((acc, t) => acc + (t.storyPoint || 0), 0);
      return {
        name:           s.name.trim(),
        status:         humanStatus(s.status),
        start:          fmtDate(s.startDate),
        end:            fmtDate(s.endDate),
        totalTasks:     sprintTasks.length,
        completedTasks,
        totalPoints,
        completedPoints,
        completionRate: sprintTasks.length
          ? Math.round((completedTasks / sprintTasks.length) * 100) : 0,
      };
    })
    .filter(s => s.totalTasks > 0);   // ← remove empty sprints

  const completedSprints = sprintStats.filter(s => s.status === 'Completed');
  const avgVelocity = completedSprints.length
    ? Math.round(
        completedSprints.reduce((acc, s) => acc + s.completedPoints, 0) /
        completedSprints.length,
      )
    : 0;

  const activeSprint = sprintStats.find(s => s.status === 'Active');

  // ── Member stats (robust multi-field matching) ────────────────────────────
  const avgTasksPerMember =
    members.length > 0
      ? cleanTasks.filter(t => t.assigneeId || t.assigneeName).length / members.length
      : 0;

  const memberStats: MemberStat[] = members.map(m => {
    const fullName = m.user.fullName?.trim() || '';
    const username = m.user.username?.trim() || '';
    const displayName = fullName || username || 'Unknown';

    const memberTasks = cleanTasks.filter(t => {
      // Match by numeric ID (most reliable)
      if (t.assigneeId != null) {
        if (t.assigneeId === m.userId || t.assigneeId === m.id) return true;
      }
      // Fallback: match by assignee object id
      if (t.assignee?.id != null) {
        if (t.assignee.id === m.userId || t.assignee.id === m.id) return true;
      }
      // Fallback: match by name string
      if (t.assigneeName) {
        const an = t.assigneeName.trim();
        if (fullName && an === fullName) return true;
        if (username  && an === username)  return true;
      }
      return false;
    });

    const completedTasks = memberTasks.filter(t =>
      (t.status || '').toUpperCase() === 'DONE',
    ).length;

    const memberOverdue = memberTasks.filter(t => {
      if ((t.status || '').toUpperCase() === 'DONE') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate).getTime() < today.getTime();
    }).length;

    const isIdle       = memberTasks.length === 0;
    const isOverloaded = !isIdle && memberTasks.length > avgTasksPerMember * 1.5;

    return {
      name:            displayName,
      role:            m.role || 'Member',
      totalTasks:      memberTasks.length,
      completedTasks,
      overdueTasks:    memberOverdue,
      completionRate:  memberTasks.length
        ? Math.round((completedTasks / memberTasks.length) * 100) : 0,
      isIdle,
      isOverloaded,
    };
  });

  const idleMemberCount = memberStats.filter(m => m.isIdle).length;

  const completionPct = metrics.totalTasks
    ? Math.round((metrics.completedTasks / metrics.totalTasks) * 100) : 0;
  const overduePct = metrics.totalTasks
    ? Math.round((metrics.overdueTasks   / metrics.totalTasks) * 100) : 0;

  return {
    generatedAt:             fmtDateTime(now.toISOString()),
    projectName:             projectDetails.name?.trim() || 'Unnamed Project',
    projectType:             isAgile ? 'Agile / Scrum' : 'Kanban',
    projectDescription:      projectDetails.description || '',
    isAgile,
    metrics,
    completionPct,
    overduePct,
    tasks:                   taskRows,
    overdueTasks,
    upcomingTasks,
    recentlyCompletedTasks,
    unassignedCount,
    priorityDist,
    statusDist,
    avgLeadTimeDays,
    sprintStats,
    activeSprint,
    avgVelocity,
    milestones,
    memberStats,
    idleMemberCount,
  };
}
