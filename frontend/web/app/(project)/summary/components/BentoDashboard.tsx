'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Task, Sprint, ProjectMetrics, PageItem, MilestoneResponse } from '@/types';
import api from '@/lib/axios';
import useSWR from 'swr';

// ── React-Grid-Layout (v2 legacy layer for v1-compatible API) ────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { WidthProvider, Responsive } = require('react-grid-layout/legacy') as typeof import('react-grid-layout/legacy');
import type { ResponsiveLayouts } from 'react-grid-layout/legacy';

// v2 uses Layout = readonly LayoutItem[], so we define our own mutable shape for authoring
interface WidgetLayout {
  i: string; x: number; y: number; w: number; h: number;
  minW?: number; minH?: number; maxW?: number; maxH?: number;
  static?: boolean;
}
type Layouts = ResponsiveLayouts<string>;

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';


// ── Widget Imports ─────────────────────────────────────────────────────────────
import { OverallProgressWidget, StatMetricWidget } from './MetricsGrid';
import {
  BurndownChartWidget,
  TaskDistributionWidget,
  VelocityChartWidget,
  LeadTimeChartWidget,
} from './DashboardCharts';
import { CurrentSprint } from './ProjectTimeline';
import { ProjectChatWidget } from './ProjectChatWidget';
import { ProjectNoteWidget } from './ProjectNoteWidget';
import { WorkloadDistribution } from './WorkloadDistribution';
import { GenerateReportCard } from './recent-activity/GenerateReportCard';
import { RecentlyCompletedTasksCard } from './recent-activity/RecentlyCompletedTasksCard';
import { RecentActivityFeedCard } from './recent-activity/RecentActivityFeedCard';
import { DueTasksFiveDaysCard } from './recent-activity/DueTasksFiveDaysCard';
import { UpcomingMilestonesCard } from './recent-activity/UpcomingMilestonesCard';
import { ProjectDocsCard } from './recent-activity/ProjectDocsCard';

// ────────────────────────────────────────────────────────────────────────────────
const ResponsiveGridLayout = WidthProvider(Responsive);

// ═══════════════════════════════════════════════════════════════════════════════
//  PERSISTENCE
// ═══════════════════════════════════════════════════════════════════════════════
const LAYOUT_VERSION = 'v26';

function storageKey(projectId: number) {
  return `summary-bento-layout:${projectId}:${LAYOUT_VERSION}`;
}

function isValidLayouts(data: unknown): data is Layouts {
  if (!data || typeof data !== 'object') return false;
  return Object.values(data as Record<string, unknown>).some(
    (v) => Array.isArray(v) && v.length >= 0,
  );
}

