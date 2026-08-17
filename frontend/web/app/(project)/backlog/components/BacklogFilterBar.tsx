'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Label, DateFilter } from '../../kanban/types';
import { TeamMemberOption } from '../../kanban/api';
import DateRangeFilter from '../../kanban/components/DateRangeFilter';
import { Archive, ChevronDown, Search, X, Layers, Tag, User, Filter } from 'lucide-react';
import AssigneeAvatar from '../../(agile)/sprint-backlog/components/AssigneeAvatar';

const STATUS_OPTIONS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];

interface BacklogFilterBarProps {
    searchTerm: string;
    setSearchTerm: (v: string) => void;
    filterPriority: string[];
    setFilterPriority: React.Dispatch<React.SetStateAction<string[]>>;
    filterStatus: string[];
    setFilterStatus: React.Dispatch<React.SetStateAction<string[]>>;
    filterAssignee: string;
    setFilterAssignee: (v: string) => void;
    filterLabel: number | null;
    setFilterLabel: (v: number | null) => void;
    filterDateRange: DateFilter;
    setFilterDateRange: (v: DateFilter) => void;
    groupBy: 'none' | 'status' | 'priority' | 'assignee';
    setGroupBy: React.Dispatch<React.SetStateAction<'none' | 'status' | 'priority' | 'assignee'>>;
    showArchived: boolean;
    setShowArchived: React.Dispatch<React.SetStateAction<boolean>>;
    teamMembers: TeamMemberOption[];
    labels: Label[];
}

