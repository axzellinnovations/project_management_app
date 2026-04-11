'use client';

import { RADIUS } from '@/hooks/useDonutChart';

export default function DonutEmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full min-h-[250px] w-full p-4">
            <div className="relative flex items-center justify-center w-40 h-40">
                <svg className="w-full h-full" viewBox="0 0 160 160">
                    <circle
                        cx="80" cy="80" r={RADIUS}
                        fill="none" stroke="#E5E7EB" strokeWidth="14"
                        strokeDasharray="4 8" strokeLinecap="round"
                    />
                </svg>
                <div className="absolute text-center flex flex-col items-center">
                    <span className="text-[28px] font-bold text-gray-300 font-sans leading-none">0</span>
                    <span className="text-[11px] font-medium text-gray-400 mt-1 uppercase tracking-widest">Tasks</span>
                </div>
            </div>
            <div className="mt-8 text-[13px] text-gray-400 font-medium tracking-wide">ZERO TASKS REQUIRED</div>
        </div>
    );
}
