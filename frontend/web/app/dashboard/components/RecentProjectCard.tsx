'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';

interface RecentProjectCardProps {
    id: string;
    name: string;
    projectKey?: string;
    description?: string;
    iconText?: string;
    type?: string;
    boardCount?: number;
    width?: string;
    isFavorite?: boolean;
    onFavoriteToggle?: (isFavorite: boolean) => void;
}

export default function RecentProjectCard({
    id,
    name,
    projectKey,
    type = "Team-managed software",
    width,
    isFavorite: initialIsFavorite = false,
    onFavoriteToggle
}: RecentProjectCardProps) {
    const router = useRouter();
    const [isFavorite, setIsFavorite] = useState(initialIsFavorite);

    useEffect(() => {
        setIsFavorite(initialIsFavorite);
    }, [initialIsFavorite]);

    const handleFavoriteClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const nextState = !isFavorite;
        setIsFavorite(nextState);
        try {
            await api.post(`/api/projects/${id}/favorite`);
            window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
            if (onFavoriteToggle) onFavoriteToggle(nextState);
        } catch (error) {
            console.error("Failed to toggle favorite:", error);
            setIsFavorite(!nextState); // Revert on failure
        }
    };

    const recordProjectAccess = async () => {
        try {
            await api.post(`/api/projects/${id}/access`);
        } catch (error) {
            console.error("Failed to record access:", error);
        }
    };

    const handleCardClick = async () => {
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);
        router.push(`/summary/${id}`);
    };

    // Subtext like "SINTHU • V1.0"
    const displaySubtext = `${projectKey ? projectKey : name.substring(0, 4)} • ${type === 'AGILE' || type === 'Agile Scrum' ? 'Agile' : 'Kanban'}`.toUpperCase();

    // Helper function to generate a consistent soft color stripe based on project name
    const getColorStripe = (str: string) => {
        const colors = [
            'bg-[#E6FCFF]', // Cyan (var(--ds-background-accent-teal-subtlest))
            'bg-[#EAE6FF]', // Purple (var(--ds-background-accent-purple-subtlest))
            'bg-[#E3FCEF]', // Green (var(--ds-background-accent-green-subtlest))
            'bg-[#FFEBE6]', // Red (var(--ds-background-accent-red-subtlest))
            'bg-[#FFFAE6]', // Yellow (var(--ds-background-accent-yellow-subtlest))
            'bg-[#DEEBFF]', // Blue (var(--ds-background-accent-blue-subtlest))
        ];
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const stripeColor = getColorStripe(name || id);

    return (
        <div 
            onClick={handleCardClick}
            className={`group flex flex-row ${width || 'min-w-[260px] max-w-[260px]'} h-[160px] shrink-0 bg-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-[0_6px_16px_rgba(0,82,204,0.08)] hover:border-[#0052CC]/20 hover:-translate-y-[2px]`}
        >
            {/* Colored Left Stripe */}
            <div className={`w-[16px] h-full shrink-0 ${stripeColor}`} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 py-5 pr-5 pl-4 relative h-full">
                {/* Top Bar: Subtext and Star */}
                <div className="flex justify-between items-start w-full">
                    <span className="font-arimo text-[12px] font-bold text-[#6B7280] tracking-wider uppercase group-hover:text-[#0052CC]/70 transition-colors">
                        {displaySubtext}
                    </span>

                    <button
                        onClick={handleFavoriteClick}
                        className={`transition-colors z-10 p-1 -mr-1 -mt-1 ${isFavorite ? 'text-[#F5A623]' : 'text-gray-400 hover:text-[#F5A623]'}`}
                    >
                        <svg
                            width="18" height="18" viewBox="0 0 24 24"
                            fill={isFavorite ? "currentColor" : "transparent"}
                            stroke="currentColor"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                </div>

                {/* Title */}
                <h3 className="font-arimo text-[18px] leading-[24px] text-[#111827] font-bold mt-2 line-clamp-2 group-hover:text-[#0052CC] transition-colors">
                    {name}
                </h3>

                {/* Bottom Section (Divider + Icons) */}
                <div className="mt-auto">
                    <div className="w-full h-[1px] bg-gray-100 mb-4 group-hover:bg-[#0052CC]/10 transition-colors" />
                    <div className="flex items-center justify-between">
                        {/* Icons */}
                        <div className="flex items-center gap-4 text-[#9CA3AF] group-hover:text-[#0052CC]/60 transition-colors">
                            {/* Users icon */}
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </div>

                        {/* Open Text */}
                        <span className="font-arimo text-[12px] font-bold text-[#6B7280] tracking-widest uppercase group-hover:text-[#0052CC] transition-colors">
                            OPEN
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
