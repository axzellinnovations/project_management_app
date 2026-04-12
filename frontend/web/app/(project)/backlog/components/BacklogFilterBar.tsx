'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Label, DateFilter } from '../../kanban/types';
import { TeamMemberOption } from '../../kanban/api';
import DateRangeFilter from '../../kanban/components/DateRangeFilter';
import { ChevronDown, Search, X, Layers, Tag, User, Filter } from 'lucide-react';

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
        <div className="flex items-center gap-2 mb-4">
            {/* Search - always visible */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                    type="text"
                    placeholder="Search tasks..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-[13px] border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#155DFC]/40"
                />
                {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X size={12} className="text-[#9CA3AF] hover:text-[#374151]" />
                    </button>
                )}
            </div>

            {/* Filter toggle button */}
            <div ref={panelRef} className="relative">
                <button
                    onClick={() => setFilterOpen(o => !o)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border rounded-lg transition-colors ${
                        filterOpen || hasActiveFilters
                            ? 'bg-[#EFF6FF] border-[#155DFC] text-[#155DFC]'
                            : 'bg-white border-[#E5E7EB] text-[#374151] hover:border-[#155DFC]'
                    }`}
                >
                    <Filter size={13} />
                    <span className="hidden sm:inline">Filters</span>
                    {activeCount > 0 && (
                        <span className="bg-[#155DFC] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                            {activeCount}
                        </span>
                    )}
                </button>

                {filterOpen && (
                    <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-[#E5E7EB] rounded-xl shadow-xl p-4 min-w-[300px] sm:min-w-[360px] space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-[#101828]">Filters</span>
                            {hasActiveFilters && (
                                <button
                                    onClick={() => { setFilterPriority([]); setFilterStatus([]); setFilterAssignee(''); setFilterLabel(null); setFilterDateRange({ startDate: null, endDate: null }); }}
                                    className="flex items-center gap-1 text-[11px] text-[#6A7282] hover:text-red-500 transition-colors"
                                >
                                    <X size={11} /> Clear all
                                </button>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <p className="text-[11px] font-medium text-[#9CA3AF] mb-1.5">Priority</p>
                            <div className="flex items-center gap-1.5">
                                {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setFilterPriority(prev =>
                                            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                        )}
                                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                                            filterPriority.includes(p)
                                                ? 'bg-[#155DFC] text-white border-[#155DFC]'
                                                : 'bg-white text-[#6A7282] border-[#E5E7EB] hover:border-[#155DFC]'
                                        }`}
                                    >{p}</button>
                                ))}
                            </div>
                        </div>

                        {/* Status */}
                        <div ref={statusFilterRef}>
                            <p className="text-[11px] font-medium text-[#9CA3AF] mb-1.5">Status</p>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setStatusFilterOpen(o => !o)}
                                    className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg bg-white text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                >
                                    <span>{filterStatus[0] ? filterStatus[0].replace(/_/g, ' ') : 'All Status'}</span>
                                    <ChevronDown size={12} className="text-[#9CA3AF]" />
                                </button>
                                {statusFilterOpen && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-50 min-w-full py-1">
                                        <button
                                            type="button"
                                            onClick={() => { setFilterStatus([]); setStatusFilterOpen(false); }}
                                            className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${filterStatus.length === 0 ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                        >All Status</button>
                                        {STATUS_OPTIONS.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => { setFilterStatus([s]); setStatusFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${filterStatus[0] === s ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                            >{s.replace(/_/g, ' ')}</button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assignee */}
                        {teamMembers.length > 0 && (
                            <div ref={assigneeFilterRef}>
                                <p className="text-[11px] font-medium text-[#9CA3AF] mb-1.5">Assignee</p>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setAssigneeFilterOpen(o => !o)}
                                        className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg bg-white text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <User size={12} className="text-[#9CA3AF]" />
                                            {filterAssignee || 'All Assignees'}
                                        </span>
                                        <ChevronDown size={12} className="text-[#9CA3AF]" />
                                    </button>
                                    {assigneeFilterOpen && (
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-50 min-w-full max-h-48 overflow-y-auto py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setFilterAssignee(''); setAssigneeFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${!filterAssignee ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                            >All Assignees</button>
                                            {teamMembers.map(m => (
                                                <button
                                                    key={m.id}
                                                    type="button"
                                                    onClick={() => { setFilterAssignee(m.name); setAssigneeFilterOpen(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${filterAssignee === m.name ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                                >{m.name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Label */}
                        {labels.length > 0 && (
                            <div ref={labelFilterRef}>
                                <p className="text-[11px] font-medium text-[#9CA3AF] mb-1.5">Label</p>
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setLabelFilterOpen(o => !o)}
                                        className="flex items-center justify-between w-full gap-1.5 px-2.5 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg bg-white text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                    >
                                        <span className="flex items-center gap-1.5">
                                            <Tag size={12} className="text-[#9CA3AF]" />
                                            {filterLabel ? labels.find(l => l.id === filterLabel)?.name ?? 'All Labels' : 'All Labels'}
                                        </span>
                                        <ChevronDown size={12} className="text-[#9CA3AF]" />
                                    </button>
                                    {labelFilterOpen && (
                                        <div className="absolute top-full left-0 mt-1 bg-white border border-[#E5E7EB] rounded-xl shadow-lg z-50 min-w-full max-h-48 overflow-y-auto py-1">
                                            <button
                                                type="button"
                                                onClick={() => { setFilterLabel(null); setLabelFilterOpen(false); }}
                                                className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${!filterLabel ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                            >All Labels</button>
                                            {labels.map(l => (
                                                <button
                                                    key={l.id}
                                                    type="button"
                                                    onClick={() => { setFilterLabel(l.id); setLabelFilterOpen(false); }}
                                                    className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#F9FAFB] transition-colors ${filterLabel === l.id ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                                                >{l.name}</button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Date range */}
                        <div>
                            <p className="text-[11px] font-medium text-[#9CA3AF] mb-1.5">Due Date</p>
                            <DateRangeFilter onFilterChange={setFilterDateRange} initialFilter={filterDateRange} />
                        </div>
                    </div>
                )}
            </div>

            {/* Group by - always visible */}
            <button
                onClick={() => setGroupBy(g => g === 'none' ? 'status' : g === 'status' ? 'priority' : g === 'priority' ? 'assignee' : 'none')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] border border-[#E5E7EB] rounded-lg bg-white text-[#374151] hover:border-[#155DFC] transition-colors"
                title="Toggle group by"
            >
                <Layers size={13} />
                {groupBy === 'none' ? 'Group by' : `By ${groupBy}`}
            </button>
        </div>
    );
}