export default function BacklogFilterBar({
    searchTerm, setSearchTerm,
    filterPriority, setFilterPriority,
    filterStatus, setFilterStatus,
    filterAssignee, setFilterAssignee,
    filterLabel, setFilterLabel,
    filterDateRange, setFilterDateRange,
    groupBy, setGroupBy,
    showArchived, setShowArchived,
    teamMembers, labels,
}: BacklogFilterBarProps) {
    const [filterOpen, setFilterOpen] = useState(false);
    const [statusFilterOpen, setStatusFilterOpen] = useState(false);
    const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);
    const [labelFilterOpen, setLabelFilterOpen] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const statusFilterRef = useRef<HTMLDivElement>(null);
    const assigneeFilterRef = useRef<HTMLDivElement>(null);
    const labelFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) setFilterOpen(false);
            if (statusFilterRef.current && !statusFilterRef.current.contains(e.target as Node)) setStatusFilterOpen(false);
            if (assigneeFilterRef.current && !assigneeFilterRef.current.contains(e.target as Node)) setAssigneeFilterOpen(false);
            if (labelFilterRef.current && !labelFilterRef.current.contains(e.target as Node)) setLabelFilterOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const hasActiveFilters = !!(filterPriority.length > 0 || filterStatus.length > 0 || filterAssignee || filterLabel !== null || filterDateRange.startDate || filterDateRange.endDate);
    const activeCount = (filterPriority.length > 0 ? 1 : 0) + (filterStatus.length > 0 ? 1 : 0) + (filterAssignee ? 1 : 0) + (filterLabel !== null ? 1 : 0) + (filterDateRange.startDate || filterDateRange.endDate ? 1 : 0);

    return (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4 rounded-2xl border border-cu-border bg-cu-bg/95 p-3 sm:p-4 shadow-cu-sm">
            {/* Search - always visible */}
            <div className="relative flex-1 min-w-[220px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cu-text-muted" />
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 h-10 text-[13px] border border-cu-border rounded-xl focus:outline-none focus:border-cu-primary focus:ring-2 focus:ring-cu-primary/30 bg-cu-bg-secondary text-cu-text-primary placeholder:text-cu-text-muted"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X size={12} className="text-cu-text-muted hover:text-cu-text-primary" />
                    </button>
                )}
            </div>

            {/* Filter toggle button */}
            <div ref={panelRef} className="relative">
                <button
                    onClick={() => setFilterOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-3 h-10 text-[12px] border rounded-xl transition-colors ${
                        filterOpen || hasActiveFilters
                            ? 'bg-cu-primary/10 border-cu-primary text-cu-primary'
                            : 'bg-cu-bg-secondary border-cu-border text-cu-text-primary hover:border-cu-primary/70 hover:bg-cu-hover'
                    }`}
                >
                    <Filter size={13} />
                    <span className="hidden sm:inline">Filters</span>
                    {activeCount > 0 && (
                        <span className="bg-cu-primary text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </button>

                {filterOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 bg-cu-bg border border-cu-border rounded-xl shadow-cu-xl p-4 min-w-[300px] sm:min-w-[360px] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-cu-text-primary">Filters</span>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => { setFilterPriority([]); setFilterStatus([]); setFilterAssignee(''); setFilterLabel(null); setFilterDateRange({ startDate: null, endDate: null }); }}
                                    className="flex items-center gap-1 text-[11px] text-cu-text-muted hover:text-cu-danger transition-colors"
                                >
                                    <X size={11} /> Clear all
                                </button>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <p className="text-[11px] font-medium text-cu-text-muted mb-1.5">Priority</p>
                            <div className="flex items-center gap-1.5">
                                {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setFilterPriority(prev =>
                                            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                        )}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                            filterPriority.includes(p)
                                                ? 'bg-cu-primary text-white border-cu-primary'
                                                : 'bg-cu-bg-secondary text-cu-text-secondary border-cu-border hover:border-cu-primary/70 hover:bg-cu-hover'
                                        }`}
                                    >{p}</button>
                                ))}
                            </div>
                        </div>

                        {/* Status */}
                        <div ref={statusFilterRef}>
                            <p className="text-[11px] font-medium text-cu-text-muted mb-1.5">Status</p>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setStatusFilterOpen(o => !o)}
                                    className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-cu-border rounded-lg bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover transition-colors"
                                >
                                    <span>{filterStatus[0] ? filterStatus[0].replace(/_/g, ' ') : 'All Status'}</span>
                                    <ChevronDown size={12} className="text-cu-text-muted" />
                                </button>
                                {statusFilterOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg z-50 min-w-full py-1">
                                        <button
                                            type="button"
                                            onClick={() => { setFilterStatus([]); setStatusFilterOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${filterStatus.length === 0 ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                                        >All Status</button>
                                        {STATUS_OPTIONS.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setFilterStatus([s]); setStatusFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${filterStatus[0] === s ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                                            >{s.replace(/_/g, ' ')}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assignee */}
                        {teamMembers.length > 0 && (
                            <div ref={assigneeFilterRef}>
                                <p className="text-[11px] font-medium text-cu-text-muted mb-1.5">Assignee</p>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setAssigneeFilterOpen(o => !o)}
                                        className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-cu-border rounded-lg bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5 truncate">
                                            {filterAssignee ? (
                                                <>
                                                    <AssigneeAvatar
                                                        name={filterAssignee}
                                                        profilePicUrl={teamMembers.find(m => m.name === filterAssignee)?.photoUrl}
                                                        size={16}
                                                    />
                                                    <span className="truncate">{filterAssignee}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <User size={12} className="text-cu-text-muted" />
                                                    <span>All Assignees</span>
                                                </>
                                            )}
                                        </span>
                                        <ChevronDown size={12} className="text-cu-text-muted shrink-0" />
                                    </button>
                                    {assigneeFilterOpen && (
                                        <div className="absolute top-full left-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg z-[var(--cu-z-modal-popover)] min-w-full max-h-80 overflow-y-auto py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setFilterAssignee(''); setAssigneeFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${!filterAssignee ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                                            >All Assignees</button>
                                            {teamMembers.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { setFilterAssignee(m.name); setAssigneeFilterOpen(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors flex items-center gap-2 ${filterAssignee === m.name ? 'font-semibold text-cu-primary bg-cu-primary/5' : 'text-cu-text-primary'}`}
                                                >
                                                    <AssigneeAvatar name={m.name} profilePicUrl={m.photoUrl} size={18} />
                                                    <span className="truncate">{m.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Label */}
                        {labels.length > 0 && (
                            <div ref={labelFilterRef}>
                                <p className="text-[11px] font-medium text-cu-text-muted mb-1.5">Label</p>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setLabelFilterOpen(o => !o)}
                                        className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-cu-border rounded-lg bg-cu-bg-secondary text-cu-text-primary hover:bg-cu-hover transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Tag size={12} className="text-cu-text-muted" />
                                            {filterLabel ? labels.find(l => l.id === filterLabel)?.name ?? 'All Labels' : 'All Labels'}
                                        </span>
                                        <ChevronDown size={12} className="text-cu-text-muted" />
                                    </button>
                                    {labelFilterOpen && (
                                        <div className="absolute top-full left-0 mt-1 bg-cu-bg border border-cu-border rounded-xl shadow-cu-lg z-50 min-w-full max-h-48 overflow-y-auto py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setFilterLabel(null); setLabelFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${!filterLabel ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                                            >All Labels</button>
                                            {labels.map(l => (
                                                <button
                                                    key={l.id}
                                                    type="button"
                                                    onClick={() => { setFilterLabel(l.id); setLabelFilterOpen(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-cu-hover transition-colors ${filterLabel === l.id ? 'font-semibold text-cu-primary' : 'text-cu-text-primary'}`}
                                                >{l.name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Date range */}
                        <div>
                            <p className="text-[11px] font-medium text-cu-text-muted mb-1.5">Due Date</p>
                            <DateRangeFilter onFilterChange={setFilterDateRange} initialFilter={filterDateRange} />
                        </div>
                    </div>
                )}
            </div>

            {/* Group by - always visible */}
            <button
                onClick={() => setGroupBy(g => g === 'none' ? 'status' : g === 'status' ? 'priority' : g === 'priority' ? 'assignee' : 'none')}
                className="flex items-center gap-1.5 px-3 h-10 text-[12px] border border-cu-border rounded-xl bg-cu-bg-secondary text-cu-text-primary hover:border-cu-primary/70 hover:bg-cu-hover transition-colors"
                title="Toggle group by"
            >
                <Layers size={13} />
                {groupBy === 'none' ? 'Group by' : `By ${groupBy}`}
            </button>

            <button
                onClick={() => setShowArchived(v => !v)}
                className={`flex items-center gap-1.5 px-3 h-10 text-[12px] rounded-xl border transition-colors ${
                    showArchived
                        ? 'bg-amber-400/10 border-amber-400/30 text-amber-500'
                        : 'bg-cu-bg-secondary border-cu-border text-cu-text-secondary hover:bg-cu-hover hover:border-cu-primary/50 hover:text-cu-text-primary'
                }`}
            >
                <Archive className="w-3.5 h-3.5" />
                {showArchived ? 'Hide Archived' : 'Show Archived'}
            </button>
        </div>
    );
}
