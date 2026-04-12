'use client';
export const dynamic = 'force-dynamic';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronDown, TrendingDown, BarChart2, CalendarDays } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from '@/components/ui';
import BurndownChart, { type BurndownPoint } from './components/BurndownChart';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Sprint {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED';
}

interface BurndownResponse {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalStoryPoints: number;
  dataPoints: BurndownPoint[];
}

// ─── Status badge helper ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<Sprint['status'], string> = {
  NOT_STARTED: 'bg-[#F2F4F7] text-[#344054]',
  ACTIVE:      'bg-[#ECFDF3] text-[#027A48]',
  COMPLETED:   'bg-[#EFF8FF] text-[#175CD3]',
};
const STATUS_LABEL: Record<Sprint['status'], string> = {
  NOT_STARTED: 'Not Started',
  ACTIVE:      'Active',
  COMPLETED:   'Completed',
};

const getSprintStatus = (sprint: Sprint): 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED' => {
  if (!sprint.startDate || !sprint.endDate) return 'NOT_STARTED';
  
  const start = new Date(sprint.startDate + 'T00:00:00');
  const end = new Date(sprint.endDate + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (start > now) return 'NOT_STARTED';
  if (end < now) return 'COMPLETED';
  return 'ACTIVE';
};

// ─── Component ────────────────────────────────────────────────────────────────

