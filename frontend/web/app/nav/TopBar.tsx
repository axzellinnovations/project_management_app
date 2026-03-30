'use client';
import { useState, useEffect, useMemo, useSyncExternalStore, Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { getUserFromToken, User } from '@/lib/auth';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useNavigation } from '@/lib/navigation-context';
import { Menu } from 'lucide-react';
import api from '@/lib/axios';

const baseTabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'backlog', label: 'Backlog' },
    { id: 'board', label: 'Board' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'burndown', label: 'Burndown' },
    { id: 'chats', label: 'Chats' },
    { id: 'members', label: 'Members' },
    { id: 'pages', label: 'Pages' },
    { id: 'list', label: 'List' },
];

const subscribeToBrowserStorage = (onStoreChange: () => void) => {
    if (typeof window === 'undefined') {
        return () => {};
    }

    const handler = () => onStoreChange();
    window.addEventListener('storage', handler);
    window.addEventListener('focus', handler);

    return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener('focus', handler);
    };
};

function TopBarContent() {
    const projectName = useSyncExternalStore(
        subscribeToBrowserStorage,
        () => localStorage.getItem('currentProjectName') || 'Project Name',
        () => 'Project Name'
    );
    const storedProjectId = useSyncExternalStore(
        subscribeToBrowserStorage,
        () => localStorage.getItem('currentProjectId'),
        () => null
    );
    const token = useSyncExternalStore<string | null>(
        subscribeToBrowserStorage,
        () => localStorage.getItem('token'),
        () => null
    );
        const user = useMemo<User | null>(() => {
            if (!token) return null;
            return getUserFromToken();
        }, [token]);

    const { toggleSidebar } = useNavigation();
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const params = useParams();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
            return profilePicUrl;
        }
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl, API_BASE_URL]);

    const projectId = useMemo(() => {
        const queryProjectId = searchParams.get('projectId');
        const routeProjectId = typeof params?.id === 'string' ? params.id : null;

        return queryProjectId || routeProjectId || storedProjectId;
    }, [params, searchParams, storedProjectId]);

    const activeTab = useMemo(() => {
        if (pathname.startsWith('/calendar')) {
            return 'calendar';
        }

        if (pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board')) {
            return 'board';
        }

        if (pathname.startsWith('/timeline')) {
            return 'timeline';
        }

        if (pathname.startsWith('/sprint-backlog')) {
            return 'backlog';
        }

        if (pathname.startsWith('/project/') && pathname.includes('/chat')) {
            return 'chats';
        }

        if (pathname.startsWith('/pages')) {
            return 'pages';
        }

        if (pathname.startsWith('/spaces') || pathname.startsWith('/folders')) {
            return 'list';
        }

        if (pathname.startsWith('/summary')) {
            return 'summary';
        }

        return 'summary';
    }, [pathname]);

    useEffect(() => {
        if (projectId && localStorage.getItem('currentProjectId') !== projectId) {
            localStorage.setItem('currentProjectId', projectId);
        }

        const fetchProjectStatus = async () => {
            if (!projectId) {
                setIsFavorite(false);
                return;
            }

            try {
                const response = await api.get(`/api/projects/${projectId}`);
                setIsFavorite(Boolean(response.data?.isFavorite));
            } catch {
                setIsFavorite(false);
            }
        };

        void fetchProjectStatus();
    }, [projectId]);

    useEffect(() => {
        if (user?.email) {
            const loadProfilePic = async () => {
                try {
                    const response = await api.get('/api/auth/users');
                    interface UserSummary {
                        email: string;
                        profilePicUrl?: string;
                    }

                    const currentUser = response.data.find(
                        (u: UserSummary) => u.email.toLowerCase() === user.email.toLowerCase()
                    );
                    if (currentUser?.profilePicUrl) {
                        setProfilePicUrl(currentUser.profilePicUrl);
                    }
                } catch {
                    // Silently fail
                }
            };
            void loadProfilePic();
        }
    }, [user]);

    const withProjectId = (basePath: string) => {
        if (!projectId) return basePath;
        return `${basePath}?projectId=${projectId}`;
    };

    const getTabHref = (tabId: string) => {
        switch (tabId) {
            case 'summary':
                return projectId ? `/summary/${projectId}` : '/dashboard';
            case 'timeline':
                return withProjectId('/timeline');
            case 'backlog':
                return withProjectId('/sprint-backlog');
            case 'board':
                return withProjectId('/kanban');
            case 'calendar':
                return withProjectId('/calendar');
            case 'chats':
                return projectId ? `/project/${projectId}/chat` : '/dashboard';
            case 'members':
                return projectId ? `/summary/${projectId}` : '/dashboard';
            case 'pages':
                return withProjectId('/pages');
            case 'list':
                return '/spaces';
            default:
                return projectId ? `/summary/${projectId}` : '/dashboard';
        }
    };

    const isProjectPage = useMemo(() => {
        const projectPaths = [
            '/summary',
            '/timeline',
            '/sprint-backlog',
            '/kanban',
            '/calendar',
            '/burndown',
            '/pages',
            '/project/',
        ];
        return projectPaths.some(path => pathname.startsWith(path));
    }, [pathname]);

    if (!isProjectPage) {
        return (
            <div className="w-full h-[64px] bg-[#F1F6F9] border-b border-[#E3E8EF] px-4 sm:px-8 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    {/* Hamburger Menu (Mobile Only) */}
                    <button 
                        onClick={toggleSidebar}
                        className="lg:hidden p-2 -ml-2 text-[#6A7282] hover:bg-gray-200/50 rounded-lg transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu size={20} />
                    </button>
                    <span className="font-arimo text-[16px] font-semibold text-[#1D293D]">Dashboard</span>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {resolvedProfilePicUrl ? (
                            <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white">
                                <Image
                                    src={resolvedProfilePicUrl}
                                    alt="Profile"
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-[12px] font-bold">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-600 font-bold">+2</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-[119px] relative flex flex-col shrink-0">
            {/* Top Header Section (74px) */}
            <div className="flex-1 bg-[#F1F6F9] px-4 sm:px-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {/* Hamburger Menu (Mobile Only) */}
                    <button 
                        onClick={toggleSidebar}
                        className="lg:hidden p-2 -ml-2 text-[#6A7282] hover:bg-gray-200/50 rounded-lg transition-colors"
                        aria-label="Toggle Sidebar"
                    >
                        <Menu size={20} />
                    </button>

                    {/* Icon */}
                    <div className="w-10 h-10 bg-[#00D3F3] rounded-lg flex items-center justify-center shrink-0">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 2.5L16.6667 6.66667V13.3333L10 17.5L3.33333 13.3333V6.66667L10 2.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <div className="flex flex-col">
                        <span className="font-arimo text-[12px] uppercase tracking-[0.3px] text-[#6A7282] mb-0.5">Projects</span>
                        <div className="flex items-center gap-2">
                            <span className="font-arimo text-[19px] text-[#1D293D] whitespace-nowrap">{projectName}</span>
                            
                            {/* Favorite Toggle Icon */}
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={async () => {
                                    if (!projectId) return;
                                    const nextState = !isFavorite;
                                    setIsFavorite(nextState);
                                    try {
                                        await api.post(`/api/projects/${projectId}/favorite`);
                                        // Notify sidebar to re-fetch favourites immediately
                                        window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                                    } catch (e) {
                                        setIsFavorite(!nextState);
                                    }
                                }}
                                className="ml-1"
                            >
                                <motion.svg
                                    animate={{ 
                                        fill: isFavorite ? "#FFD700" : "transparent",
                                        stroke: isFavorite ? "#FFD700" : "#6A7282",
                                        scale: isFavorite ? [1, 1.3, 1] : 1
                                    }}
                                    transition={{ duration: 0.3 }}
                                    width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </motion.svg>
                            </motion.button>

                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-1">
                                <path d="M4 6L8 10L12 6" stroke="#1D293D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                        {resolvedProfilePicUrl ? (
                            <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white">
                                <Image
                                    src={resolvedProfilePicUrl}
                                    alt="Profile"
                                    width={32}
                                    height={32}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-[12px] font-bold">
                                {user?.username?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        )}
                        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-[10px] text-gray-600 font-bold">+2</div>
                    </div>
                </div>
            </div>

            {/* Bottom Nav Section (45px) */}
            <div className="h-[45px] bg-white border-b border-[#E3E8EF] px-8 flex items-end gap-8 overflow-x-auto no-scrollbar">
                {baseTabs.map((tab) => (
                    <Link
                        key={tab.id}
                        href={getTabHref(tab.id)}
                        className="relative pb-3 px-1 shrink-0"
                    >
                        <span
                            className={`font-inter text-[14px] leading-[20px] transition-colors duration-200 ${activeTab === tab.id
                                ? 'text-[#101828] font-semibold'
                                : 'text-[#667085] font-medium hover:text-[#101828]'
                                }`}
                        >
                            {tab.label}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#155DFC] rounded-t-[2px]"
                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                        )}
                    </Link>
                ))}
            </div>
        </div>
    );

}

export default function TopBar() {
    return (
        <Suspense fallback={<div className="w-full h-[74px] bg-[#F1F6F9] border-b border-[#E3E8EF] px-4 sm:px-8 flex items-center shrink-0"><div className="animate-pulse bg-gray-200 h-4 w-32 rounded"></div></div>}>
            <TopBarContent />
        </Suspense>
    );
}
