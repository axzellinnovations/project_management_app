'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import api from '@/lib/axios';
import { ProjectTypeIcon, isAgileProjectType } from '@/components/shared/ProjectTypeIcon';

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
    const isAgileProject = isAgileProjectType(type);

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
        
        if (isAgileProject) {
            router.push(`/sprint-board?projectId=${id}`);
        } else {
            router.push(`/kanban?projectId=${id}`);
        }
    };

    // Subtext like "SINTHU • V1.0"
    const displaySubtext = `${projectKey ? projectKey : name.substring(0, 4)} • ${isAgileProject ? 'Agile' : 'Kanban'}`.toUpperCase();

    const boardButtonTitle = isAgileProject ? 'View Sprint Board' : 'View Kanban Board';
    const boardButtonClassName = isAgileProject
        ? 'w-[32px] h-[32px] flex items-center justify-center bg-indigo-50/50 text-indigo-500 rounded-lg border border-indigo-100/50 shadow-sm transition-all duration-300 hover:bg-indigo-500 hover:text-white hover:scale-110 hover:shadow-indigo-200/50'
        : 'w-[32px] h-[32px] flex items-center justify-center bg-emerald-50/50 text-emerald-500 rounded-lg border border-emerald-100/50 shadow-sm transition-all duration-300 hover:bg-emerald-500 hover:text-white hover:scale-110 hover:shadow-emerald-200/50';

    const handleMembersClick = async (e: React.MouseEvent) => {
        e.stopPropagation();
        await recordProjectAccess();
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        localStorage.setItem('currentProjectName', name);
        router.push(`/members/${id}`);
    };

    // Helper function to generate a consistent soft color stripe based on project name
    const getColorStripe = (str: string) => {
        const colors = [
            'bg-[#E6FCFF] dark:bg-cyan-950/30',
            'bg-[#EBF2FF] dark:bg-blue-950/30',
            'bg-[#E3FCEF] dark:bg-emerald-950/30',
            'bg-[#FFEBE6] dark:bg-red-950/30',
            'bg-[#FFFAE6] dark:bg-amber-950/30',
            'bg-[#DEEBFF] dark:bg-indigo-950/30',
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
            className={`group flex flex-row ${width ? width : 'min-w-[260px] max-w-[260px] shrink-0'} h-[160px] bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-gray-100/80 cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-[0_12px_24px_rgba(21,93,252,0.08)] hover:border-blue-200 hover:-translate-y-[3px] active:scale-[0.98] relative`}
        >
            {/* Glossy Backdrop Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-blue-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            {/* Colored Left Stripe */}
            <div className={`w-[8px] h-full shrink-0 ${stripeColor} transition-all duration-300 group-hover:w-[12px] opacity-80`} />

            {/* Main Content Area */}
            <div className="flex flex-col flex-1 py-4 pr-5 pl-4 relative h-full">
                {/* Top Bar: Subtext and Star */}
                <div className="flex justify-between items-start w-full">
                    <span className="font-arimo text-[11px] font-bold text-[#94a3b8] tracking-[0.05em] uppercase group-hover:text-blue-500 transition-colors duration-300">
                        {displaySubtext}
                    </span>

                    <button
                        onClick={handleFavoriteClick}
                        className={`transition-all duration-300 z-10 p-1.5 -mr-1.5 -mt-1.5 rounded-full hover:bg-amber-50 ${isFavorite ? 'text-[#F5A623] scale-110 shadow-sm' : 'text-slate-300 hover:text-[#F5A623]'}`}
                    >
                        <svg
                            width="16" height="16" viewBox="0 0 24 24"
                            fill={isFavorite ? "currentColor" : "transparent"}
                            stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                    </button>
                </div>

                {/* Title */}
                <h3 className="font-arimo text-[15px] leading-[22px] text-[#0f172a] font-bold mt-2 line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 tracking-tight">
                    {name}
                </h3>

                {/* Bottom Section (Divider + Icons) */}
                <div className="mt-auto">
                    <div className="flex items-center justify-between">
                        {/* Icons */}
                        <div className="flex items-center gap-2.5">
                            <button 
                                onClick={handleBoardClick}
                                title={boardButtonTitle}
                                className={boardButtonClassName}
                            >
                                <ProjectTypeIcon projectType={type} size={14} />
                            </button>

                            {/* Users icon - Navigates to Members */}
                            <button 
                                onClick={handleMembersClick}
                                title="Project Members"
                                className="w-[32px] h-[32px] flex items-center justify-center bg-slate-50/80 text-slate-400 rounded-lg border border-slate-100 transition-all duration-300 hover:bg-blue-500 hover:text-white hover:border-transparent hover:scale-110 hover:shadow-blue-200/50"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                    <circle cx="9" cy="7" r="4" />
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                </svg>
                            </button>
                        </div>

                        {/* Open Label */}
                        <div className="flex items-center px-2.5 py-1 rounded-md bg-slate-50 border border-slate-100 group-hover:bg-blue-600 group-hover:text-white group-hover:border-transparent transition-all duration-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                            <span className="font-arimo text-[10px] font-bold tracking-[0.1em] uppercase">
                                OPEN
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