function BurndownContent() {
  const searchParams = useSearchParams();
  const projectId    = searchParams.get('projectId');

  // Sprints
  const [sprints, setSprints]           = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);
  const [sprintDropOpen, setSprintDropOpen]     = useState(false);

  // Date filter
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  // Burndown data
  const [burndown, setBurndown]           = useState<BurndownResponse | null>(null);
  const [loadingSprints, setLoadingSprints] = useState(true);
  const [loadingChart,  setLoadingChart]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const sprintStartDateRef = useRef<HTMLInputElement>(null);
  const sprintEndDateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSprintDropOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDate = (d: string | null | undefined) => {
    if (!d) return 'Set Date';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── 1. Fetch sprints on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setError('No project selected.');
      setLoadingSprints(false);
      return;
    }
    const fetchSprints = async () => {
      try {
        const res = await api.get<Sprint[]>(`/api/sprints/project/${projectId}`);
        const list = res.data;
        setSprints(list);
        if (list.length > 0) {
          // default to the first ACTIVE sprint, or the first one
          const active = list.find((s) => s.status === 'ACTIVE') ?? list[0];
          setSelectedSprintId(active.id);
          setFilterFrom(active.startDate || '');
          setFilterTo(active.endDate || '');
        }
      } catch {
        setError('Failed to load sprints.');
      } finally {
        setLoadingSprints(false);
      }
    };
    void fetchSprints();
  }, [projectId]);

  // ── 2. Fetch burndown data whenever sprint or filter changes ───────────────

  const fetchBurndown = useCallback(async () => {
    if (!selectedSprintId) return;
    const currentSprint = sprints.find((s) => s.id === selectedSprintId);
    if (!currentSprint?.startDate || !currentSprint?.endDate) {
      setBurndown(null);
      return;
    }
    setLoadingChart(true);
    setBurndown(null);
    try {
      const params = new URLSearchParams();
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo)   params.set('to',   filterTo);
      const res = await api.get<BurndownResponse>(
        `/api/burndown/sprint/${selectedSprintId}?${params.toString()}`
      );
      setBurndown(res.data);
      setError(null);
    } catch {
      setError('Failed to load burndown data.');
    } finally {
      setLoadingChart(false);
    }
  }, [selectedSprintId, filterFrom, filterTo, sprints]);

  useEffect(() => {
    void fetchBurndown();
  }, [fetchBurndown]);

  // ── Sprint selection ───────────────────────────────────────────────────────

  const handleSprintSelect = (sprint: Sprint) => {
    setSelectedSprintId(sprint.id);
    setFilterFrom(sprint.startDate || '');
    setFilterTo(sprint.endDate || '');
    setSprintDropOpen(false);
  };

  const selectedSprint = sprints.find((s) => s.id === selectedSprintId);

  const handleDateSaving = async (field: 'start' | 'end', val: string) => {
    if (!selectedSprint) return;
    const normalized = val ? String(val).slice(0, 10) : null;
    try {
      await api.put(`/api/sprints/${selectedSprint.id}`, {
        name: selectedSprint.name,
        startDate: field === 'start' ? normalized : (selectedSprint.startDate || null),
        endDate: field === 'end' ? normalized : (selectedSprint.endDate || null)
      });
      // updating local sprints cache
      setSprints((prev) => prev.map((s) => {
        if (s.id === selectedSprint.id) {
          return {
            ...s,
            startDate: field === 'start' ? normalized : s.startDate,
            endDate: field === 'end' ? normalized : s.endDate
          };
        }
        return s;
      }));
      // set filter matching the new dates
      if (field === 'start') setFilterFrom(normalized || '');
      if (field === 'end') setFilterTo(normalized || '');
    } catch {
      toast('Failed to save sprint date', 'error');
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────

  const donePoints = burndown
    ? burndown.totalStoryPoints -
      (burndown.dataPoints[burndown.dataPoints.length - 1]?.remainingPoints ?? 0)
    : 0;
  const progressPct = burndown && burndown.totalStoryPoints > 0
    ? Math.round((donePoints / burndown.totalStoryPoints) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#F4F5F7] p-4 sm:p-5 pb-6 font-[var(--font-inter)]">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#175CD3] shadow">
          <TrendingDown size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#101828] leading-tight">Burndown Chart</h1>
          <p className="text-[13px] text-[#667085]">Track story point progress across sprint days</p>
        </div>
      </div>

      {/* Loading sprints */}
      {loadingSprints && (
        <div className="flex h-48 items-center justify-center text-[#667085] text-sm">
          Loading sprints…
        </div>
      )}

      {/* Error */}
      {!loadingSprints && error && !burndown && (
        <div className="flex h-48 items-center justify-center rounded-xl bg-white text-[#F04438] text-sm font-medium shadow-sm border border-[#FECDCA]">
          {error}
        </div>
      )}

      {/* No sprints */}
      {!loadingSprints && !error && sprints.length === 0 && (
        <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-xl bg-white text-[#667085] shadow-sm border border-[#E4E7EC]">
          <BarChart2 size={32} className="text-[#D0D5DD]" />
          <p className="text-sm">No sprints found for this project.</p>
        </div>
      )}

      {/* Main content */}
      {!loadingSprints && sprints.length > 0 && (
        <div className="flex flex-col gap-5">

          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Sprint selector */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setSprintDropOpen((p) => !p)}
                className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-[14px] font-medium text-[#344054] shadow-sm hover:border-[#98A2B3] transition-colors"
              >
                <span>
                  {selectedSprint ? selectedSprint.name : 'Select Sprint'}
                </span>
                {selectedSprint && (
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[getSprintStatus(selectedSprint)]}`}>
                    {STATUS_LABEL[getSprintStatus(selectedSprint)]}
                  </span>
                )}
                <ChevronDown size={16} className="text-[#98A2B3]" />
              </button>

              {sprintDropOpen && (
                <div className="absolute left-0 top-11 z-50 min-w-[220px] rounded-xl border border-[#E4E7EC] bg-white shadow-xl overflow-hidden">
                  {sprints.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSprintSelect(s)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] hover:bg-[#F9FAFB] transition-colors ${s.id === selectedSprintId ? 'bg-[#EFF8FF] font-semibold text-[#175CD3]' : 'text-[#344054]'}`}
                    >
                      <span>{s.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[getSprintStatus(s)]}`}>
                        {STATUS_LABEL[getSprintStatus(s)]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3 py-2 shadow-sm">

              <input
                type="date"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
                className="border-none bg-transparent text-[13px] text-[#344054] outline-none"
              />
              <span className="text-[#98A2B3] text-[12px]">→</span>
              <input
                type="date"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
                className="border-none bg-transparent text-[13px] text-[#344054] outline-none"
              />
            </div>
          </div>

          {/* Stats cards */}
          {burndown && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Total Points',
                  value: burndown.totalStoryPoints,
                  sub: 'in sprint',
                  color: 'text-[#101828]',
                },
                {
                  label: 'Completed',
                  value: donePoints,
                  sub: 'story points',
                  color: 'text-[#027A48]',
                },
                {
                  label: 'Remaining',
                  value: burndown.dataPoints[burndown.dataPoints.length - 1]?.remainingPoints ?? 0,
                  sub: 'story points',
                  color: 'text-[#175CD3]',
                },
                {
                  label: 'Progress',
                  value: `${progressPct}%`,
                  sub: 'completed',
                  color: progressPct >= 80 ? 'text-[#027A48]' : progressPct >= 50 ? 'text-[#B54708]' : 'text-[#F04438]',
                },
              ].map((stat) => (
                <div key={stat.label} className="group rounded-xl border border-[#E4E7EC] bg-white px-4 py-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-[#D0D5DD]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3] transition-colors group-hover:text-[#667085]">{stat.label}</p>
                  <p className={`mt-1 text-[22px] font-bold leading-tight transition-transform duration-300 group-hover:scale-105 origin-left ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-[#667085] transition-opacity duration-300 group-hover:opacity-80">{stat.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Chart card */}
          <div className="rounded-xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
            {loadingChart ? (
              <div className="flex h-64 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 rounded-full border-[3px] border-[#175CD3] border-t-transparent animate-spin" />
                  <p className="text-[13px] text-[#667085]">Loading chart…</p>
                </div>
              </div>
            ) : burndown ? (
              <BurndownChart
                sprintName={burndown.sprintName}
                dataPoints={burndown.dataPoints}
                totalStoryPoints={burndown.totalStoryPoints}
              />
            ) : selectedSprint && (!selectedSprint.startDate || !selectedSprint.endDate) ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-[#667085]">
                <CalendarDays size={32} className="text-[#D0D5DD]" />
                <p className="text-sm">Start and end dates are required to view the burndown chart.</p>
                <div className="flex items-center gap-3 mt-2">
                  <div className="relative flex items-center gap-1">
                    <span className="text-[13px] font-medium text-[#344054]">Start:</span>
                    <button
                      type="button"
                      onClick={() => sprintStartDateRef.current?.showPicker()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:border-[#98A2B3] transition-colors shadow-sm"
                    >
                      <CalendarDays size={14} className="text-[#667085]" />
                      <span className={selectedSprint.startDate ? 'text-[#344054]' : 'text-[#98A2B3]'}>
                        {formatDate(selectedSprint.startDate)}
                      </span>
                    </button>
                    <input
                      ref={sprintStartDateRef}
                      type="date"
                      value={selectedSprint.startDate || ''}
                      onChange={(e) => handleDateSaving('start', e.target.value)}
                      className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    />
                  </div>
                  <span className="text-[#98A2B3]">-</span>
                  <div className="relative flex items-center gap-1">
                    <span className="text-[13px] font-medium text-[#344054]">End:</span>
                    <button
                      type="button"
                      onClick={() => sprintEndDateRef.current?.showPicker()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4E7EC] bg-white px-3 py-1.5 text-[13px] font-medium cursor-pointer hover:border-[#98A2B3] transition-colors shadow-sm"
                    >
                      <CalendarDays size={14} className="text-[#667085]" />
                      <span className={selectedSprint.endDate ? 'text-[#344054]' : 'text-[#98A2B3]'}>
                        {formatDate(selectedSprint.endDate)}
                      </span>
                    </button>
                    <input
                      ref={sprintEndDateRef}
                      type="date"
                      value={selectedSprint.endDate || ''}
                      onChange={(e) => handleDateSaving('end', e.target.value)}
                      className="absolute top-0 left-0 w-0 h-0 opacity-0 pointer-events-none"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-[#98A2B3] text-sm">
                Select a sprint to view the burndown chart.
              </div>
            )}
          </div>

          {/* Sprint date range note */}
          {selectedSprint && selectedSprint.startDate && selectedSprint.endDate && (
            <p className="text-center text-[12px] text-[#98A2B3] transition-all duration-300">
              Sprint&nbsp;<strong className="text-[#667085]">{selectedSprint.name}</strong>&nbsp;·&nbsp;
              {new Date(selectedSprint.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              &nbsp;–&nbsp;
              {new Date(selectedSprint.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Next.js 14+ requires useSearchParams to be inside a Suspense boundary
export default function BurndownPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-[#667085] text-sm">
          Loading…
        </div>
      }
    >
      <BurndownContent />
    </Suspense>
  );
}
