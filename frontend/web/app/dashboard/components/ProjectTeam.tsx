
import MotionWrapper from './MotionWrapper';

export default function ProjectTeam() {
    return (
        <MotionWrapper delay={0.5} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <h2 className="font-arimo text-[18px] font-semibold text-[#101828] mb-6">Project Team</h2>

            {/* Empty Team List */}
            <p className="font-arimo text-[14px] text-[#98A2B3] italic mb-4 bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No team members</p>

            <a href="#" className="flex items-center gap-2 text-[#0052CC] font-arimo text-[14px] font-semibold mt-4">
                + Add Member
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.33334 8H12.6667" stroke="#0052CC" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 3.33334L12.6667 8L8 12.6667" stroke="#0052CC" strokeWidth="1.33" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </a>
        </MotionWrapper>
    );
}
