'use client';

import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import RecentProjectCard from './RecentProjectCard';

interface ProjectSummary {
    id: number;
    name: string;
    projectKey?: string;
    isFavorite?: boolean;
    type: 'AGILE' | 'KANBAN' | string;
    lastAccessedAt?: string;
}

interface RecentSpacesCarouselProps {
    projects: ProjectSummary[];
    loading: boolean;
    searchQuery: string;
}

export default function RecentSpacesCarousel({ projects, loading, searchQuery }: RecentSpacesCarouselProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
            setShowLeftArrow(scrollLeft > 10);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
        }
    };

    useEffect(() => {
        const current = scrollRef.current;
        if (current) {
            current.addEventListener('scroll', handleScroll);
            // Initial check
            handleScroll();
            // Also check on resize
            window.addEventListener('resize', handleScroll);
        }
        return () => {
            if (current) {
                current.removeEventListener('scroll', handleScroll);
            }
            window.removeEventListener('resize', handleScroll);
        };
    }, [projects]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollRef.current) {
            const { clientWidth } = scrollRef.current;
            const scrollAmount = direction === 'left' ? -clientWidth * 0.8 : clientWidth * 0.8;
            scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    };

    if (loading) {
        return (
            <div className="flex gap-4 overflow-hidden py-1 w-full hide-scrollbar">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div 
                        key={i} 
                        className="flex flex-col p-5 h-[160px] min-w-[240px] rounded-2xl border border-[#E5E7EB] bg-white shadow-sm shrink-0"
                    >
                        {/* Skeleton Header: Icon + Type + Star */}
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex gap-3 items-center">
                                <div className="w-8 h-8 rounded-[4px] bg-gray-200 animate-pulse" />
                                <div className="w-20 h-3 bg-gray-200 rounded animate-pulse" />
                            </div>
                            <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                        </div>
                        
                        {/* Skeleton Body: Title */}
                        <div className="w-2/3 h-5 bg-gray-200 rounded animate-pulse mt-2 mb-auto" />
                        
                        {/* Skeleton Footer: Key + Boards */}
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-[#F3F4F6]">
                            <div className="w-12 h-3 bg-gray-200 rounded animate-pulse" />
                            <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (projects.length === 0) {
        return (
            <div className="w-full py-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
                <p className="font-arimo text-[14px] text-[#6A7282]">
                    {searchQuery ? `No results for "${searchQuery}"` : 'No spaces found for this tab'}
                </p>
            </div>
        );
    }

    return (
        <div className="relative group/carousel w-full mt-1">
            {/* Left Navigation Arrow */}
            {showLeftArrow && (
                <button
                    onClick={() => scroll('left')}
                    className="md:flex hidden absolute left-[-12px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg items-center justify-center text-[#101828] hover:bg-[#F3F4F6] transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
            )}

            {/* Carousel Container */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 md:px-0 hide-scrollbar scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', contentVisibility: 'auto', containIntrinsicSize: '0 160px' } as React.CSSProperties}
            >
                {/* Custom CSS for hiding scrollbar inline as fallback */}
                <style jsx>{`
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>

                {projects.slice(0, 5).map((project) => (
                    <RecentProjectCard
                        key={project.id}
                        id={project.id.toString()}
                        name={project.name}
                        projectKey={project.projectKey}
                        type={project.type}
                        isFavorite={project.isFavorite}
                        width="min-w-[240px] max-w-[240px]"
                    />
                ))}

                {/* Always show "View all" card if we have projects, as per user request */}
                <Link
                    href="/spaces"
                    className="group flex flex-col justify-center items-center min-w-[200px] h-[160px] bg-gray-50/50 hover:bg-white rounded-2xl border border-dashed border-gray-300 hover:border-[#0052CC]/30 hover:shadow-[0_8px_24px_rgba(0,82,204,0.08)] cursor-pointer transition-all duration-300 hover:-translate-y-[2px] shrink-0"
                >
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 mb-3 group-hover:bg-blue-600 group-hover:border-transparent transition-all duration-300 group-hover:scale-110">
                        <ArrowRight size={20} strokeWidth={2.5} className="text-[#0052CC] group-hover:text-white" />
                    </div>
                    <span className="font-arimo text-[15px] font-semibold text-[#4B5563] group-hover:text-[#0052CC] transition-colors">View all spaces</span>
                    {projects.length > 5 && (
                        <span className="font-arimo text-[12px] text-[#9CA3AF] mt-1 font-medium">+{projects.length - 5} more</span>
                    )}
                </Link>
            </div>

            {/* Right Navigation Arrow */}
            {showRightArrow && (
                <button
                    onClick={() => scroll('right')}
                    className="md:flex hidden absolute right-[-12px] top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white border border-gray-200 rounded-full shadow-lg items-center justify-center text-[#101828] hover:bg-[#F3F4F6] transition-all duration-200 hover:scale-110 active:scale-95"
                    aria-label="Scroll right"
                >
                    <ChevronRight size={20} strokeWidth={2.5} />
                </button>
            )}
        </div>
    );
}
