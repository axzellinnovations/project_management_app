import MotionWrapper from './MotionWrapper';

export function ProjectTimeline() {
    return (
        <MotionWrapper delay={0.2} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200 h-full flex flex-col">
            <h2 className="font-arimo text-[18px] font-semibold text-[#101828] mb-6">Project Timeline</h2>

            <div className="w-full h-2.5 flex rounded-full overflow-hidden mb-6 bg-[#F2F4F7]">
                {/* Empty timeline bar */}
            </div>

            <div className="flex justify-between text-[14px] text-[#4A5565] font-arimo mt-auto">
                <span>Start: -</span>
                <span>Due: -</span>
            </div>
        </MotionWrapper>
    );
}

export function CurrentSprint() {
    return (
        <MotionWrapper delay={0.3} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <div className="flex justify-between items-start mb-1">
                <div>
                    <h2 className="font-arimo text-[18px] font-semibold text-[#101828]">Current Sprint</h2>
                    <p className="font-arimo text-[15px] text-[#6A7282] mt-1 font-medium">No active sprint</p>
                </div>
                <div className="bg-[#E5E7EB] text-[#4A5565] text-[14px] px-3 py-1 rounded-full font-arimo">
                    - Days Remaining
                </div>
            </div>

            <div className="mt-8 mb-6">
                <div className="flex justify-between text-[14px] text-[#4A5565] font-arimo mb-2">
                    <span>Task Done: 0/0</span>
                    <span>0%</span>
                </div>
                <div className="w-full bg-[#F3F4F6] rounded-full h-3">
                    <div className="bg-[#0052CC] h-3 rounded-full" style={{ width: "0%" }}></div>
                </div>
            </div>

            <a href="#" className="flex items-center gap-2 text-[#4A5565] font-arimo text-[16px] cursor-not-allowed">
                Go to Board
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M3.33334 8H12.6667" stroke="#99A1AF" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 3.33334L12.6667 8L8 12.6667" stroke="#99A1AF" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </a>
        </MotionWrapper>
    );
}
