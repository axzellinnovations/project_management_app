
import React from 'react';

import MotionWrapper from './MotionWrapper';

export default function RecentActivity() {
    return (
        <MotionWrapper delay={0.4} className="bg-white rounded-xl border border-[#E3E8EF] p-6 shadow-sm hover:shadow-md transition-all duration-200">
            <h2 className="font-arimo text-[18px] font-semibold text-[#101828] mb-6">Recent Activity</h2>

            <div className="flex flex-col gap-2">
                {/* Empty Activity List */}
                <p className="font-arimo text-[14px] text-[#98A2B3] italic bg-gray-50 p-4 rounded-lg text-center border border-dashed border-gray-200">No recent activity</p>
            </div>
        </MotionWrapper>
    );
}
