import React from 'react';
import MotionWrapper from './MotionWrapper';
import { Task, PageItem } from '@/types';
import Link from 'next/link';

function formatTimeAgo(dateString?: string) {
    if (!dateString) return '';
    const diff = new Date().getTime() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function RecentActivity({ tasks = [], pages = [] }: { tasks?: Task[], pages?: PageItem[] }) {
    
    // Recent Activity Feed: Most recently updated tasks
    const recentUpdates = [...tasks]
        .filter(t => t.updatedAt)
        .sort((a, b) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
        .slice(0, 5);

    // Milestones: Tasks with closest upcoming dueDates
    const now = new Date().getTime();
    const upcomingMilestones = [...tasks]
        .filter(t => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate).getTime() >= now)
        .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
        .slice(0, 3);

    // Pinned Docs: Project pages (latest first)
    const recentPages = [...pages]
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
        .slice(0, 3);

    return (
        <div className="flex flex-col gap-6">
            
            {/* Recent Activity Feed */}
            <MotionWrapper delay={0.4} className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-5 border-b border-gray-100 pb-3">Recent Activity Feed</h2>
                
                {recentUpdates.length === 0 ? (
                    <p className="font-arimo text-[14px] text-[#98A2B3] italic bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No recent updates</p>
                ) : (
                    <div className="relative border-l-2 border-gray-100 ml-3 pl-5 space-y-6">
                        {recentUpdates.map((task) => {
                            const isDone = task.status === 'DONE';
                            return (
                                <div key={task.id} className="relative">
                                    <div className={`absolute -left-[27px] w-6 h-6 rounded-full flex items-center justify-center border-2 border-white ${isDone ? 'bg-[#00875A]' : 'bg-[#0052CC]'}`}>
                                        {task.assignee?.avatar || task.assigneeName ? (
                                             <span className="text-[10px] text-white font-bold">{task.assigneeName?.substring(0,2).toUpperCase()}</span>
                                        ) : (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                {isDone ? <polyline points="20 6 9 17 4 12"></polyline> : <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>}
                                            </svg>
                                        )}
                                    </div>
                                    <p className="font-arimo text-[13px] text-gray-800 leading-tight">
                                        <span className="font-semibold">{task.assigneeName || 'Someone'}</span> {isDone ? 'completed' : 'updated'} <span className="font-medium text-[#0052CC]">TSK-{task.id}</span>
                                    </p>
                                    <p className="font-arimo text-[12px] text-gray-500 mt-1 truncate">{task.title}</p>
                                    <span className="font-arimo text-[11px] text-gray-400 absolute top-0 right-0">{formatTimeAgo(task.updatedAt)}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </MotionWrapper>

            {/* Upcoming Milestones */}
            <MotionWrapper delay={0.45} className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF8B00" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                    Upcoming Milestones
                </h2>
                
                {upcomingMilestones.length === 0 ? (
                    <p className="font-arimo text-[13px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No upcoming deadlines.</p>
                ) : (
                    <div className="space-y-4">
                        {upcomingMilestones.map(t => {
                            const daysDiff = Math.ceil((new Date(t.dueDate!).getTime() - now) / (1000 * 3600 * 24));
                            return (
                                <div key={t.id} className="flex justify-between items-center group">
                                    <div className="flex-1 min-w-0 pr-3">
                                        <p className="font-arimo text-[13px] font-semibold text-gray-800 truncate">{t.title}</p>
                                        <p className="font-arimo text-[11px] text-gray-500 truncate">Assigned to: {t.assigneeName || 'Unassigned'}</p>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap ${daysDiff <= 3 ? 'bg-[#FFEBE6] text-[#DE350B]' : 'bg-[#FFF4ED] text-[#FF8B00]'}`}>
                                        {daysDiff === 0 ? 'Today' : `In ${daysDiff} day${daysDiff > 1 ? 's' : ''}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </MotionWrapper>

            {/* Pinned Docs / Wiki */}
            <MotionWrapper delay={0.5} className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
                <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-4 border-b border-gray-100 pb-3 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2684FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Project Docs
                </h2>
                
                {recentPages.length === 0 ? (
                    <p className="font-arimo text-[13px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No documents found.</p>
                ) : (
                    <div className="space-y-3">
                        {recentPages.map(page => (
                            <Link key={page.id} href={`/project/${tasks[0]?.projectId}/pages/${page.id}`} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors group">
                                <span className="bg-blue-100 text-blue-600 p-1.5 rounded-md group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                </span>
                                <span className="font-arimo text-[13px] text-gray-800 font-medium truncate flex-1">{page.title}</span>
                            </Link>
                        ))}
                    </div>
                )}
            </MotionWrapper>

        </div>
    );
}
