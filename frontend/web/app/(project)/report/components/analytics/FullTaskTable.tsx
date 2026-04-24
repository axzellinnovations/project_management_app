'use client';
// ══════════════════════════════════════════════════════════════════════════════
//  FullTaskTable.tsx  ·  Searchable + filterable full task list
// ══════════════════════════════════════════════════════════════════════════════
import React, { useMemo, useState } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { TaskSummary } from '@/lib/report/reportUtils';
import { STATUS_COLORS, PRIORITY_COLORS } from '@/lib/report/reportUtils';

const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress', IN_REVIEW: 'In Review', DONE: 'Done',
};
const STATUS_BG: Record<string, string> = {
  TODO: '#F3F4F6', IN_PROGRESS: '#EFF6FF', IN_REVIEW: '#FFFBEB', DONE: '#F0FDF4',
};
const PRIORITY_BG: Record<string, string> = {
  URGENT: '#FEF2F2', HIGH: '#FFF7ED', MEDIUM: '#FEFCE8',
  NORMAL: '#EFF6FF', LOW: '#F0FDF4', UNASSIGNED: '#F9FAFB',
};

function StatusBadge({ sk }: { sk: string }) {
  const key = sk.toUpperCase();
  return (
    <span
      className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
      style={{ background: STATUS_BG[key] ?? '#F9FAFB', color: STATUS_COLORS[key] ?? '#6B7280' }}
    >
      {STATUS_LABELS[key] ?? sk}
    </span>
  );
}

function PriorityBadge({ pk }: { pk: string }) {
  const key = pk.toUpperCase();
  return (
    <span
      className="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap"
      style={{ background: PRIORITY_BG[key] ?? '#F9FAFB', color: PRIORITY_COLORS[key] ?? '#6B7280' }}
    >
      {pk}
    </span>
  );
}

export interface TaskTableFilters {
  status:   string;
  priority: string;
  assignee: string;
  sprint:   string;
}

interface Props {
  tasks:          TaskSummary[];
  externalFilters: TaskTableFilters;
  onExternalChange: (f: Partial<TaskTableFilters>) => void;
  allAssignees: string[];
  allSprints:   string[];
}

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'daysUntilDue';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;
const PRIORITY_WEIGHT: Record<string, number> = {
  URGENT: 0, HIGH: 1, MEDIUM: 2, NORMAL: 3, LOW: 4, UNASSIGNED: 5,
};

