'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import Link from 'next/link';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import RecentSpacesCarousel from './components/RecentSpacesCarousel';
import DashboardTable from './components/DashboardTable';
import WelcomeGreeting from '@/components/ui/WelcomeGreeting';

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
    const [activeTab, setActiveTab] = useState('assigned-to-me');
    const [projects, setProjects] = useState<{ recent: ProjectSummary[], favorites: ProjectSummary[] }>({ recent: [], favorites: [] });
    const [loading, setLoading] = useState(true);
    const [dashboardSearch, setDashboardSearch] = useState('');
    const [assignedCount, setAssignedCount] = useState(0);
    const [mobileSecondaryTab, setMobileSecondaryTab] = useState('worked-on');
    const [mobileTertiaryTab, setMobileTertiaryTab] = useState('favorites');

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
        <div className="flex flex-col gap-4 w-full max-w-[1200px] mx-auto pb-12 mt-0">
            {/* Header fold: Tightened gap */}
            <div className="w-full mt-1 lg:mt-0 flex items-center gap-3">
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
                <WelcomeGreeting username={user?.username || 'User'} />
            </div>

            {/* Recent Spaces Section */}
            <div className="flex flex-col gap-4 pb-[0.8px] bg-white relative mt-1">
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 w-full mt-1">
                    <div className="flex justify-between items-center w-full md:w-auto pl-1 h-5">
                        <h2 className="font-arimo text-[15px] font-bold text-[#101828] m-0 flex items-center h-full">Recent spaces</h2>
                        <Link href="/spaces" className="md:hidden font-arimo text-[13px] font-bold text-[#0052CC] hover:text-[#0042a3] m-0 flex items-center h-full leading-none">View all</Link>
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
                                    className={`flex-1 sm:flex-none px-3 py-1.5 h-[34px] rounded-[4px] font-arimo text-[13px] font-semibold transition-all ${recentFilter === 'favorites'
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

                {/* Recent Spaces Carousel */}
                <RecentSpacesCarousel 
                    projects={filteredRecentProjects} 
                    loading={loading} 
                    searchQuery={recentSpacesSearch}
                />
            </div>

            {/* Desktop View: Tabs */}
            <div className="hidden md:flex flex-col gap-4 md:gap-6 mt-2 md:mt-0">
                <div className="flex flex-col md:flex-row md:justify-between items-start md:items-end border-b-[0.8px] border-[#E5E7EB] pb-0 gap-4 md:gap-0">
                    <Link 
                        href="/createProject" 
                        className="order-last w-auto bg-transparent text-[#0052CC] font-arimo text-[14px] font-semibold hover:underline mb-2 shrink-0 flex items-center justify-center p-0 rounded-none shadow-none transition-all"
                    >
                        + Create new project
                    </Link>
                    <div className="flex flex-nowrap items-center gap-6 w-auto overflow-x-auto no-scrollbar pb-0">
                        {['Worked on', 'Viewed', 'Assigned to me', 'Favorites', 'Boards'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab.toLowerCase().replaceAll(' ', '-'))}
                                className={`pb-3 relative font-arimo text-[14px] transition-all duration-200 
                                    ${activeTab === tab.toLowerCase().replaceAll(' ', '-')
                                    ? 'text-[#101828] font-bold'
                                    : 'text-[#4A5565] hover:text-[#101828] font-medium'
                                    }`}
                            >
                                <span className="whitespace-nowrap">{tab}</span>
                                {tab === 'Assigned to me' && (
                                    <span className="ml-2 bg-[#E5E7EB] text-[#364153] text-[12px] px-1.5 rounded font-medium inline-block align-middle">{assignedCount}</span>
                                )}
                                {activeTab === tab.toLowerCase().replaceAll(' ', '-') && (
                                    <div className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[#0052CC] rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="relative w-[320px] shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#99A1AF" strokeWidth="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" /></svg>
                    </div>
                    <input
                        type="text"
                        placeholder="Search items..."
                        value={dashboardSearch}
                        onChange={(e) => setDashboardSearch(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2 h-[38px] border border-[#D1D5DC] rounded-[6px] leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-arimo shadow-sm"
                    />
                </div>

                <DashboardTable 
                    activeTab={activeTab} 
                    searchQuery={dashboardSearch} 
                    setDashboardAssignedCount={setAssignedCount} 
                />
            </div>

            {/* Mobile View: Priority Multi-section */}
            <div className="md:hidden flex flex-col gap-6 mt-4">
                <Link 
                    href="/createProject" 
                    className="w-full bg-[#0052CC] text-white font-arimo text-[15px] font-bold flex items-center justify-center py-3 rounded-[10px] shadow-md transition-all active:scale-[0.98]"
                >
                    + Create new project
                </Link>

                {/* Section 1: Assigned to Me (Static) */}
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-1">
                        <h2 className="font-arimo text-[16px] font-bold text-[#101828]">Assigned to me</h2>
                        <span className="bg-[#EAF2FF] text-[#0052CC] text-[12px] px-2 py-0.5 rounded-full font-bold">{assignedCount} pending</span>
                    </div>
                    <DashboardTable 
                        activeTab="assigned-to-me"
                        searchQuery="" // Keep primary section clean on mobile
                        setDashboardAssignedCount={setAssignedCount}
                    />
                </div>

                {/* Section 2: Recent Activity Toggle */}
                <div className="flex flex-col gap-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-arimo text-[15px] font-bold text-[#101828]">Recent Activity</h2>
                    </div>
                    <div className="flex items-center justify-center bg-gray-100/60 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setMobileSecondaryTab('worked-on')}
                            className={`flex-1 py-2.5 rounded-lg font-arimo text-[13px] font-bold transition-all ${mobileSecondaryTab === 'worked-on'
                                    ? 'bg-white text-[#101828] shadow-sm'
                                    : 'text-[#6B7280]'
                                }`}
                        >
                            Worked on
                        </button>
                        <button
                            onClick={() => setMobileSecondaryTab('viewed')}
                            className={`flex-1 py-2.5 rounded-lg font-arimo text-[13px] font-bold transition-all ${mobileSecondaryTab === 'viewed'
                                    ? 'bg-white text-[#101828] shadow-sm'
                                    : 'text-[#6B7280]'
                                }`}
                        >
                            Recently Viewed
                        </button>
                    </div>
                    <DashboardTable 
                        activeTab={mobileSecondaryTab} 
                        searchQuery={dashboardSearch} 
                    />
                </div>

                {/* Section 3: Organization Toggle */}
                <div className="flex flex-col gap-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-arimo text-[15px] font-bold text-[#101828]">Quick Access</h2>
                    </div>
                    <div className="flex items-center justify-center bg-gray-100/60 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setMobileTertiaryTab('favorites')}
                            className={`flex-1 py-2.5 rounded-lg font-arimo text-[13px] font-bold transition-all ${mobileTertiaryTab === 'favorites'
                                    ? 'bg-white text-[#101828] shadow-sm'
                                    : 'text-[#6B7280]'
                                }`}
                        >
                            Favorites
                        </button>
                        <button
                            onClick={() => setMobileTertiaryTab('boards')}
                            className={`flex-1 py-2.5 rounded-lg font-arimo text-[13px] font-bold transition-all ${mobileTertiaryTab === 'boards'
                                    ? 'bg-white text-[#101828] shadow-sm'
                                    : 'text-[#6B7280]'
                                }`}
                        >
                            Boards
                        </button>
                    </div>
                    <DashboardTable 
                        activeTab={mobileTertiaryTab} 
                        searchQuery="" 
                    />
                </div>
            </div>
        </div>
    );
}
