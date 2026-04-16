'use client';

import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import TaskCardModal from '@/app/taskcard/TaskCardModal';
import CoffeeLoader from '@/components/ui/CoffeeLoader';
import StatusDonutChart from '@/components/ui/StatusDonutChart';

export interface DashboardItem {
    id: string; 
    realId: number;
    projectId?: number;
    type: 'TASK' | 'PROJECT_AGILE' | 'PROJECT_KANBAN' | 'BOARD';
    name: string;
    location: string;
    status?: string;
    timestamp: string;
}

interface DashboardTableProps {
    activeTab: string;
    searchQuery: string;
    setDashboardAssignedCount?: (count: number) => void;
}

const mapProjectToDashboard = (p: { id: number; type?: string; name: string; projectKey?: string; updatedAt?: string; createdAt?: string }): DashboardItem => ({
     id: `P-${p.id}`,
     realId: p.id,
     type: p.type === 'KANBAN' ? 'PROJECT_KANBAN' : 'PROJECT_AGILE',
     name: p.name,
     location: p.projectKey || 'Workspace',
     timestamp: p.updatedAt || p.createdAt || new Date().toISOString()
});

const mapTaskToDashboard = (t: { id: number; projectId?: number; title: string; projectName?: string; status?: string; updatedAt?: string; createdAt?: string }): DashboardItem => {
    let normalizedStatus = t.status ? t.status.toUpperCase() : 'TODO';
    if (!['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].includes(normalizedStatus)) {
        normalizedStatus = 'TODO';
    }
    return {
        id: `T-${t.id}`,
        realId: t.id,
        projectId: t.projectId,
        type: 'TASK',
        name: t.title,
        location: t.projectName || 'Project',
        status: normalizedStatus,
        timestamp: t.updatedAt || t.createdAt || new Date().toISOString()
    };
};

const mapBoardToDashboard = (b: { id: number; projectId: number; name: string; projectName: string; updatedAt?: string }): DashboardItem => ({
     id: `B-${b.id}`,
     realId: b.projectId, 
     type: 'BOARD', 
     name: b.name,
     location: b.projectName,
     timestamp: b.updatedAt || new Date().toISOString()
});

const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
        'TODO': 'bg-gray-100 text-gray-700 border-gray-200',
        'IN_PROGRESS': 'bg-blue-50 text-blue-700 border-blue-200',
        'IN_REVIEW': 'bg-purple-50 text-purple-700 border-purple-200',
        'DONE': 'bg-green-50 text-green-700 border-green-200'
    };

    const dotColors: Record<string, string> = {
        'TODO': 'bg-gray-400',
        'IN_PROGRESS': 'bg-blue-500',
        'IN_REVIEW': 'bg-purple-500',
        'DONE': 'bg-green-500'
    };

    const labels: Record<string, string> = {
        'TODO': 'TODO',
        'IN_PROGRESS': 'IN PROGRESS',
        'IN_REVIEW': 'IN REVIEW',
        'DONE': 'DONE'
    };

    const currentClass = colors[status] || colors['TODO'];

    return (
        <div className={`w-[120px] px-3 py-1 flex items-center gap-2 text-[11px] font-bold tracking-wider rounded-md border ${currentClass}`}>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className={`w-1.5 h-1.5 shrink-0 rounded-full ${dotColors[status] || 'bg-gray-400'}`}></span>
                {labels[status] || status}
            </span>
        </div>
    );
};