export default function FullTaskTable({
  tasks, externalFilters, onExternalChange, allAssignees, allSprints,
}: Props) {
  const [search,  setSearch]  = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('daysUntilDue');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page,    setPage]    = useState(0);

  const filtered = useMemo(() => {
    let result = tasks;

    // text search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.sprint.toLowerCase().includes(q),
      );
    }

    // external filters (from charts)
    if (externalFilters.status)
      result = result.filter(t => t.statusKey   === externalFilters.status);
    if (externalFilters.priority)
      result = result.filter(t => t.priorityKey === externalFilters.priority);
    if (externalFilters.assignee)
      result = result.filter(t => t.assignee    === externalFilters.assignee);
    if (externalFilters.sprint)
      result = result.filter(t => t.sprint      === externalFilters.sprint);

    // sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'title':      cmp = a.title.localeCompare(b.title); break;
        case 'status':     cmp = a.statusKey.localeCompare(b.statusKey); break;
        case 'priority':   cmp = (PRIORITY_WEIGHT[a.priorityKey] ?? 5) - (PRIORITY_WEIGHT[b.priorityKey] ?? 5); break;
        case 'assignee':   cmp = a.assignee.localeCompare(b.assignee); break;
        case 'dueDate':
        case 'daysUntilDue':
          // Put tasks without due dates at the end
          if (!a.rawDueDate && !b.rawDueDate) cmp = 0;
          else if (!a.rawDueDate) cmp = 1;
          else if (!b.rawDueDate) cmp = -1;
          else cmp = a.daysUntilDue - b.daysUntilDue;
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, search, externalFilters, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(0);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ChevronUp size={10} className="text-[#D1D5DB]" />;
    return sortDir === 'asc'
      ? <ChevronUp size={10} className="text-[#155DFC]" />
      : <ChevronDown size={10} className="text-[#155DFC]" />;
  }

  const hasFilters = search || externalFilters.status || externalFilters.priority
    || externalFilters.assignee || externalFilters.sprint;

  function clearAll() {
    setSearch('');
    onExternalChange({ status: '', priority: '', assignee: '', sprint: '' });
    setPage(0);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background:     'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border:         '1px solid rgba(255,255,255,0.65)',
        boxShadow:      '0 4px 24px rgba(0,0,0,0.06)',
      }}
    >
      {/* Header + controls */}
      <div className="px-5 pt-5 pb-3 border-b border-[#F3F4F6]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-widest">
              All Tasks
            </p>
            <p className="text-[10px] text-[#B0B8C4]">
              Showing {filtered.length} of {tasks.length} tasks
            </p>
          </div>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[10px] font-semibold text-[#DC2626] hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
            >
              <X size={11} /> Clear all filters
            </button>
          )}
        </div>

        {/* Search + filter row */}
        <div className="flex flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search tasks, assignee, sprint…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="w-full pl-8 pr-3 h-8 rounded-xl border border-[#E5E7EB] text-[11px] text-[#374151] outline-none focus:border-[#155DFC] focus:ring-2 focus:ring-[#155DFC]/10 transition-all"
              style={{ background: '#FAFAFA' }}
            />
          </div>

          {/* Status filter */}
          <select
            value={externalFilters.status}
            onChange={e => { onExternalChange({ status: e.target.value }); setPage(0); }}
            className="h-8 px-3 rounded-xl border border-[#E5E7EB] text-[11px] text-[#374151] outline-none focus:border-[#155DFC] cursor-pointer"
            style={{ background: '#FAFAFA' }}
          >
            <option value="">All Status</option>
            {['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={externalFilters.priority}
            onChange={e => { onExternalChange({ priority: e.target.value }); setPage(0); }}
            className="h-8 px-3 rounded-xl border border-[#E5E7EB] text-[11px] text-[#374151] outline-none focus:border-[#155DFC] cursor-pointer"
            style={{ background: '#FAFAFA' }}
          >
            <option value="">All Priority</option>
            {['URGENT', 'HIGH', 'MEDIUM', 'NORMAL', 'LOW'].map(p => (
              <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>
            ))}
          </select>

          {/* Assignee filter */}
          {allAssignees.length > 0 && (
            <select
              value={externalFilters.assignee}
              onChange={e => { onExternalChange({ assignee: e.target.value }); setPage(0); }}
              className="h-8 px-3 rounded-xl border border-[#E5E7EB] text-[11px] text-[#374151] outline-none focus:border-[#155DFC] cursor-pointer"
              style={{ background: '#FAFAFA' }}
            >
              <option value="">All Members</option>
              {allAssignees.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          )}

          {/* Sprint filter */}
          {allSprints.length > 0 && (
            <select
              value={externalFilters.sprint}
              onChange={e => { onExternalChange({ sprint: e.target.value }); setPage(0); }}
              className="h-8 px-3 rounded-xl border border-[#E5E7EB] text-[11px] text-[#374151] outline-none focus:border-[#155DFC] cursor-pointer"
              style={{ background: '#FAFAFA' }}
            >
              <option value="">All Sprints</option>
              {allSprints.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {pageItems.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[13px] font-semibold text-[#9CA3AF]">No tasks match your filters</p>
            <button onClick={clearAll} className="mt-2 text-[11px] text-[#155DFC] hover:underline">
              Clear all filters
            </button>
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: '#F8FAFF', borderBottom: '1px solid #EEF2FF' }}>
                <th className="px-4 py-3 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px] w-8">#</th>
                {([ ['title', 'Title'], ['status', 'Status'], ['priority', 'Priority'],
                    ['assignee', 'Assignee'], ['dueDate', 'Due Date'] ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="px-4 py-3 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px] cursor-pointer hover:text-[#155DFC] transition-colors select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <div className="flex items-center gap-1">
                      {label}
                      <SortIcon k={key} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left font-bold text-[#9CA3AF] uppercase tracking-wider text-[9px]">Sprint</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((t, i) => {
                const rowBg = t.isOverdue ? '#FFF5F5'
                  : t.isUpcoming && t.daysUntilDue <= 2 ? '#FFFBEB'
                  : i % 2 === 0 ? '#FFFFFF' : '#FAFBFF';
                return (
                  <tr key={t.id} className="border-b border-[#F3F4F6] hover:bg-[#EBF2FF]/30 transition-colors" style={{ background: rowBg }}>
                    <td className="px-4 py-2.5 text-[#9CA3AF]">{page * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-2.5 font-semibold text-[#1F2937] max-w-[240px]">
                      <span className="block truncate" title={t.title}>
                        {t.isOverdue && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 mb-0.5" />}
                        {t.title}
                      </span>
                    </td>
                    <td className="px-4 py-2.5"><StatusBadge sk={t.statusKey} /></td>
                    <td className="px-4 py-2.5"><PriorityBadge pk={t.priorityKey} /></td>
                    <td className="px-4 py-2.5 text-[#6B7280]">
                      {t.assignee === '—'
                        ? <span className="text-[#9CA3AF] italic">Unassigned</span>
                        : t.assignee}
                    </td>
                    <td className="px-4 py-2.5">
                      {t.dueDate === '—' ? (
                        <span className="text-[#C4C9D4]">—</span>
                      ) : (
                        <span className={t.isOverdue ? 'font-bold text-[#DC2626]' : 'text-[#6B7280]'}>
                          {t.dueDate}
                          {t.isOverdue && <span className="ml-1 text-[9px]">(+{t.daysOverdue}d)</span>}
                          {t.isUpcoming && !t.isOverdue && (
                            <span className="ml-1 text-[9px] text-[#F59E0B]">({t.daysUntilDue}d)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#6B7280]">
                      {t.sprint === '—' ? <span className="text-[#C4C9D4]">—</span> : t.sprint}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#F3F4F6]">
          <span className="text-[10px] text-[#9CA3AF]">
            Page {page + 1} of {totalPages} · {filtered.length} results
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="w-7 h-7 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#EBF2FF] hover:text-[#155DFC] disabled:opacity-30 transition-colors"
            >
              <ChevronUp size={12} className="rotate-[-90deg]" />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, p2) => {
              const pg = totalPages <= 5 ? p2 : Math.max(0, Math.min(page - 2, totalPages - 5)) + p2;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className="w-7 h-7 rounded-lg text-[11px] font-semibold transition-colors"
                  style={{
                    background: pg === page ? '#155DFC' : 'transparent',
                    color:      pg === page ? '#fff'    : '#6B7280',
                    border:     `1px solid ${pg === page ? '#155DFC' : '#E5E7EB'}`,
                  }}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="w-7 h-7 rounded-lg border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-[#EBF2FF] hover:text-[#155DFC] disabled:opacity-30 transition-colors"
            >
              <ChevronDown size={12} className="rotate-[-90deg]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
