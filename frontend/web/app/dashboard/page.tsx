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
    const [projects, setProjects] = useState<{ recent: ProjectSummary[], favorites: ProjectSummary[] }>({ recent: [], favorites: [] });
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
                // Fetch recent and favorites in parallel. Much faster than fetching ALL projects.
                const [recentRes, favRes] = await Promise.all([
                    api.get('/api/projects/recent?limit=15'),
                    api.get('/api/projects/favorites')
                ]);
                setProjects({
                    recent: recentRes.data || [],
                    favorites: favRes.data || []
                });
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

        // Re-fetch when a project favourite is toggled from anywhere (e.g., TopBar)
        const handleFavToggled = () => { void fetchProjects(); };
        // Re-fetch when user returns from a project (summary page records access and fires this)
        const handleProjectAccessed = () => { void fetchProjects(); };
        window.addEventListener('planora:favorite-toggled', handleFavToggled);
        window.addEventListener('planora:project-accessed', handleProjectAccessed);
        return () => {
            window.removeEventListener('planora:favorite-toggled', handleFavToggled);
            window.removeEventListener('planora:project-accessed', handleProjectAccessed);
        };
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
            const scrollAmount = 284; // Card width (260) + Gap (24)
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
        }
    };

    const [recentSpacesSearch, setRecentSpacesSearch] = useState('');
    const [recentFilter, setRecentFilter] = useState<'recent' | 'favorites'>('recent');

    const sourceProjects = recentFilter === 'recent' ? projects.recent : projects.favorites;

    // De-duplicate if an item is both recent and favorite (already distinct lists, but just in case)
    const uniqueSource = Array.from(new Map(sourceProjects.map(p => [p.id, p])).values());

    const filteredRecentProjects = uniqueSource.filter(project =>
    (project.name.toLowerCase().includes(recentSpacesSearch.toLowerCase()) ||
        (project.projectKey && project.projectKey.toLowerCase().includes(recentSpacesSearch.toLowerCase())))
    );

    return (
        <div className="flex flex-col gap-4 w-full max-w-[1200px] mx-auto pb-12 mt-2">
            {/* Header */}
            <div className="w-full mt-2 lg:mt-0 flex items-center gap-3">
                <button 
                    onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
                    className="md:hidden p-1.5 -ml-1.5 text-[#4B5563] rounded-md hover:bg-gray-100 transition-colors"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <h1 className="font-arimo text-[16px] xl:text-[20px] leading-[24px] text-[#101828] font-semibold">
                    Welcome Back, {user?.username || 'User'}.
                </h1>
            </div>

            {/* Recent Spaces Section */}
            <div className="flex flex-col gap-4 pb-[0.8px] bg-white relative">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 w-full mt-2">
                    <div className="flex justify-between items-center w-full md:w-auto">
                        <h2 className="font-arimo text-[15px] font-semibold text-[#101828]">Recent spaces</h2>
                        <Link href="/spaces" className="md:hidden font-arimo text-[13px] font-medium text-[#0052CC] hover:text-[#0042a3]">View all</Link>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                            <div className="relative w-full sm:w-[220px]">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={recentSpacesSearch}
                                    onChange={(e) => setRecentSpacesSearch(e.target.value)}
                                    className="block w-full pl-9 pr-3 py-1.5 border border-[#E5E7EB] rounded-[4px] leading-5 bg-white placeholder-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[13px] font-arimo"
                                />
                            </div>
                            <div className="flex items-center bg-gray-100/80 p-1 rounded-md sm:bg-transparent sm:p-0 gap-1 w-full sm:w-auto mt-2 sm:mt-0">
                                <button
                                    onClick={() => setRecentFilter('recent')}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-[4px] font-arimo text-[13px] font-semibold transition-all ${recentFilter === 'recent'
                                            ? 'bg-white sm:bg-[#EAF2FF] text-[#0052CC] shadow-sm sm:shadow-none border border-gray-200/60 sm:border-transparent'
                                            : 'text-[#4B5563] hover:text-[#0052CC] border border-transparent'
                                        }`}
                                >
                                    Recent
                                </button>
                                <button
                                    onClick={() => setRecentFilter('favorites')}
                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-[4px] font-arimo text-[13px] font-semibold transition-all ${recentFilter === 'favorites'
                                            ? 'bg-white sm:bg-[#EAF2FF] text-[#0052CC] shadow-sm sm:shadow-none border border-gray-200/60 sm:border-transparent'
                                            : 'text-[#4B5563] hover:text-[#0052CC] border border-transparent'
                                        }`}
                                >
                                    Favourites
                                </button>
                            </div>
                        </div>
                        <Link href="/spaces" className="hidden md:block font-arimo text-[14px] font-medium text-[#0052CC] hover:text-[#0042a3] ml-2 shrink-0">View all spaces</Link>
                    </div>
                </div>

                {/* Spaces Cards - Horizontal Scroll Container */}
                <div className="relative w-full -mx-4 group mt-1">
                    
                    {/* Scroll Buttons - Centered on cards */}
                    <div className="absolute inset-x-0 h-[160px] pointer-events-none z-30">
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
                        className="flex gap-6 overflow-x-auto px-4 pt-2 pb-6 custom-scrollbar scroll-smooth"
                    >
                        {loading ? (
                            // Skeleton Loading UI - Shows 3 fake cards pulsing
                            Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex flex-col min-w-[260px] max-w-[260px] h-[160px] shrink-0 bg-white rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 overflow-hidden animate-pulse hidden md:flex p-5">
                                    {/* Top Bar Skeleton */}
                                    <div className="flex justify-between items-start w-full">
                                        <div className="h-3 w-20 bg-gray-200 rounded" />
                                        <div className="h-4 w-4 bg-gray-200 rounded-full" />
                                    </div>
                                    {/* Title Skeleton */}
                                    <div className="h-5 w-40 bg-gray-200 rounded mt-3" />
                                    {/* Footer Skeleton */}
                                    <div className="mt-auto">
                                        <div className="w-full h-[1px] bg-gray-100 mb-4" />
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-4">
                                                <div className="w-[18px] h-[18px] bg-gray-200 rounded" />
                                                <div className="w-[18px] h-[18px] bg-gray-200 rounded" />
                                                <div className="w-[18px] h-[18px] bg-gray-200 rounded" />
                                            </div>
                                            <div className="h-3 w-12 bg-gray-200 rounded" />
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : filteredRecentProjects.length > 0 ? (
                            <>
                                {filteredRecentProjects.slice(0, 5).map((project) => (
                                    <RecentProjectCard
                                        key={project.id}
                                        id={project.id.toString()}
                                        name={project.name}
                                        projectKey={project.projectKey}
                                        isFavorite={project.isFavorite}
                                        onFavoriteToggle={() => {
                                            // Emit event to trigger the main effect's handleFavToggled which refetches optimized lists
                                            window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                                        }}
                                        type={project.type === 'AGILE' ? 'Agile Scrum' : 'Kanban'}
                                        boardCount={1}
                                    />
                                ))}
                                {filteredRecentProjects.length > 5 && (
                                    <div 
                                        onClick={() => router.push('/spaces')}
                                        className="group flex flex-col justify-center items-center min-w-[260px] max-w-[260px] h-[160px] shrink-0 bg-gray-50/50 hover:bg-white rounded-[8px] border border-dashed border-gray-300 hover:border-[#0052CC]/30 hover:shadow-[0_4px_16px_rgba(0,82,204,0.06)] cursor-pointer transition-all duration-200 hover:-translate-y-[2px]"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-gray-100 mb-3 group-hover:bg-[#EAF2FF] group-hover:border-transparent transition-all duration-200">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0052CC" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M5 12h14" />
                                                <path d="M12 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                        <span className="font-arimo text-[15px] font-semibold text-[#4B5563] group-hover:text-[#0052CC] transition-colors">
                                            View all spaces
                                        </span>
                                        <span className="font-arimo text-[12px] text-[#9CA3AF] mt-1 font-medium">
                                            +{filteredRecentProjects.length - 5} more
                                        </span>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="flex-1 py-8 text-center bg-gray-50 rounded border border-dashed border-gray-300">
                                <p className="font-arimo text-[14px] text-[#6A7282]">
                                    {recentSpacesSearch ? `No results for "${recentSpacesSearch}"` : 'No spaces found for this tab'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Boards Section */}
            <div className="flex flex-col gap-4 md:gap-6 mt-2 md:mt-0">
                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end border-b-[0.8px] border-[#E5E7EB] pb-0 gap-4 md:gap-0">
                    <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0 whitespace-nowrap">
                        {['Worked on', 'Viewed', 'Assigned to me', 'Starred'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase().replaceAll(' ', '-'))}
                                className={`pb-2 relative font-arimo text-[15px] md:text-[16px] transition-colors ${activeTab === tab.toLowerCase().replaceAll(' ', '-')
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
                    <Link href="/createProject" className="text-[#0052CC] font-arimo text-[15px] md:text-[16px] font-medium hover:underline mb-2 shrink-0">+ Create new project</Link>
                </div>

                {/* Sub-header: Search */}
                <div className="relative w-full sm:w-[320px] shrink-0">
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
