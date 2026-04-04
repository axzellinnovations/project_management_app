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

    const handleBoardClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);
        
        if (type === 'AGILE' || type === 'Agile Scrum') {
            router.push(`/sprint-board?projectId=${id}`);
        } else {
            router.push(`/kanban?projectId=${id}`);
        }
    };

    // Subtext like "SINTHU • V1.0"
    const displaySubtext = `${projectKey ? projectKey : name.substring(0, 4)} • ${type === 'AGILE' || type === 'Agile Scrum' ? 'Agile' : 'Kanban'}`.toUpperCase();

    // Helper function to generate a consistent soft color stripe based on project name
    const getColorStripe = (str: string) => {
        const colors = [
            'bg-[#E6FCFF]', // Cyan
            'bg-[#EBF2FF]', // Blue (Primary Light)
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
            className={`group flex flex-row ${width ? width : 'min-w-[260px] max-w-[260px] shrink-0'} h-[160px] bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-[0_6px_16px_rgba(21,93,252,0.1)] hover:border-cu-primary/20 hover:-translate-y-[2px]`}
        >
            {/* Colored Left Stripe */}
            <div className={`w-[16px] h-full shrink-0 ${stripeColor}`} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 py-4 pr-5 pl-4 relative h-full">
                {/* Top Bar: Subtext and Star */}
                <div className="flex justify-between items-start w-full">
                    <span className="font-arimo text-[12px] font-bold text-[#6B7280] tracking-wider uppercase group-hover:text-cu-primary/70 transition-colors">
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
                <h3 className="font-arimo text-[16px] leading-[22px] text-[#111827] font-bold mt-1.5 line-clamp-2 group-hover:text-cu-primary transition-colors">
                    {name}
                </h3>

                {/* Bottom Section (Divider + Icons) */}
                <div className="mt-auto">
                    <div className="w-full h-[1px] bg-gray-100 mb-4 group-hover:bg-cu-primary/10 transition-colors" />
                    <div className="flex items-center justify-between">
                        {/* Icons */}
                        <div className="flex items-center gap-2">
                            {type === 'AGILE' || type === 'Agile Scrum' ? (
                                <div 
                                    onClick={handleBoardClick}
                                    className="w-[30px] h-[30px] flex items-center justify-center bg-indigo-50/80 text-indigo-600 rounded-md border border-indigo-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 hover:bg-indigo-100 hover:scale-105 hover:shadow-[0_4px_12px_rgba(99,102,241,0.15)] relative overflow-hidden group/icon cursor-pointer"
                                >
                                    <svg className="relative z-10 w-[15px] h-[15px] transition-transform duration-700 ease-in-out group-hover/icon:rotate-[180deg]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                                    </svg>
                                </div>
                            ) : (
                                <div 
                                    onClick={handleBoardClick}
                                    className="w-[30px] h-[30px] flex items-center justify-center bg-emerald-50/80 text-emerald-600 rounded-md border border-emerald-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 hover:bg-emerald-100 hover:scale-105 hover:shadow-[0_4px_12px_rgba(16,185,129,0.15)] relative overflow-hidden group/icon cursor-pointer"
                                >
                                    <svg className="relative z-10 w-[15px] h-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
                                        <path d="M8 7v9" strokeWidth="3" className="transition-all duration-500 ease-out group-hover/icon:-translate-y-1" />
                                        <path d="M16 7v6" strokeWidth="3" className="transition-all duration-500 ease-out delay-75 group-hover/icon:translate-y-2" />
                                    </svg>
                                </div>
                            )}

                            {/* Users icon */}
                            <div className="w-[30px] h-[30px] flex items-center justify-center bg-gray-50/80 text-[#9CA3AF] rounded-md border border-gray-100 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-300 group-hover:bg-blue-50/80 group-hover:text-blue-500 group-hover:border-blue-100 group-hover:scale-105">
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </div>
                        </div>

                        {/* Open Button */}
                        <div className="flex items-center px-2 py-1 rounded bg-white border border-gray-200 group-hover:border-cu-primary/30 group-hover:bg-cu-primary/5 transition-all">
                            <span className="font-arimo text-[11px] font-bold text-[#6B7280] tracking-widest uppercase group-hover:text-cu-primary">
                                OPEN
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