function loadSavedLayouts(projectId: number): Layouts | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isValidLayouts(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveLayouts(projectId: number, layouts: Layouts) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(layouts));
  } catch { /* quota full — silent fail */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ROW-GAP FILLER
//  When a widget is resized horizontally, auto-expand its row-companion
//  to fill the remaining columns (no empty gap between widgets).
// ═══════════════════════════════════════════════════════════════════════════════
function fillRowGaps(items: WidgetLayout[], totalCols: number): WidgetLayout[] {
  const result = items.map(it => ({ ...it }));

  // Group items that start at the same y-row
  const byRow = new Map<number, WidgetLayout[]>();
  for (const item of result) {
    if (!byRow.has(item.y)) byRow.set(item.y, []);
    byRow.get(item.y)!.push(item);
  }

  for (const group of byRow.values()) {
    if (group.length !== 2) continue; // only handle clean 2-widget rows
    const [a, b] = [...group].sort((x, y) => x.x - y.x); // left, right
    const gap = totalCols - (a.x + a.w + (totalCols - (b.x + b.w)));
    if (gap <= 0) continue;
    // Snap right widget flush to end of left widget, expand to fill remaining cols
    const rightItem = result.find(r => r.i === b.i)!;
    rightItem.x = a.x + a.w;
    rightItem.w = totalCols - rightItem.x;
  }

  return result;
}

function useBentoLayout(projectId: number, defaultLayouts: Layouts) {
  const [layouts, setLayouts] = useState<Layouts>(() => {
    const saved = loadSavedLayouts(projectId);
    return saved ?? defaultLayouts;
  });
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLayoutChange = useCallback(
    (_layout: unknown, allLayouts: Layouts) => {
      // Auto-fill horizontal gaps in the lg breakpoint after every resize/drag
      const adjusted: Layouts = { ...allLayouts };
      if (adjusted.lg) {
        adjusted.lg = fillRowGaps(adjusted.lg as WidgetLayout[], 24) as typeof adjusted.lg;
      }
      setLayouts(adjusted);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveLayouts(projectId, adjusted), 400);
    },
    [projectId],
  );

  const resetLayouts = useCallback(() => {
    localStorage.removeItem(storageKey(projectId));
    setLayouts(defaultLayouts);
  }, [projectId, defaultLayouts]);

  return { layouts, onLayoutChange, resetLayouts, isHydrated: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DEFAULT LAYOUTS
//  Columns: lg=20, md=12, sm=4
//  Row height: 80px  Gap: 16px
// ═══════════════════════════════════════════════════════════════════════════════

function buildDefaultLayouts(isAgile: boolean): Layouts {
  const lg: WidgetLayout[] = [
    /* ── Row 0 (y=0, h=2 metrics) ──────────────────── */
    { i: 'metric-progress', x: 0, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-total', x: 6, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-completed', x: 12, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-due', x: 18, y: 0, w: 6, h: 2, minW: 3, minH: 2 },

    /* ── Row 1 (y=2) ─────────────────────────────────────────────── */
    ...(isAgile ? [
      { i: 'report', x: 0, y: 2, w: 16, h: 1, minW: 6, minH: 1 },
      { i: 'sprint', x: 0, y: 3, w: 16, h: 3, minW: 8, minH: 3 },
      { i: 'activity-feed', x: 16, y: 2, w: 8, h: 4, minW: 4, minH: 3 },
    ] as WidgetLayout[] : []),

    ...(!isAgile ? [
      { i: 'report', x: 0, y: 2, w: 16, h: 1, minW: 6, minH: 1 },
      { i: 'task-dist', x: 0, y: 3, w: 16, h: 4, minW: 5, minH: 4 },
      { i: 'activity-feed', x: 16, y: 2, w: 8, h: 5, minW: 4, minH: 3 },
    ] as WidgetLayout[] : []),

    /* ── Row 2 Agile Charts (y=6) ────── */
    ...(isAgile ? [
      { i: 'burndown', x: 0, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'task-dist', x: 6, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'velocity', x: 12, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
      { i: 'lead-time', x: 18, y: 6, w: 6, h: 4, minW: 3, minH: 3 },
    ] as WidgetLayout[] : []),

    /* ── Row 3: 1:1:1 Ratio (w=8 each) ────── */
    { i: 'recently-completed', x: 0, y: isAgile ? 10 : 7, w: 8, h: 5, minW: 4, minH: 3 },
    { i: 'due-tasks', x: 8, y: isAgile ? 10 : 7, w: 8, h: 5, minW: 4, minH: 3 },
    { i: 'milestones', x: 16, y: isAgile ? 10 : 7, w: 8, h: 5, minW: 4, minH: 3 },

    /* ── Row 4: 1:1:2 Ratio (w=6, 6, 12) ────────────────── */
    { i: 'docs', x: 0, y: isAgile ? 15 : 12, w: 6, h: 5, minW: 3, minH: 3 },
    { i: 'notes', x: 6, y: isAgile ? 15 : 12, w: 6, h: 5, minW: 3, minH: 3 },
    { i: 'chat', x: 12, y: isAgile ? 15 : 12, w: 12, h: 5, minW: 6, minH: 4 },
  ];

  const md: WidgetLayout[] = [
    { i: 'metric-progress', x: 0, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-total', x: 6, y: 0, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-completed', x: 0, y: 2, w: 6, h: 2, minW: 3, minH: 2 },
    { i: 'metric-due', x: 6, y: 2, w: 6, h: 2, minW: 3, minH: 2 },

    { i: 'report', x: 0, y: 4, w: 12, h: 1, minW: 6, minH: 1 },

    ...(isAgile ? [
      { i: 'sprint', x: 0, y: 5, w: 12, h: 3, minW: 6, minH: 3 },
      { i: 'activity-feed', x: 0, y: 8, w: 12, h: 4, minW: 4, minH: 3 },
      { i: 'burndown', x: 0, y: 12, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'task-dist', x: 6, y: 12, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'velocity', x: 0, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
      { i: 'lead-time', x: 6, y: 16, w: 6, h: 4, minW: 4, minH: 3 },
    ] as WidgetLayout[] : []),

    ...(!isAgile ? [
      { i: 'task-dist', x: 0, y: 5, w: 12, h: 4, minW: 5, minH: 4 },
      { i: 'activity-feed', x: 0, y: 9, w: 12, h: 4, minW: 4, minH: 3 },
    ] as WidgetLayout[] : []),

    /* Row 3 (1:1:1) */
    { i: 'recently-completed', x: 0, y: isAgile ? 20 : 13, w: 4, h: 5, minW: 4, minH: 3 },
    { i: 'due-tasks', x: 4, y: isAgile ? 20 : 13, w: 4, h: 5, minW: 4, minH: 3 },
    { i: 'milestones', x: 8, y: isAgile ? 20 : 13, w: 4, h: 5, minW: 4, minH: 3 },

    /* Row 4 (1:1:2) */
    { i: 'docs', x: 0, y: isAgile ? 25 : 18, w: 3, h: 5, minW: 3, minH: 3 },
    { i: 'notes', x: 3, y: isAgile ? 25 : 18, w: 3, h: 5, minW: 3, minH: 3 },
    { i: 'chat', x: 6, y: isAgile ? 25 : 18, w: 6, h: 5, minW: 5, minH: 4 },
  ];

  // On sm, disable drag/resize by making everything a single column (static layout)
  const sm: WidgetLayout[] = [
    { i: 'metric-progress', x: 0, y: 0, w: 4, h: 2, static: true },
    { i: 'metric-total', x: 0, y: 2, w: 4, h: 2, static: true },
    { i: 'metric-completed', x: 0, y: 4, w: 4, h: 2, static: true },
    { i: 'metric-due', x: 0, y: 6, w: 4, h: 2, static: true },
    { i: 'report', x: 0, y: 8, w: 4, h: 1, static: true },
    
    ...(isAgile ? [
      { i: 'sprint', x: 0, y: 9, w: 4, h: 3, static: true },
      { i: 'activity-feed', x: 0, y: 12, w: 4, h: 4, static: true },
      { i: 'burndown', x: 0, y: 16, w: 4, h: 4, static: true },
      { i: 'task-dist', x: 0, y: 20, w: 4, h: 4, static: true },
      { i: 'velocity', x: 0, y: 24, w: 4, h: 4, static: true },
      { i: 'lead-time', x: 0, y: 28, w: 4, h: 4, static: true },
    ] as WidgetLayout[] : []),
    ...(!isAgile ? [
      { i: 'task-dist', x: 0, y: 9, w: 4, h: 4, static: true },
      { i: 'activity-feed', x: 0, y: 13, w: 4, h: 4, static: true },
    ] as WidgetLayout[] : []),

    { i: 'notes', x: 0, y: isAgile ? 32 : 17, w: 4, h: 5, static: true },
    { i: 'recently-completed', x: 0, y: isAgile ? 37 : 22, w: 4, h: 5, static: true },
    { i: 'due-tasks', x: 0, y: isAgile ? 42 : 27, w: 4, h: 4, static: true },
    { i: 'milestones', x: 0, y: isAgile ? 46 : 31, w: 4, h: 4, static: true },
    { i: 'docs', x: 0, y: isAgile ? 50 : 35, w: 4, h: 4, static: true },
    { i: 'chat', x: 0, y: isAgile ? 54 : 39, w: 4, h: 5, static: true },
  ];

  return { lg, md, sm } as Layouts;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BENTO CARD SHELL
// ═══════════════════════════════════════════════════════════════════════════════
interface BentoCardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  noPadding?: boolean;
  headerAction?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

function BentoCard({
  title,
  icon,
  children,
  noPadding = false,
  headerAction,
  className = '',
  bodyClassName = '',
}: BentoCardProps) {
  return (
    <div
      className={`h-full w-full flex flex-col bg-white rounded-xl border border-[#E3E8EF] shadow-sm ring-1 ring-black/[0.03] overflow-hidden transition-shadow duration-200 hover:shadow-md group ${className}`}
    >
      {/* ── Drag Handle Header ── */}
      <div className="bento-drag-handle flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60 shrink-0 cursor-grab active:cursor-grabbing select-none">
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          <h3 className="font-arimo text-[14px] font-semibold text-[#101828] truncate">{title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerAction && (
            <div className="bento-no-drag" onClick={(e) => e.stopPropagation()}>
              {headerAction}
            </div>
          )}
          {/* Drag grip indicator */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C4C9D4"
            strokeWidth="2"
            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <path d="M9 3h2v2H9zM13 3h2v2h-2zM9 7h2v2H9zM13 7h2v2h-2zM9 11h2v2H9zM13 11h2v2h-2z" />
          </svg>
        </div>
      </div>

      {/* ── Card Body ── */}
      <div
        className={`bento-no-drag flex-1 min-h-0 ${noPadding ? '' : 'p-4'} overflow-auto custom-scrollbar ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  ICONS (small inline SVGs to keep it self-contained)
// ═══════════════════════════════════════════════════════════════════════════════
const Icons = {
  progress: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  tasks: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  completed: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" />
    </svg>
  ),
  due: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DE350B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  sprint: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  burndown: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF8B00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  chart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6554C0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  ),
  velocity: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  clock: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  activity: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  report: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2684FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  trophy: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-2" /><rect x="6" y="18" width="12" height="4" rx="2" />
    </svg>
  ),
  milestone: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FF8B00" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  ),
  docs: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2684FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  chat: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  notes: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z" /><path d="M14 3v5h5M16 13H8M16 17H8M10 9H8" />
    </svg>
  ),
  team: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6554C0" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
};

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function BentoDashboard({
  projectId,
  tasks,
  sprints,
  metrics,
  projectDetails,
  isAgile,
}: {
  projectId: number;
  tasks: Task[];
  sprints: Sprint[];
  metrics: ProjectMetrics;
  projectDetails: { description?: string } | null;
  isAgile: boolean;
}) {
  const fetcher = (url: string) => api.get(url).then((r) => r.data);

  const { data: pages = [], isLoading: pagesLoading } = useSWR<PageItem[]>(
    projectId ? `/api/projects/${projectId}/pages` : null, fetcher,
  );
  const { data: milestones = [], isLoading: milestonesLoading } = useSWR<MilestoneResponse[]>(
    projectId ? `/api/projects/${projectId}/milestones` : null, fetcher,
  );

  // Build default layouts (memoised — stable across renders)
  const defaultLayouts = React.useMemo(() => buildDefaultLayouts(isAgile), [isAgile]);

  const { layouts, onLayoutChange, resetLayouts, isHydrated } = useBentoLayout(
    projectId,
    defaultLayouts,
  );

  // All widget IDs that exist in this project type
  const activeIds = React.useMemo(() => {
    const base = [
      'metric-progress', 'metric-total', 'metric-completed', 'metric-due',
      'task-dist', 'activity-feed', 'report', 'recently-completed',
      'due-tasks', 'milestones', 'docs', 'chat', 'notes',
    ];
    if (isAgile) {
      base.push('sprint', 'burndown', 'velocity', 'lead-time');
    }
    return new Set(base);
  }, [isAgile]);

  // Filter all breakpoint layouts to remove irrelevant widget ids
  const filteredLayouts = React.useMemo<Layouts>(() => {
    const filtered: Record<string, WidgetLayout[]> = {};
    for (const [bp, items] of Object.entries(layouts ?? {})) {
      filtered[bp] = ((items ?? []) as WidgetLayout[]).filter((item) => activeIds.has(item.i));
    }
    return filtered as Layouts;
  }, [layouts, activeIds]);

  // Don't flash default layout before hydration — avoid SSR mismatch
  if (!isHydrated) return null;

  return (
    <div className="w-full pt-4">
      {/* ── Grid ── */}
      <ResponsiveGridLayout
        className="bento-grid"
        layouts={filteredLayouts}
        breakpoints={{ lg: 1200, md: 768, sm: 0 }}
        cols={{ lg: 24, md: 12, sm: 4 }}
        rowHeight={64}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        draggableHandle=".bento-drag-handle"
        draggableCancel=".bento-no-drag"
        onLayoutChange={onLayoutChange}
        compactType="vertical"
        preventCollision={false}
        isBounded={false}
        useCSSTransforms
        resizeHandles={['se']}
      >
        {/* ── Metric: Overall Progress ── */}
        <div key="metric-progress">
          <BentoCard title="Overall Progress" icon={Icons.progress}>
            <OverallProgressWidget
              completedTasks={metrics?.completedTasks || 0}
              totalTasks={metrics?.totalTasks || 0}
            />
          </BentoCard>
        </div>

        {/* ── Metric: Total Tasks ── */}
        <div key="metric-total">
          <BentoCard title="Total Tasks" icon={Icons.tasks}>
            <StatMetricWidget
              iconBg="bg-[#EAF2FF]"
              iconColor="#0052CC"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>}
              value={metrics?.totalTasks || 0}
              label="Total Tasks"
            />
          </BentoCard>
        </div>

        {/* ── Metric: Completed Tasks ── */}
        <div key="metric-completed">
          <BentoCard title="Completed Tasks" icon={Icons.completed}>
            <StatMetricWidget
              iconBg="bg-[#E3FCEF]"
              iconColor="#00875A"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00875A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="M22 4L12 14.01l-3-3" /></svg>}
              value={metrics?.completedTasks || 0}
              label="Completed Tasks"
            />
          </BentoCard>
        </div>

        {/* ── Metric: Due Issues ── */}
        <div key="metric-due">
          <BentoCard title="Due Issues" icon={Icons.due}>
            <StatMetricWidget
              iconBg="bg-[#FFF4ED]"
              iconColor="#DE350B"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DE350B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>}
              value={metrics?.overdueTasks || 0}
              label="Due Issues"
            />
          </BentoCard>
        </div>

        {/* ── Sprint (agile only) ── */}
        {isAgile && (
          <div key="sprint">
            <BentoCard title="Current Sprint" icon={Icons.sprint} noPadding bodyClassName="p-4 overflow-auto custom-scrollbar flex flex-col">
              <CurrentSprint projectId={projectId} sprints={sprints} tasks={tasks} />
            </BentoCard>
          </div>
        )}

        {/* ── Burndown Chart (agile only) ── */}
        {isAgile && (
          <div key="burndown">
            <BentoCard title="Sprint Burndown" icon={Icons.burndown} noPadding bodyClassName="p-4 flex flex-col">
              <BurndownChartWidget tasks={tasks} sprints={sprints} />
            </BentoCard>
          </div>
        )}

        {/* ── Task Priority Distribution ── */}
        <div key="task-dist">
          <BentoCard title="Task Priority" icon={Icons.chart} noPadding bodyClassName="p-4 flex flex-col">
            <TaskDistributionWidget tasks={tasks} />
          </BentoCard>
        </div>

        {/* ── Velocity Chart (agile only) ── */}
        {isAgile && (
          <div key="velocity">
            <BentoCard title="Velocity" icon={Icons.velocity} noPadding bodyClassName="p-4 flex flex-col">
              <VelocityChartWidget tasks={tasks} sprints={sprints} />
            </BentoCard>
          </div>
        )}

        {/* ── Lead Time Chart (agile only) ── */}
        {isAgile && (
          <div key="lead-time">
            <BentoCard title="Lead Time" icon={Icons.clock} noPadding bodyClassName="p-4 flex flex-col">
              <LeadTimeChartWidget tasks={tasks} />
            </BentoCard>
          </div>
        )}

        {/* ── Recent Activity Feed ── */}
        <div key="activity-feed">
          <BentoCard title="Recent Activity" icon={Icons.activity} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <RecentActivityFeedCard tasks={tasks} />
          </BentoCard>
        </div>

        {/* ── Generate Report (links to Report tab) ── */}
        <div key="report" className="bento-drag-handle h-full w-full cursor-grab active:cursor-grabbing rounded-xl overflow-hidden shadow-sm ring-1 ring-black/[0.03] border border-[#E3E8EF] group">
          <GenerateReportCard
            projectId={projectId}
            isAgile={isAgile}
          />
        </div>

        {/* ── Recently Completed Tasks ── */}
        <div key="recently-completed">
          <BentoCard title="Recently Completed" icon={Icons.trophy} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <RecentlyCompletedTasksCard tasks={tasks} />
          </BentoCard>
        </div>

        {/* ── Due Tasks (Next 5 Days) ── */}
        <div key="due-tasks">
          <BentoCard title="Due in 5 Days" icon={Icons.clock} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <DueTasksFiveDaysCard tasks={tasks} />
          </BentoCard>
        </div>

        {/* ── Upcoming Milestones ── */}
        <div key="milestones">
          <BentoCard title="Upcoming Milestones" icon={Icons.milestone} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <UpcomingMilestonesCard
              projectId={projectId}
              milestones={milestones}
              milestonesLoading={milestonesLoading}
            />
          </BentoCard>
        </div>

        {/* ── Project Docs ── */}
        <div key="docs">
          <BentoCard title="Project Docs" icon={Icons.docs} noPadding bodyClassName="p-4 overflow-y-auto custom-scrollbar">
            <ProjectDocsCard
              projectId={projectId}
              pages={pages}
              pagesLoading={pagesLoading}
            />
          </BentoCard>
        </div>

        {/* ── Project Chat ── */}
        <div key="chat">
          <BentoCard title="Project Chat" icon={Icons.chat} noPadding>
            <ProjectChatWidget projectId={projectId} />
          </BentoCard>
        </div>

        {/* ── Project Notes ── */}
        <div key="notes">
          <BentoCard title="Project Notes" icon={Icons.notes} noPadding>
            <ProjectNoteWidget projectId={projectId} defaultNote={projectDetails?.description} />
          </BentoCard>
        </div>

      </ResponsiveGridLayout>

      {/* ── Team Workload (standalone, outside the grid) ── */}
      <div className="mt-6">
        <WorkloadDistribution projectId={projectId} tasks={tasks} />
      </div>

      {/* ── Fixed Reset Layout Button ── */}
      <button
        onClick={resetLayouts}
        title="Reset layout to default"
        className="hidden md:flex fixed bottom-6 right-6 z-50 h-[44px] px-5 flex-row items-center justify-center gap-2 bg-[#101828] shadow-lg ring-1 ring-black/[0.1] border border-transparent rounded-full font-semibold text-[13px] text-white hover:bg-[#1D2939] hover:-translate-y-0.5 transition-all cursor-pointer hover:shadow-xl"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
        </svg>
        <span className="whitespace-nowrap">Reset Layout</span>
      </button>
    </div>
  );
}
