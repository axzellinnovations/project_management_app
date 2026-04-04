import MotionWrapper from './MotionWrapper';
import { Sprint, Task } from '@/types';
import Link from 'next/link';

export function CurrentSprint({ projectId, sprints = [], tasks = [] }: { projectId?: number, sprints?: Sprint[], tasks?: Task[] }) {
    const activeSprint = sprints.find(s => s.status === 'ACTIVE');

    if (!activeSprint) {
        return (
            <MotionWrapper delay={0.3} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="font-arimo text-[18px] font-semibold text-[#101828]">Current Sprint</h2>
                        <p className="font-arimo text-[14px] text-[#6A7282] mt-1">No active sprint</p>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#98A2B3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <p className="font-arimo text-[14px] text-gray-600 mb-4 text-center max-w-[250px]">Start a sprint to unleash your team's tracking capabilities.</p>
                    <button className="px-4 py-2 bg-[#0052CC] text-white font-semibold rounded-lg text-sm hover:bg-[#0047b3] transition-colors shadow-sm">
                        Create Sprint
                    </button>
                </div>
            </MotionWrapper>
        );
    }

    // Calculations for Active Sprint
    const sprintTasks = tasks.filter(t => t.sprintId === activeSprint.id);
    const totalPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
    const completedTasks = sprintTasks.filter(t => t.status === 'DONE');
    const donePoints = completedTasks.reduce((acc, t) => acc + (t.storyPoint || 0), 0);
    
    const percentage = totalPoints === 0 ? 0 : Math.round((donePoints / totalPoints) * 100);

    // Days Remaining
    let daysRemainingText = "Ending soon";
    let isUrgent = false;
    if (activeSprint.endDate) {
        const diff = new Date(activeSprint.endDate).getTime() - new Date().getTime();
        const days = Math.ceil(diff / (1000 * 3600 * 24));
        if (days >= 0) {
            daysRemainingText = `${days} Day${days !== 1 ? 's' : ''} Left`;
            isUrgent = days <= 3;
        } else {
            daysRemainingText = `Ended ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
            isUrgent = true;
        }
    }

    return (
        <MotionWrapper delay={0.3} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="font-arimo text-[18px] font-semibold text-[#101828]">Current Sprint</h2>
                    <p className="font-arimo text-[15px] text-[#0052CC] mt-1 font-bold">{activeSprint.name}</p>
                </div>
                <div className={`${isUrgent ? 'bg-[#FFEBE6] text-[#DE350B]' : 'bg-[#E3FCEF] text-[#00875A]'} px-3 py-1.5 rounded-md font-arimo font-bold text-[14px] shadow-sm`}>
                    {daysRemainingText}
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between text-[14px] text-[#4A5565] font-arimo mb-2">
                    <span className="font-medium">Points Done: {donePoints} / {totalPoints}</span>
                    <span className="font-bold text-[#101828]">{percentage}%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-3">
                    <div className="bg-[#0052CC] h-3 rounded-full transition-all" style={{ width: `${percentage}%` }}></div>
                </div>
                <p className="text-[12px] text-gray-500 mt-2 font-arimo">{completedTasks.length} out of {sprintTasks.length} tasks completed.</p>
            </div>

            <Link href={`/project/${projectId}/sprintboard`} className="inline-flex items-center gap-2 text-[#0052CC] font-arimo text-[15px] font-semibold hover:underline group">
                Go to Sprint Board
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:translate-x-1 transition-transform">
                    <path d="M3.33334 8H12.6667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 3.33334L12.6667 8L8 12.6667" stroke="currentColor" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </Link>
        </MotionWrapper>
    );
}
