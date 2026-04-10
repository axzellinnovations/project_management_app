import React from 'react';
import Image from 'next/image';
import MotionWrapper from './MotionWrapper';
import { Task, TeamMemberInfo } from '@/types';
import Link from 'next/link';

const GRADIENTS = [
    'linear-gradient(135deg, #FF6B6B 0%, #C0392B 100%)',
    'linear-gradient(135deg, #4DABF7 0%, #1971C2 100%)',
    'linear-gradient(135deg, #51CF66 0%, #2B8A3E 100%)',
    'linear-gradient(135deg, #FCC419 0%, #E67700 100%)',
    'linear-gradient(135deg, #CC5DE8 0%, #862E9C 100%)',
];

function formatRole(role?: string) {
    if (!role) return 'Team Member';
    const mapping: Record<string, string> = {
        'OWNER': 'Project Owner',
        'ADMIN': 'Admin',
        'MEMBER': 'Team Member',
        'VIEWER': 'Viewer'
    };
    if (mapping[role.toUpperCase()]) return mapping[role.toUpperCase()];
    
    return role.split('_').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
}

function TeamMemberRow({
    member,
    tasks,
    index
}: {
    member: TeamMemberInfo,
    tasks: Task[],
    index: number
}) {
    // CRITICAL FIX: The backend TaskResponseDTO.assigneeId corresponds to the TeamMember ID (member.id),
    // not the User ID (member.user.userId). 
    const assignedTasks = React.useMemo(() => 
        tasks.filter(t => t.assigneeId === member.id),
        [tasks, member.id]
    );

    const totalTasks = assignedTasks.length;
    const tasksCompleted = assignedTasks.filter(t => t.status === 'DONE').length;
    
    const overdueCount = React.useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return assignedTasks.filter(t => {
            if (t.status === 'DONE' || !t.dueDate) return false;
            const dueDate = new Date(t.dueDate);
            return dueDate < today;
        }).length;
    }, [assignedTasks]);

    const initials = (member.user.fullName || member.user.username || 'U').substring(0, 2).toUpperCase();
    const gradient = GRADIENTS[index % GRADIENTS.length];
    
    const percentage = totalTasks === 0 ? 0 : Math.round((tasksCompleted / totalTasks) * 100);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const [imgError, setImgError] = React.useState(false);

    const resolvedProfilePicUrl = React.useMemo(() => {
        if (!member.user.profilePicUrl || imgError) return null;
        if (member.user.profilePicUrl.startsWith('http')) return member.user.profilePicUrl;
        return `${API_BASE_URL}${member.user.profilePicUrl.startsWith('/') ? '' : '/'}${member.user.profilePicUrl}`;
    }, [member.user.profilePicUrl, API_BASE_URL, imgError]);

    return (
        <div className="mb-6 last:mb-0 border-b border-gray-50 last:border-0 pb-5 last:pb-0 hover:bg-gray-50/50 -mx-2 px-2 rounded-xl transition-all duration-200 group">
            <div className="flex items-center gap-3 mb-3">
                <div className="relative flex-shrink-0">
                    {resolvedProfilePicUrl ? (
                        <Image
                            src={resolvedProfilePicUrl}
                            alt={member.user.username || 'Member profile'}
                            width={44}
                            height={44}
                            className="w-11 h-11 rounded-full object-cover ring-2 ring-white shadow-sm transition-transform group-hover:scale-105"
                            unoptimized
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-arimo text-[15px] font-bold ring-2 ring-white shadow-sm transition-transform group-hover:scale-105" style={{ background: gradient }}>
                            {initials}
                        </div>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                        <div className="truncate">
                            <h4 className="font-arimo text-[14px] text-[#101828] font-bold leading-tight mb-0.5 truncate group-hover:text-[#0052CC] transition-colors">{member.user.fullName || member.user.username}</h4>
                            <p className="font-arimo text-[12px] text-[#667085] font-medium">{formatRole(member.role)}</p>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1">
                            {overdueCount > 0 ? (
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold tracking-wider ${overdueCount > 2 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} border border-black/5`}>
                                    {overdueCount} OVERDUE
                                </span>
                            ) : totalTasks > 0 ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full font-extrabold tracking-wider bg-emerald-100 text-emerald-700 border border-black/5 uppercase">
                                    On Track
                                </span>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="pl-[56px]">
                <div className="flex justify-between items-end text-[11px] font-arimo mb-2">
                    <div className="flex items-center gap-1.5 text-[#475467] font-semibold dark:text-gray-400">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>{totalTasks} {totalTasks === 1 ? 'Task' : 'Tasks'}</span>
                    </div>
                    <span className={`font-bold transition-colors ${percentage === 100 ? 'text-emerald-600' : 'text-[#101828]'}`}>
                        {percentage}% Done
                    </span>
                </div>

                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 flex overflow-hidden shadow-inner ring-1 ring-black/5">
                    {totalTasks > 0 ? (
                        <>
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-700 ease-out shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1)]" 
                                style={{ width: `${percentage}%` }} 
                                title={`Completed: ${tasksCompleted}`}
                            ></div>
                            <div 
                                className="h-full bg-blue-500/90 transition-all duration-700 ease-out shadow-[inset_0_-1px_2px_rgba(0,0,0,0.1)]" 
                                style={{ width: `${100 - percentage}%` }} 
                                title={`Pending: ${totalTasks - tasksCompleted}`}
                            ></div>
                        </>
                    ) : (
                        <div className="w-full h-full bg-gray-200/50 dark:bg-gray-700/50 transition-colors"></div>
                    )}
                </div>

                <div className="flex items-center gap-4 mt-3">
                     <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200"></div> 
                        <span>Done <span className="text-gray-900 ml-0.5">{tasksCompleted}</span></span>
                     </div>
                     <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wide">
                        <div className="w-2 h-2 rounded-full bg-blue-500/90 shadow-sm shadow-blue-200"></div> 
                        <span>Pending <span className="text-gray-900 ml-0.5">{totalTasks - tasksCompleted}</span></span>
                     </div>
                </div>
            </div>
        </div>
    );
}

export default function ProjectTeam({ projectId, tasks = [], members = [] }: { projectId?: number, tasks?: Task[], members?: TeamMemberInfo[] }) {
    return (
        <MotionWrapper delay={0.5} className="bg-white rounded-2xl border border-[#EAECF0] p-6 shadow-sm hover:shadow-xl transition-all duration-500">
            <h2 className="font-arimo text-[16px] font-bold text-[#101828] mb-6 flex items-center justify-between">
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#0052CC]" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                    </svg>
                    Team & Workload
                </span>
                <span className="text-[10px] font-black tracking-tighter text-[#667085] bg-[#F9FAFB] px-2.5 py-1 rounded-lg border border-[#EAECF0] shadow-sm uppercase">{members.length} Members</span>
            </h2>

            {members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 bg-[#F9FAFB] rounded-2xl border border-dashed border-[#EAECF0] group cursor-default">
                    <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300">
                        <svg className="w-6 h-6 text-gray-300 group-hover:text-[#0052CC] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <p className="font-arimo text-[14px] text-[#667085] font-bold">No team members yet</p>
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {members.map((member, index) => (
                        <TeamMemberRow key={member.id} member={member} tasks={tasks} index={index} />
                    ))}
                </div>
            )}

            <Link 
                href={`/project/${projectId}/members`} 
                className="group flex items-center justify-center gap-2 text-[#344054] bg-white border border-[#D0D5DD] hover:bg-[#101828] hover:text-white hover:border-[#101828] rounded-xl py-3 mt-6 font-arimo text-[13px] font-bold transition-all duration-300 shadow-sm hover:shadow-lg active:scale-[0.97]"
            >
                <div className="p-1 rounded-md bg-gray-50 group-hover:bg-white/10 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                </div>
                <span>Manage Team</span>
            </Link>
        </MotionWrapper>
    );
}
