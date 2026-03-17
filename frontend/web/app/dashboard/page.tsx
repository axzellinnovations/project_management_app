'use client';

import { useEffect, useState, useRef } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import Link from 'next/link';
import api from '@/lib/axios';
import RecentProjectCard from './components/RecentProjectCard';
import { useRouter } from 'next/navigation';

interface ProjectSummary {
    id: number;
    name: string;
    projectKey?: string;
    isFavorite?: boolean;
    type: 'AGILE' | 'KANBAN' | string;
}

export default function DashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('worked-on');
    const [projects, setProjects] = useState<ProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);

    useEffect(() => {
        const userData = getUserFromToken();
        setUser(userData);

        if (!userData) {
            setLoading(false);
            router.replace('/login');
            return;
        }

        const fetchProjects = async () => {
            try {
                const response = await api.get('/api/projects');
                setProjects(response.data);
            } catch (error: unknown) {
                const status = (error as { response?: { status?: number } })?.response?.status;
                if (status !== 401 && status !== 403) {
                    console.error("Failed to fetch projects:", error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProjects();
    }, [router]);

    const checkScroll = () => {
        if (scrollContainerRef.current) {
            const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
            setShowLeftArrow(scrollLeft > 0);
            setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
        }
    };

    useEffect(() => {
        checkScroll();
        window.addEventListener('resize', checkScroll);
        return () => window.removeEventListener('resize', checkScroll);
    }, [projects]);

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = 612; // Card width (588) + Gap (24)
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const [recentSpacesSearch, setRecentSpacesSearch] = useState('');
    const [recentFilter, setRecentFilter] = useState<'recent' | 'favorites'>('recent');

    const filteredRecentProjects = projects.filter(project => 
        (recentFilter === 'favorites' ? project.isFavorite : true) &&
        (project.name.toLowerCase().includes(recentSpacesSearch.toLowerCase()) ||
        (project.projectKey && project.projectKey.toLowerCase().includes(recentSpacesSearch.toLowerCase())))
    );

    return (
        <div className="flex flex-col gap-8 w-full max-w-[1200px] mx-auto pb-12">
            {/* Header */}
            <div className="w-full">
                <h1 className="font-arimo text-[16px] leading-[24px] text-[#101828]">
                    Welcome Back, {user?.username || 'User'}.
                </h1>
            </div>

            {/* Recent Spaces Section */}
            <div className="flex flex-col gap-6 pb-[0.8px] border-b-[0.8px] border-[#E5E7EB] relative">
                <div className="flex justify-between items-center w-full">
                    <h2 className="font-arimo text-[16px] leading-[24px] text-[#101828]">Recent spaces</h2>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="relative w-[240px]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#99A1AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search recent spaces"
                                    value={recentSpacesSearch}
                                    onChange={(e) => setRecentSpacesSearch(e.target.value)}
                                    className="block w-full pl-9 pr-3 py-1.5 border border-[#D1D5DC] rounded-[4px] leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[14px] font-arimo"
                                />
                            </div>
                            <button 
                                onClick={() => setRecentFilter('recent')}
                                className={`px-3 py-1.5 rounded font-arimo text-[14px] font-medium border transition-all ${
                                    recentFilter === 'recent' 
                                    ? 'bg-blue-50 text-[#0052CC] border-[#0052CC]/10' 
                                    : 'text-[#4A5565] border-transparent hover:bg-gray-50'
                                }`}
                            >
                                Recent
                            </button>
                            <button 
                                onClick={() => setRecentFilter('favorites')}
                                className={`px-3 py-1.5 rounded font-arimo text-[14px] font-medium border transition-all ${
                                    recentFilter === 'favorites' 
                                    ? 'bg-blue-50 text-[#0052CC] border-[#0052CC]/10' 
                                    : 'text-[#4A5565] border-transparent hover:bg-gray-50'
                                }`}
                            >
                                Starred
                            </button>
                        </div>
                        <Link href="/spaces" className="font-arimo text-[16px] text-[#0052CC] hover:underline">View all spaces</Link>
                    </div>
                </div>

                {/* Spaces Cards - Horizontal Scroll Container */}
                <div className="relative group/nav">
                    {/* Scroll Buttons - Centered on cards */}
                    <div className="absolute inset-x-0 h-[221.6px] pointer-events-none z-20">
                        {/* Left Scroll Button */}
                        {showLeftArrow && (
                            <button
                                onClick={() => scroll('left')}
                                className="absolute left-[-20px] top-1/2 -translate-y-1/2 pointer-events-auto w-10 h-10 bg-white border border-[#E5E7EB] rounded-full shadow-lg flex items-center justify-center text-[#4A5565] hover:text-[#0052CC] transition-all"
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12.5 15L7.5 10L12.5 5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        )}

                        {/* Right Scroll Button */}
                        {showRightArrow && (
                            <button
                                onClick={() => scroll('right')}
                                className="absolute right-[-20px] top-1/2 -translate-y-1/2 pointer-events-auto w-10 h-10 bg-white border border-[#E5E7EB] rounded-full shadow-lg flex items-center justify-center text-[#4A5565] hover:text-[#0052CC] transition-all"
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M7.5 15L12.5 10L7.5 5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div
                        ref={scrollContainerRef}
                        onScroll={checkScroll}
                        className="flex gap-6 overflow-x-auto px-4 pb-6 scrollbar-hide scroll-smooth no-scrollbar"
                    >
                        {loading ? (
                            <div className="flex-1 py-8 text-center animate-pulse">
                                <p className="font-arimo text-[14px] text-[#6A7282]">Loading your spaces...</p>
                            </div>
                        ) : filteredRecentProjects.length > 0 ? (
                            filteredRecentProjects.map((project) => (
                                <RecentProjectCard
                                    key={project.id}
                                    id={project.id.toString()}
                                    name={project.name}
                                    projectKey={project.projectKey}
                                    isFavorite={project.isFavorite}
                                    onFavoriteToggle={() => {
                                        // Refresh projects to update other UI parts if needed
                                        const fetchProjects = async () => {
                                            const response = await api.get('/api/projects');
                                            setProjects(response.data);
                                        };
                                        fetchProjects();
                                    }}
                                    type={project.type === 'AGILE' ? 'Agile Scrum' : 'Kanban'}
                                    boardCount={1}
                                />
                            ))
                        ) : (
                                <div className="flex-1 py-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
                                    <p className="font-arimo text-[14px] text-[#6A7282]">
                                        {recentSpacesSearch ? `No results for "${recentSpacesSearch}"` : 'No recent spaces found'}
                                    </p>
                                </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Boards Section */}
            <div className="flex flex-col gap-6">
                <div className="flex justify-between items-center border-b-[0.8px] border-[#E5E7EB] pb-0">
                    <div className="flex items-center gap-6">
                        {['Worked on', 'Viewed', 'Assigned to me', 'Starred'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase().replaceAll(' ', '-'))}
                                className={`pb-2 relative font-arimo text-[16px] transition-colors ${activeTab === tab.toLowerCase().replaceAll(' ', '-')
                                    ? 'text-[#0052CC] font-medium'
                                    : 'text-[#4A5565] hover:text-[#101828]'
                                    }`}
                            >
                                {tab}
                                {tab === 'Assigned to me' && (
                                    <span className="ml-2 bg-[#E5E7EB] text-[#364153] text-[12px] px-1.5 rounded">0</span>
                                )}
                                {activeTab === tab.toLowerCase().replaceAll(' ', '-') && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0052CC]" />
                                )}
                            </button>
                        ))}
                    </div>
                    <Link href="/createProject" className="text-[#0052CC] font-arimo text-[16px] hover:underline mb-2">+ Create new project</Link>
                </div>

                {/* Sub-header: Search */}
                <div className="relative w-[320px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search boards"
                        className="block w-full pl-10 pr-3 py-2 border border-[#D1D5DC] rounded-[4px] leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-arimo"
                    />
                </div>

                {/* Table */}
                <div className="w-full">
                    <table className="min-w-full">
                        <thead>
                            <tr className="border-b-[0.8px] border-[#E5E7EB]">
                                <th className="py-2 w-[48px] text-left">
                                    <div className="w-5 h-5 bg-[#F0B100] border-2 border-[#F0B100] rounded-[2px]" />
                                </th>
                                <th className="py-2 text-left font-arimo text-[16px] font-bold text-[#364153]">Name</th>
                                <th className="py-2 text-left font-arimo text-[16px] font-bold text-[#364153]">Location</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* Empty State for Table */}
                            <tr>
                                <td colSpan={3} className="py-8 text-center border-b-[0.8px] border-[#E5E7EB]">
                                    <p className="font-arimo text-[14px] text-[#6A7282]">No boards found</p>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
