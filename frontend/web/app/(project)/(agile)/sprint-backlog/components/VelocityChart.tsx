'use client';

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Gauge,
  RefreshCw,
  Table2,
  Trophy,
  X,
} from 'lucide-react';
import { SafeChartFrame } from '@/components/shared/SafeChartFrame';
import type { SprintVelocityPoint } from '@/services/tasks-contract';
import type { SprintVelocityStatus } from '../hooks/useSprintVelocity';
import {
  calculateVelocityMetrics,
} from './velocity-model';

export type { SprintVelocityPoint } from '@/services/tasks-contract';

interface VelocityChartProps {
  sprints: SprintVelocityPoint[];
  status?: SprintVelocityStatus;
  error?: string | null;
  onRetry?: () => void;
  onClose?: () => void;
}

type ChartDatum = SprintVelocityPoint & {
  axisName: string;
  committed: number | null;
  delivered: number;
};

export const VELOCITY_CHART_LAYOUT = {
  barGap: 2,
  barCategoryGap: '28%',
  maxBarSize: 30,
} as const;

const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

const formatPoints = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

const formatDateRange = (sprint: SprintVelocityPoint) => {
  if (!sprint.startDate && !sprint.endDate) return 'Dates unavailable';
  const start = sprint.startDate ? dateFormatter.format(new Date(`${sprint.startDate}T00:00:00`)) : 'Unknown';
  const end = sprint.endDate ? dateFormatter.format(new Date(`${sprint.endDate}T00:00:00`)) : 'Unknown';
  return `${start} – ${end}`;
};

function VelocityTooltip({ active, payload }: TooltipContentProps) {
  if (!active || !payload.length) return null;
  const sprint = payload[0]?.payload as ChartDatum | undefined;
  if (!sprint) return null;

  const deliveryRate = sprint.commitmentCaptured && sprint.committedPoints > 0
    ? Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
    : null;
  const difference = sprint.completedPoints - sprint.committedPoints;

  return (
    <div className="min-w-[220px] rounded-xl border border-cu-border bg-cu-bg p-3 text-[12px] shadow-cu-xl">
      <p className="font-bold text-cu-text-primary">{sprint.sprintName}</p>
      <p className="mt-0.5 text-[10px] text-cu-text-muted">{formatDateRange(sprint)}</p>
      <div className="mt-3 space-y-1.5">
        {sprint.commitmentCaptured ? (
          <div className="flex justify-between gap-5 text-cu-text-secondary">
            <span>Committed</span><strong className="text-cu-text-primary">{sprint.committedPoints} pts</strong>
          </div>
        ) : null}
        <div className="flex justify-between gap-5 text-cu-text-secondary">
          <span>Delivered</span><strong className="text-cu-success">{sprint.completedPoints} pts</strong>
        </div>
        {deliveryRate !== null ? (
          <>
            <div className="flex justify-between gap-5 text-cu-text-secondary">
              <span>Predictability</span><strong className="text-cu-text-primary">{deliveryRate}%</strong>
            </div>
            <div className="flex justify-between gap-5 text-cu-text-secondary">
              <span>Difference</span>
              <strong className={difference >= 0 ? 'text-cu-success' : 'text-cu-warning'}>
                {difference > 0 ? '+' : ''}{difference} pts
              </strong>
            </div>
          </>
        ) : (
          <p className="rounded-lg bg-cu-warning-light px-2 py-1.5 text-[10px] text-cu-warning">
            Commitment baseline was not captured for this historical sprint.
          </p>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5" aria-label="Loading sprint velocity">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-cu-border lg:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-20 animate-pulse bg-cu-bg-secondary motion-reduce:animate-none" />)}
      </div>
      <div className="h-[300px] animate-pulse rounded-xl bg-cu-bg-secondary motion-reduce:animate-none" />
    </div>
  );
}