export default function DashboardTable({ activeTab, searchQuery, setDashboardAssignedCount }: DashboardTableProps) {
    const router = useRouter();
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [hoveredSlice, setHoveredSlice] = useState<string | null>(null);
    const paginationKey = `${activeTab}::${searchQuery}`;
    const [paginationState, setPaginationState] = useState(() => ({ key: paginationKey, visibleCount: 5 }));
    const visibleCount = paginationState.key === paginationKey ? paginationState.visibleCount : 5;

    // Independent fetch for assigned count
    const { data: assignedData } = useSWR(
        setDashboardAssignedCount ? '/api/tasks/assigned?limit=100' : null,
        (url) => api.get(url).then(res => res.data),
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000
        }
    );

    useEffect(() => {
        if (assignedData && setDashboardAssignedCount) {
            const pendingCount = assignedData.filter((task: { status?: string }) => task.status !== 'DONE').length;
            setDashboardAssignedCount(pendingCount);
        }
    }, [assignedData, setDashboardAssignedCount]);

    // Use SWR for active tab data
    const { data: tabData, isLoading } = useSWR<DashboardItem[]>(
        activeTab ? `dashboardTab:${activeTab}` : null,
        async () => {
            if (activeTab === 'boards') {
                const res = await api.get('/api/sprintboards/user/recent?limit=20');
                return res.data.map(mapBoardToDashboard);
            } else if (activeTab === 'favorites') {
                const res = await api.get('/api/projects/favorites');
                return res.data.map(mapProjectToDashboard);
            } else if (activeTab === 'assigned-to-me') {
                const res = await api.get('/api/tasks/assigned');
                return res.data.map(mapTaskToDashboard);
            } else if (activeTab === 'worked-on') {
                const res = await api.get('/api/tasks/worked-on');
                return res.data.map(mapTaskToDashboard);
            } else if (activeTab === 'viewed') {
                const [pRes, tRes] = await Promise.all([
                    api.get('/api/projects/recent?limit=20').catch(() => ({ data: [] })),
                    api.get('/api/tasks/recent?limit=20').catch(() => ({ data: [] }))
                ]);

                const merged = [
                    ...(pRes.data || []).map(mapProjectToDashboard),
                    ...(tRes.data || []).map(mapTaskToDashboard)
                ].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                return merged;
            }
            return [];
        },
        {
            revalidateOnFocus: false,
            dedupingInterval: 30000,
            keepPreviousData: true
        }
    );

    const items: DashboardItem[] = tabData || [];
    const loading = isLoading && !tabData;

    useEffect(() => {
        const onTaskUpdated = () => {
            setLoading(true);
            setTimeout(() => setLoading(false), 300);
        };
        window.addEventListener('planora:task-updated', onTaskUpdated);
        return () => window.removeEventListener('planora:task-updated', onTaskUpdated);
    }, []);

    const filteredItems = items.filter(item => {
        if (item.type === 'TASK' && item.status === 'DONE') return false;
        return item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
               item.location.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const visibleData = filteredItems.slice(0, visibleCount);

    const updateVisibleCount = (delta: number) => {
        setPaginationState(prev => {
            const currentCount = prev.key === paginationKey ? prev.visibleCount : 5;
            return {
                key: paginationKey,
                visibleCount: Math.max(5, currentCount + delta)
            };
        });
    };

    const handleRowClick = (item: DashboardItem) => {
        if(item.type === 'TASK') {
            setSelectedTaskId(item.realId);
        } else {
            localStorage.setItem('currentProjectId', item.realId.toString());
            localStorage.setItem('currentProjectName', item.name);
            window.dispatchEvent(new CustomEvent('planora:project-accessed'));
            router.push(`/summary/${item.realId}`);
        }
    };

    const renderStatusBadge = (item: DashboardItem) => {
        if (item.type !== 'TASK') return null;
        return <StatusBadge status={item.status || 'TODO'} />;
    };

    const getIcon = (item: DashboardItem) => {
        if (item.type === 'TASK') {
            return (
                <div className="w-[34px] h-[34px] shrink-0 flex items-center justify-center bg-blue-50/80 text-blue-600 rounded-lg border border-blue-100 shadow-sm transition-all duration-300 group-hover:bg-blue-100 group-hover:scale-105 group-hover:shadow-[0_4px_12px_rgba(37,99,235,0.15)] relative overflow-hidden">
                    <svg className="relative z-10 w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-[1.15]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" className="opacity-20 group-hover:opacity-100 transition-opacity duration-300" />
                        <path d="M9 12l2 2 4-4" className="stroke-current" />
                    </svg>
                </div>
            );
        }
        if (item.type === 'PROJECT_KANBAN') {
            return (
                <div className="w-[34px] h-[34px] shrink-0 flex items-center justify-center bg-emerald-50/80 text-emerald-600 rounded-lg border border-emerald-100 shadow-sm transition-all duration-300 group-hover:bg-emerald-100 group-hover:scale-105 group-hover:shadow-[0_4px_12px_rgba(16,185,129,0.15)] relative overflow-hidden">
                    <svg className="relative z-10 w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
                        <path d="M8 7v9" strokeWidth="3" className="transition-all duration-500 ease-out group-hover:-translate-y-1" />
                        <path d="M16 7v6" strokeWidth="3" className="transition-all duration-500 ease-out delay-75 group-hover:translate-y-2" />
                    </svg>
                </div>
            );
        }
        if (item.type === 'PROJECT_AGILE') {
            return (
                <div className="w-[34px] h-[34px] shrink-0 flex items-center justify-center bg-indigo-50/80 text-indigo-600 rounded-lg border border-indigo-100 shadow-sm transition-all duration-300 group-hover:bg-indigo-100 group-hover:scale-105 group-hover:shadow-[0_4px_12px_rgba(99,102,241,0.15)] relative overflow-hidden">
                    <svg className="relative z-10 w-[18px] h-[18px] transition-transform duration-700 ease-in-out group-hover:rotate-[180deg]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                    </svg>
                </div>
            );
        }
        if (item.type === 'BOARD') {
            return (
                <div className="w-[34px] h-[34px] shrink-0 flex items-center justify-center bg-amber-50/80 text-amber-500 rounded-lg border border-amber-100 shadow-sm transition-all duration-300 group-hover:bg-amber-100 group-hover:scale-105 group-hover:shadow-[0_4px_12px_rgba(245,158,11,0.15)] relative overflow-hidden">
                    <svg className="relative z-10 w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
                        <line x1="9" y1="3" x2="9" y2="21" className="opacity-30" />
                        <line x1="15" y1="3" x2="15" y2="21" className="opacity-30" />
                        <path d="M5 8h2" className="transition-transform duration-300 ease-out group-hover:translate-y-2" strokeWidth="3" />
                        <path d="M11 10h2" className="transition-transform duration-300 ease-out group-hover:-translate-y-2 delay-75" strokeWidth="3" />
                        <path d="M17 14h2" className="transition-transform duration-300 ease-out group-hover:translate-y-3 delay-150" strokeWidth="3" />
                    </svg>
                </div>
            );
        }
        return <div className="w-[34px] h-[34px] shrink-0 bg-[#F0B100] border-2 border-[#F0B100] rounded-lg" />;
    };

    const getEmptyStateMessage = () => {
        if (searchQuery) return "No results found for your search.";
        switch(activeTab) {
            case 'worked-on': return "You haven't modified any tasks recently.";
            case 'viewed': return "You haven't viewed any boards or tasks recently.";
            case 'assigned-to-me': return "You have no assigned tasks. Take a break!";
            case 'favorites': return "You haven't favored any projects yet.";
            case 'boards': return "No boards found.";
            default: return "Nothing to show here.";
        }
    };

    if (loading) {
        return (
            <div className="w-full flex items-center justify-center min-h-[40vh]">
                <CoffeeLoader />
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col-reverse lg:flex-row gap-6 lg:gap-8 items-start">
            <motion.div 
                layout 
                style={{ contentVisibility: 'auto', containIntrinsicSize: '0 500px' } as React.CSSProperties}
                className="w-full flex-1 overflow-x-auto custom-scrollbar"
            >
                <table className="min-w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="border-b border-slate-100">
                            {activeTab === 'assigned-to-me' ? (
                                <>
                                    <th className="sticky left-0 z-20 bg-white py-3.5 px-4 text-left font-outfit text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Task Name</th>
                                    <th className="py-3.5 px-4 text-left font-outfit text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">Status</th>
                                </>
                            ) : (
                                <>
                                    <th className="py-3.5 w-[48px] text-left border-b border-slate-100"></th>
                                    <th className="sticky left-0 z-20 bg-white py-3.5 pr-4 text-left font-outfit text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        {activeTab === 'boards' ? 'Board Name' : activeTab === 'favorites' ? 'Project Name' : 'Name'}
                                    </th>
                                    <th className="py-3.5 text-left font-outfit text-[11px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                                        {activeTab === 'boards' ? 'Project' : activeTab === 'favorites' ? 'Project Key' : 'Location'}
                                    </th>
                                </>
                            )}
                        </tr>
                    </thead>
                <tbody>
                    {filteredItems.length === 0 ? (
                        <tr>
                            <td colSpan={activeTab === 'assigned-to-me' ? 2 : 3} className="py-16 text-center border-b-[0.8px] border-[#E5E7EB]">
                                <div className="flex flex-col items-center justify-center text-gray-400 mb-3">
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 12h8"></path></svg>
                                </div>
                                <p className="font-arimo text-[14px] font-medium text-[#6A7282]">{getEmptyStateMessage()}</p>
                            </td>
                        </tr>
                    ) : (
                        visibleData.map((item, index) => (
                            <motion.tr 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: activeTab === 'assigned-to-me' ? Math.min(index * 0.05, 0.4) : 0 }}
                                key={item.id} 
                                className={`group border-b-[0.8px] border-[#E5E7EB] hover:bg-gray-50/80 cursor-pointer transition-all duration-300 ${activeTab === 'assigned-to-me' && hoveredSlice && item.status !== hoveredSlice ? 'opacity-20 scale-[0.99] grayscale' : 'opacity-100'}`}
                                onClick={() => handleRowClick(item)}
                            >
                                {activeTab === 'assigned-to-me' ? (
                                    <>
                                        <td className="sticky left-0 z-10 bg-white py-3.5 px-4 max-w-[150px] sm:max-w-[200px] xl:max-w-[280px] shadow-[6px_0_10px_-6px_rgba(0,0,0,0.08)] bg-white/95 backdrop-blur-sm">
                                            <div className="font-outfit text-[13.5px] text-slate-900 font-bold truncate group-hover:text-blue-600 transition-colors" title={item.name}>
                                                {item.name}
                                            </div>
                                            <div className="font-outfit text-[10px] font-bold text-slate-400 mt-1 truncate tracking-wider uppercase">
                                                {item.location}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 whitespace-nowrap">
                                            {renderStatusBadge(item)}
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="py-3.5 whitespace-nowrap">{getIcon(item)}</td>
                                        <td className="sticky left-0 z-10 bg-white py-3.5 pr-4 text-[#101828] font-outfit text-[13.5px] font-bold whitespace-nowrap shadow-[6px_0_10px_-6px_rgba(0,0,0,0.08)] bg-white/95 backdrop-blur-sm">
                                            {item.name}
                                        </td>
                                        <td className="py-3.5 text-slate-500 font-outfit text-[12.5px] font-medium">
                                            {item.location}
                                        </td>
                                    </>
                                )}
                            </motion.tr>
                        ))
                    )}
                </tbody>
            </table>
            
            {/* Professional Pagination Controls */}
            {filteredItems.length > 5 && (
                <div className="w-full flex items-center justify-center gap-3 mt-4 mb-2 pt-4 border-t border-gray-100/80">
                    {visibleCount < filteredItems.length && (
                        <button 
                            onClick={() => updateVisibleCount(5)}
                            className="group flex items-center gap-1.5 px-4 py-1.5 font-arimo text-[13px] font-semibold text-[#4B5563] bg-white border border-[#E5E7EB] rounded-full shadow-sm hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all active:scale-95"
                        >
                            <span>Show More</span>
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                        </button>
                    )}
                    {visibleCount > 5 && (
                        <button 
                            onClick={() => updateVisibleCount(-5)}
                            className="group flex items-center gap-1.5 px-4 py-1.5 font-arimo text-[13px] font-semibold text-[#4B5563] bg-white border border-[#E5E7EB] rounded-full shadow-sm hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-all active:scale-95"
                        >
                            <span>Show Less</span>
                            <svg className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
                        </button>
                    )}
                </div>
            )}
            </motion.div>

            <AnimatePresence>
                {activeTab === 'assigned-to-me' && (
                    <motion.div 
                        initial={{ opacity: 0, width: 0, scale: 0.95 }}
                        animate={{ opacity: 1, width: "320px", scale: 1 }}
                        exit={{ opacity: 0, width: 0, scale: 0.95 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="w-full lg:w-[320px] shrink-0 lg:border-l border-gray-100 lg:pl-6 max-lg:pb-6 max-lg:border-b max-lg:mx-auto max-lg:max-w-[400px] bg-white lg:bg-transparent"
                    >
                        <StatusDonutChart items={filteredItems} onHover={setHoveredSlice} />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {selectedTaskId && (
                    <TaskCardModal 
                        taskId={selectedTaskId} 
                        onClose={(wasModified) => {
                            setSelectedTaskId(null);
                            if (wasModified) {
                                window.dispatchEvent(new CustomEvent('planora:task-updated'));
                            }
                        }} 
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
