'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface RecentProjectCardProps {
    id: string;
    name: string;
    description?: string;
    iconText?: string;
    type?: string;
    boardCount?: number;
}

export default function RecentProjectCard({
    id,
    name,
    description = "Team-managed software",
    iconText,
    type = "Team-managed software",
    boardCount = 1
}: RecentProjectCardProps) {
    const router = useRouter();
    const displayIconText = iconText || name.substring(0, 2).toUpperCase();

    const handleCardClick = () => {
        localStorage.setItem('currentProjectName', name);
        localStorage.setItem('currentProjectId', id);
        router.push(`/summary`);
    };

    return (
        <div
            onClick={handleCardClick}
            className="group relative w-full h-[221.6px] bg-[#ECFEFF] border border-[#E5E7EB] rounded-[4px] p-[16.8px] flex flex-col cursor-pointer hover:shadow-sm transition-all"
        >
            {/* Header Section */}
            <div className="flex gap-3 items-start mb-auto">
                {/* Project Icon */}
                <div className="w-8 h-8 bg-[#00B8DB] rounded-[4px] flex items-center justify-center shrink-0">
                    <span className="font-arimo text-[16px] text-white font-normal">
                        {displayIconText}
                    </span>
                </div>

                {/* Project Titles */}
                <div className="flex flex-col overflow-hidden">
                    <h3 className="font-arimo text-[16px] leading-[24px] text-[#101828] truncate">
                        {name}
                    </h3>
                    <p className="font-arimo text-[16px] leading-[24px] text-[#4A5565] truncate">
                        {type}
                    </p>
                </div>
            </div>

            {/* Links Section */}
            <div className="flex flex-col gap-2 mb-[16px]">
                <Link
                    href={`/summary`}
                    onClick={(e) => {
                        e.stopPropagation();
                        localStorage.setItem('currentProjectName', name);
                        localStorage.setItem('currentProjectId', id);
                    }}
                    className="font-arimo text-[16px] text-[#4A5565] hover:text-[#0052CC] hover:underline"
                >
                    Summary page
                </Link>

                <div className="flex justify-between items-center">
                    <span className="font-arimo text-[16px] text-[#364153] opacity-60 cursor-not-allowed">
                        Sprint backlog
                    </span>
                    {/* Placeholder for future icon if needed */}
                </div>

                <span className="font-arimo text-[16px] text-[#364153] opacity-60 cursor-not-allowed">
                    Members Page
                </span>
            </div>

            {/* Footer Section */}
            <div className="flex items-center gap-2">
                <span className="font-arimo text-[16px] text-[#364153]">
                    {boardCount} board
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <rect x="3" y="3" width="10" height="10" stroke="#364153" strokeWidth="1.33333" />
                </svg>
            </div>
        </div>
    );
}