export default function VelocityChart({
  sprints,
  status = 'success',
  error,
  onRetry,
  onClose,
}: VelocityChartProps) {
  const [showTable, setShowTable] = useState(false);

  const displayedSprints = sprints;
  const metrics = useMemo(() => calculateVelocityMetrics(displayedSprints), [displayedSprints]);
  const hasLegacyData = displayedSprints.some((sprint) => !sprint.commitmentCaptured);
  const chartData = useMemo<ChartDatum[]>(() => displayedSprints.map((sprint) => ({
    ...sprint,
    axisName: sprint.sprintName.length > 12 ? `${sprint.sprintName.slice(0, 11)}…` : sprint.sprintName,
    committed: sprint.commitmentCaptured ? sprint.committedPoints : null,
    delivered: sprint.completedPoints,
  })), [displayedSprints]);
  const chartMinWidth = Math.max(640, chartData.length * 92);

  return (
    <section
      id="sprint-velocity-panel"
      aria-labelledby="sprint-velocity-title"
      className="overflow-hidden rounded-2xl border border-cu-border bg-cu-bg shadow-cu-sm"
    >
      <header className="flex flex-col gap-3 border-b border-cu-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cu-primary-light text-cu-primary">
            <BarChart3 size={19} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="sprint-velocity-title" className="text-[16px] font-bold text-cu-text-primary">Sprint velocity</h2>
            <p className="mt-0.5 text-[12px] text-cu-text-secondary">Committed versus delivered story points across completed sprints.</p>
          </div>
        </div>
        {onClose ? (
          <div className="flex items-center justify-end">
            <button type="button" onClick={onClose} aria-label="Hide sprint velocity" className="flex h-9 w-9 items-center justify-center rounded-lg text-cu-text-muted transition-colors hover:bg-cu-hover hover:text-cu-text-primary">
              <X size={17} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      <div className="p-4 sm:p-5">
        {status === 'loading' || status === 'idle' ? <LoadingState /> : null}

        {status === 'error' ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-cu-border bg-cu-bg-secondary px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cu-danger-light text-cu-danger"><AlertCircle size={22} /></div>
            <h3 className="mt-4 text-[15px] font-bold text-cu-text-primary">Velocity couldn’t be loaded</h3>
            <p className="mt-1 max-w-sm text-[12px] text-cu-text-secondary">{error || 'Check your connection and try again.'}</p>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-cu-primary px-4 text-[12px] font-bold text-white shadow-cu-sm hover:bg-cu-primary-hover">
                <RefreshCw size={14} /> Retry
              </button>
            ) : null}
          </div>
        ) : null}

        {status === 'success' && chartData.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-cu-border bg-cu-bg-secondary px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cu-primary-light text-cu-primary"><BarChart3 size={22} /></div>
            <h3 className="mt-4 text-[15px] font-bold text-cu-text-primary">Complete a sprint to unlock velocity</h3>
            <p className="mt-1 max-w-md text-[12px] leading-5 text-cu-text-secondary">Velocity starts building after your first completed sprint. Add story points before starting a sprint for a useful commitment comparison.</p>
          </div>
        ) : null}

        {status === 'success' && metrics ? (
          <>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-cu-border bg-cu-border lg:grid-cols-4">
              <div className="bg-cu-bg-secondary px-4 py-3">
                <div className="flex items-center gap-1.5 text-cu-text-secondary"><BarChart3 size={13} /><span className="text-[10px] font-bold uppercase tracking-wide">Avg delivered</span></div>
                <p className="mt-1 text-[20px] font-black text-cu-text-primary">{formatPoints(metrics.averageDelivered)} <span className="text-[11px] font-semibold text-cu-text-muted">pts</span></p>
              </div>
              <div className="bg-cu-bg-secondary px-4 py-3">
                <div className="flex items-center gap-1.5 text-cu-text-secondary"><Gauge size={13} /><span className="text-[10px] font-bold uppercase tracking-wide">Predictability</span></div>
                <p className="mt-1 text-[20px] font-black text-cu-text-primary">{metrics.predictability === null ? '—' : `${metrics.predictability}%`}</p>
              </div>
              <div className="bg-cu-bg-secondary px-4 py-3">
                <div className="flex items-center gap-1.5 text-cu-text-secondary"><ArrowUpRight size={13} /><span className="truncate text-[10px] font-bold uppercase tracking-wide">Latest · {metrics.latest.sprintName}</span></div>
                <div className="mt-1 flex items-baseline gap-2">
                  <p className="text-[20px] font-black text-cu-text-primary">{metrics.latest.completedPoints} <span className="text-[11px] font-semibold text-cu-text-muted">pts</span></p>
                  {metrics.latestDelta !== null ? (
                    <span className={`inline-flex items-center text-[10px] font-bold ${metrics.latestDelta >= 0 ? 'text-cu-success' : 'text-cu-warning'}`}>
                      {metrics.latestDelta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                      {Math.abs(metrics.latestDelta)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="bg-cu-bg-secondary px-4 py-3">
                <div className="flex items-center gap-1.5 text-cu-text-secondary"><Trophy size={13} /><span className="truncate text-[10px] font-bold uppercase tracking-wide">Best · {metrics.best.sprintName}</span></div>
                <p className="mt-1 text-[20px] font-black text-cu-success">{metrics.best.completedPoints} <span className="text-[11px] font-semibold text-cu-text-muted">pts</span></p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto pb-2 custom-scrollbar">
              <div
                style={{ minWidth: chartMinWidth }}
                role="img"
                aria-label={`Sprint velocity chart for ${displayedSprints.length} completed sprint${displayedSprints.length === 1 ? '' : 's'}`}
              >
                <div className="h-[300px]">
                  <SafeChartFrame minHeight="300px">
                    {({ width, height }) => (
                      <BarChart
                        width={width}
                        height={height}
                        data={chartData}
                        margin={{ top: 18, right: 18, bottom: 8, left: -12 }}
                        barGap={VELOCITY_CHART_LAYOUT.barGap}
                        barCategoryGap={VELOCITY_CHART_LAYOUT.barCategoryGap}
                        accessibilityLayer
                      >
                        <CartesianGrid vertical={false} stroke="var(--cu-border)" strokeDasharray="3 4" />
                        <XAxis dataKey="axisName" tick={{ fontSize: 10, fill: 'var(--cu-text-secondary)' }} tickLine={false} axisLine={false} interval={0} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--cu-text-muted)' }} tickLine={false} axisLine={false} width={42} />
                        <Tooltip content={VelocityTooltip} cursor={{ fill: 'var(--cu-hover)' }} />
                        <ReferenceLine y={metrics.averageDelivered} stroke="var(--cu-text-tertiary)" strokeDasharray="5 4" label={{ value: `Avg ${formatPoints(metrics.averageDelivered)}`, position: 'insideTopRight', fill: 'var(--cu-text-muted)', fontSize: 10 }} />
                        <Bar dataKey="committed" name="Committed" fill="var(--cu-primary-muted)" radius={[5, 5, 0, 0]} maxBarSize={VELOCITY_CHART_LAYOUT.maxBarSize} />
                        <Bar dataKey="delivered" name="Delivered" fill="var(--cu-success)" radius={[5, 5, 0, 0]} maxBarSize={VELOCITY_CHART_LAYOUT.maxBarSize} />
                      </BarChart>
                    )}
                  </SafeChartFrame>
                </div>
              </div>
            </div>

            <footer className="mt-3 flex flex-col gap-3 border-t border-cu-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-cu-text-secondary">
                <span>{displayedSprints.length} completed sprint{displayedSprints.length === 1 ? '' : 's'}</span>
                <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-cu-primary-muted" />Committed (plan)</span>
                <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="h-2.5 w-2.5 rounded-sm bg-cu-success" />Delivered (actual)</span>
                <span className="inline-flex items-center gap-1.5"><i aria-hidden="true" className="w-4 border-t border-dashed border-cu-text-tertiary" />Average</span>
              </div>
              <button type="button" onClick={() => setShowTable((current) => !current)} aria-expanded={showTable} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-cu-border px-3 text-[11px] font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary">
                <Table2 size={14} /> {showTable ? 'Hide data table' : 'View data table'}
              </button>
            </footer>

            {hasLegacyData ? (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-cu-warning-light px-3 py-2 text-[11px] leading-5 text-cu-warning">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                Historical sprints without a captured commitment show delivered velocity only. New sprint commitments are snapshotted when the sprint starts.
              </p>
            ) : null}

            <div className={showTable ? 'mt-4 overflow-x-auto rounded-xl border border-cu-border' : 'sr-only'}>
              <table className="w-full min-w-[620px] border-collapse text-left text-[12px]">
                <caption className="sr-only">Sprint velocity data</caption>
                <thead className="bg-cu-bg-secondary text-cu-text-secondary">
                  <tr><th className="px-3 py-2.5 font-bold">Sprint</th><th className="px-3 py-2.5 font-bold">Dates</th><th className="px-3 py-2.5 text-right font-bold">Committed</th><th className="px-3 py-2.5 text-right font-bold">Delivered</th><th className="px-3 py-2.5 text-right font-bold">Predictability</th></tr>
                </thead>
                <tbody>
                  {displayedSprints.map((sprint) => {
                    const predictability = sprint.commitmentCaptured && sprint.committedPoints > 0
                      ? Math.round((sprint.completedPoints / sprint.committedPoints) * 100)
                      : null;
                    return (
                      <tr key={sprint.sprintId} className="border-t border-cu-border text-cu-text-primary">
                        <td className="px-3 py-2.5 font-semibold">{sprint.sprintName}</td>
                        <td className="px-3 py-2.5 text-cu-text-secondary">{formatDateRange(sprint)}</td>
                        <td className="px-3 py-2.5 text-right">{sprint.commitmentCaptured ? `${sprint.committedPoints} pts` : 'Unavailable'}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-cu-success">{sprint.completedPoints} pts</td>
                        <td className="px-3 py-2.5 text-right">{predictability === null ? '—' : `${predictability}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
