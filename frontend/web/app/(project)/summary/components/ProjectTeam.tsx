import React from 'react';
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

function TeamMemberRow({
    member,
    tasks,
    index
}: {
    member: TeamMemberInfo,
    tasks: Task[],
    index: number
}) {
    const assignedTasks = tasks.filter(t => t.assigneeId === member.user.userId);
    const totalTasks = assignedTasks.length;
    const tasksCompleted = assignedTasks.filter(t => t.status === 'DONE').length;
    
    // Calculate Due Issues
    const now = new Date().getTime();
    let dueCount = 0;
    assignedTasks.forEach(t => {
        if (t.status !== 'DONE' && t.dueDate && new Date(t.dueDate).getTime() < now) {
            dueCount++;
        }
    });

    const initials = member.user.fullName?.substring(0, 2).toUpperCase() || member.user.username?.substring(0, 2).toUpperCase() || 'U';
    const gradient = GRADIENTS[index % GRADIENTS.length];
    
    const percentage = totalTasks === 0 ? 0 : Math.round((tasksCompleted / totalTasks) * 100);

    return (
        <div className="mb-6 last:mb-0 border-b border-gray-100 last:border-0 pb-4 last:pb-0">
            <div className="flex items-center gap-3 mb-3">
                {member.user.profilePicUrl ? (
                    <img src={member.user.profilePicUrl} alt={member.user.username} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-arimo text-[16px]" style={{ background: gradient }}>
                        {initials}
                    </div>
                )}
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        <div>
                            <h4 className="font-arimo text-[14px] text-[#101828] font-semibold leading-[20px]">{member.user.fullName || member.user.username}</h4>
                            <p className="font-arimo text-[12px] text-[#6A7282]">{member.role || 'Member'}</p>
                        </div>
                        {dueCount > 0 ? (
                            <span className={`text-[11px] px-2 py-0.5 rounded-[4px] font-arimo font-semibold tracking-wide ${dueCount > 2 ? 'bg-[#FFEBE6] text-[#DE350B]' : 'bg-[#FFF4ED] text-[#FF8B00]'}`}>
                                {dueCount} Due
                            </span>
                        ) : (
                            <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-arimo font-semibold tracking-wide bg-[#E3FCEF] text-[#00875A]">
                                On Track
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Workload Bar (Tasks Assigned vs Completed vs Remaining) */}
            <div className="pl-[52px]">
                <div className="flex justify-between text-[12px] text-[#4A5565] font-arimo mb-1">
                    <span>Workload: {totalTasks} Tasks</span>
                    <span className="font-semibold text-gray-700">{percentage}% Done</span>
                </div>
                {/* Horizontal Stacked Bar representing Workload */}
                <div className="w-full bg-[#F2F4F7] rounded-full h-2 flex overflow-hidden">
                    <div className="h-2 bg-[#00875A] transition-all" style={{ width: `${percentage}%` }} title={`Completed: ${tasksCompleted}`}></div>
                    <div className="h-2 bg-[#0052CC] transition-all" style={{ width: `${totalTasks === 0 ? 0 : 100 - percentage}%` }} title={`Remaining: ${totalTasks - tasksCompleted}`}></div>
                </div>
                <div className="flex gap-4 mt-2 pl-1">
                     <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-arimo">
                        <span className="w-2 h-2 rounded-full bg-[#00875A]"></span> Done ({tasksCompleted})
                     </span>
                     <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-arimo">
                        <span className="w-2 h-2 rounded-full bg-[#0052CC]"></span> Pending ({totalTasks - tasksCompleted})
                     </span>
                </div>
            </div>
        </div>
    );
}

export default function ProjectTeam({ projectId, tasks = [], members = [] }: { projectId?: number, tasks?: Task[], members?: TeamMemberInfo[] }) {
    return (
        <MotionWrapper delay={0.5} className="bg-white rounded-xl border border-[#E3E8EF] p-5 shadow-sm hover:shadow-md transition-all duration-200">
            <h2 className="font-arimo text-[16px] font-semibold text-[#101828] mb-6 border-b border-gray-100 pb-3">Project Team & Workload</h2>

            {members.length === 0 ? (
                <p className="font-arimo text-[14px] text-[#98A2B3] bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No team members</p>
            ) : (
                <div className="flex flex-col">
                    {members.map((member, index) => (
                        <TeamMemberRow key={member.id} member={member} tasks={tasks} index={index} />
                    ))}
                </div>
            )}

            <Link href={`/project/${projectId}/members`} className="flex items-center justify-center gap-2 text-white bg-[#101828] hover:bg-[#1D2939] rounded-lg py-2 mt-4 font-arimo text-[13px] font-semibold transition-colors">
                Manage Team
            </Link>
        </MotionWrapper>
    );
}
