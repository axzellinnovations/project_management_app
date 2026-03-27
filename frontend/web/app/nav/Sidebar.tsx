'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigation } from '@/lib/navigation-context';
import api from '@/lib/axios';

interface NavItemProps {
    label: string;
    href: string;
    icon: React.ReactNode;
    active?: boolean;
    badge?: number;
}

interface UserSummary {
    email: string;
    profilePicUrl?: string;
}

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

export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();
    const token = useSyncExternalStore<string | null>(
        subscribeToBrowserStorage,
        () => localStorage.getItem('token'),
        () => null
    );
    const user = useMemo<User | null>(() => {
        if (!token) return null;
        return getUserFromToken();
    }, [token]);
    const { isSidebarOpen, setSidebarOpen } = useNavigation();
    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const [recentProjects, setRecentProjects] = useState<any[]>([]);
    const [favoriteProjects, setFavoriteProjects] = useState<any[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);
    const [folderStats, setFolderStats] = useState({
        viewAll: 0,
        recent: 0,
        favorites: 0,
        shared: 0,
        trash: 0,
    });

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
            return profilePicUrl;
        }
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl, API_BASE_URL]);

    useEffect(() => {
        const userData = user;

        if (userData?.email) {
            const loadProfilePic = async () => {
                try {
                    const response = await api.get('/api/auth/users');
                    const currentUser = response.data.find(
                        (u: UserSummary) => u.email.toLowerCase() === userData.email.toLowerCase()
                    );
                    if (currentUser?.profilePicUrl) {
                        setProfilePicUrl(currentUser.profilePicUrl);
                    }
                } catch {
                    // Silently fail - just show initials
                }
            };
            loadProfilePic();
        }

        const fetchRecentProjects = async () => {
            try {
                const response = await api.get('/api/projects');
                const allProjects = response.data;
                setRecentProjects(allProjects.slice(0, 3));
                setFavoriteProjects(allProjects.filter((p: any) => p.isFavorite).slice(0, 3));
            } catch (error: any) {
                console.error("Failed to fetch recent projects for sidebar:", error.response?.data?.message || error.message);
            } finally {
                setLoadingProjects(false);
            }
        };

        void fetchRecentProjects();

        const loadFolderStats = async () => {
            if (typeof window === 'undefined') {
                setFolderStats({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 });
                return;
            }

            const projectId = new URLSearchParams(window.location.search).get('projectId')
                || localStorage.getItem('currentProjectId');

            if (!projectId) {
                setFolderStats({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 });
                return;
            }

            try {
                const docsRes = await api.get(`/api/projects/${projectId}/documents?includeDeleted=false`);
                const trashRes = await api.get(`/api/projects/${projectId}/documents?includeDeleted=true`);
                const docs = Array.isArray(docsRes.data) ? docsRes.data : [];
                const allDocs = Array.isArray(trashRes.data) ? trashRes.data : [];
                const now = Date.now();
                const recentWindow = 14 * 24 * 60 * 60 * 1000;
                const recentCount = docs.filter((doc: { createdAt: string }) => now - new Date(doc.createdAt).getTime() <= recentWindow).length;
                const trashCount = allDocs.filter((doc: { status?: string }) => doc.status === 'SOFT_DELETED').length;

                let favoriteIds: number[] = [];
                const raw = localStorage.getItem('dmsFavoriteDocumentIds');
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw) as number[];
                        favoriteIds = Array.isArray(parsed) ? parsed : [];
                    } catch {
                        favoriteIds = [];
                    }
                }

                const favoritesCount = docs.filter((doc: { id: number }) => favoriteIds.includes(doc.id)).length;
                const sharedCount = userData?.username
                    ? docs.filter((doc: { uploadedByName: string }) => doc.uploadedByName !== userData.username).length
                    : 0;

                setFolderStats({
                    viewAll: docs.length,
                    recent: recentCount,
                    favorites: favoritesCount,
                    shared: sharedCount,
                    trash: trashCount,
                });
            } catch {
                setFolderStats({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 });
            }
        };

        void loadFolderStats();
    }, [pathname, user]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        router.push('/login');
    };

    return (
        <>
            {/* Mobile Backdrop */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSidebarOpen(false)}
                        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[45] lg:hidden"
                    />
                )}
            </AnimatePresence>

            <motion.div 
                initial={false}
                animate={{ 
                    x: isMobile 
                        ? (isSidebarOpen ? 0 : -260) 
                        : 0 
                }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed lg:relative z-50 w-[260px] h-screen bg-white border-r border-[#E3E8EF] flex flex-col flex-shrink-0"
            >
            {/* Workspace Switcher */}
            <div className="h-[70px] flex items-center px-6 border-b border-[#F2F4F7]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#0052CC] to-[#0747A6] rounded-lg shadow-sm flex items-center justify-center">
                        <span className="text-white font-bold text-sm">W</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-arimo text-[14px] font-semibold text-[#101828] leading-tight">Workspace</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-auto text-[#6A7282]">
                        <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>

            {/* Main Navigation */}
            <div className="px-4 py-6 flex flex-col gap-1 overflow-y-auto flex-1">
                <NavItem label="For you" href="#" icon={<InboxIcon />} />
                <NavItem label="Dashboard" href="/dashboard" icon={<DashboardIcon />} />
                <NavItem label="Profile" href="/profile" icon={<ProfileIcon />} />

                <div className="mt-6 mb-2">
                    <div className="flex items-center justify-between px-2 mb-2 group cursor-pointer">
                        <div className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#99A1AF] transform rotate-90">
                                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <span className="font-arimo text-[11px] font-bold text-[#99A1AF] uppercase tracking-wider">PROJECTS</span>
                        </div>
                        <button 
                            onClick={() => router.push('/createProject')}
                            className="text-[#99A1AF] hover:text-[#0052CC] transition-colors p-1 rounded hover:bg-gray-100"
                        >
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6 2.5V9.5M2.5 6H9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex flex-col gap-1">
                        {loadingProjects ? (
                            <div className="px-3 py-2 animate-pulse flex flex-col gap-2">
                                <div className="h-3 w-20 bg-gray-100 rounded" />
                                <div className="h-3 w-24 bg-gray-100 rounded" />
                            </div>
                        ) : recentProjects.length > 0 ? (
                            recentProjects.map((project) => (
                                <Link 
                                    key={project.id} 
                                    href="/summary"
                                    onClick={async () => {
                                        try {
                                            await api.post(`/api/projects/${project.id}/access`);
                                        } catch (e) {}
                                        localStorage.setItem('currentProjectName', project.name);
                                        localStorage.setItem('currentProjectId', project.id.toString());
                                    }}
                                >
                                    <ProjectItem 
                                        label={`${project.projectKey || ''} - ${project.name}`}
                                        color={Math.abs(project.id.toString().split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0)) % 2 === 0 ? 'bg-blue-500' : 'bg-purple-500'}
                                        active={false} 
                                    />
                                </Link>
                            ))
                        ) : (
                            <div className="px-2 py-1 text-[12px] text-[#99A1AF] italic">No projects</div>
                        )}
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        type="button"
                        onClick={() => setIsFoldersExpanded((prev) => !prev)}
                        className="w-full flex items-center gap-1 px-2 mb-2 group cursor-pointer"
                    >
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            className={`text-[#99A1AF] transform transition-transform ${isFoldersExpanded ? 'rotate-90' : 'rotate-0'}`}
                        >
                            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-arimo text-[11px] font-bold text-[#99A1AF] uppercase tracking-wider">FOLDERS</span>
                    </button>
                    {isFoldersExpanded && (
                        <div className="flex flex-col gap-1">
                            <NavItem label="View all" href="/folders/view-all" icon={<FolderIcon />} badge={folderStats.viewAll} active={pathname === '/folders/view-all'} />
                            <NavItem label="Recent" href="/folders/recent" icon={<ClockIcon />} badge={folderStats.recent} active={pathname === '/folders/recent'} />
                            <NavItem label="Favorites" href="/folders/favorites" icon={<StarIcon />} badge={folderStats.favorites} active={pathname === '/folders/favorites'} />
                            <NavItem label="Shared" href="/folders/shared" icon={<UsersIcon />} badge={folderStats.shared} active={pathname === '/folders/shared'} />
                            <NavItem label="Trash" href="/folders/trash" icon={<TrashIcon />} badge={folderStats.trash} active={pathname === '/folders/trash'} />
                        </div>
                    )}
                </div>

                <div className="mt-4">
                    <div className="flex items-center gap-1 px-2 mb-2 group cursor-pointer">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-[#99A1AF] transform rotate-90">
                            <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="font-arimo text-[11px] font-bold text-[#99A1AF] uppercase tracking-wider">FAVORITES</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {loadingProjects ? (
                            <div className="px-3 py-2 animate-pulse flex flex-col gap-2">
                                <div className="h-3 w-20 bg-gray-100 rounded" />
                            </div>
                        ) : favoriteProjects.length > 0 ? (
                            favoriteProjects.map((project) => (
                                <Link 
                                    key={project.id} 
                                    href="/summary"
                                    onClick={async () => {
                                        try {
                                            await api.post(`/api/projects/${project.id}/access`);
                                        } catch (e) {}
                                        localStorage.setItem('currentProjectName', project.name);
                                        localStorage.setItem('currentProjectId', project.id.toString());
                                    }}
                                >
                                    <FavoriteItem label={`${project.projectKey || ''} - ${project.name}`} />
                                </Link>
                            ))
                        ) : (
                            <div className="px-2 py-1 text-[12px] text-[#99A1AF] italic">No favorites</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Bottom User Section */}
            <div className="mt-auto p-4 border-t border-[#F2F4F7]">
                <div className="flex items-center gap-3">
                    <Link href="/profile" className="flex items-center gap-3 min-w-0 flex-1 rounded-md px-1 py-1 hover:bg-[#F9FAFB] transition-colors">
                        <div className="w-9 h-9 rounded-full bg-[#F2F4F7] flex items-center justify-center text-[#4A5565] font-semibold text-sm overflow-hidden border border-[#E3E8EF]">
                            {resolvedProfilePicUrl ? (
                                <Image
                                    src={resolvedProfilePicUrl}
                                    alt="Profile"
                                    width={36}
                                    height={36}
                                    className="w-full h-full object-cover"
                                    unoptimized
                                />
                            ) : (
                                <span>{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                            )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[14px] font-medium text-[#101828] truncate">{user?.username || 'Guest'}</span>
                            <span className="text-[12px] text-[#6A7282] truncate" title={user?.email}>{user?.email || 'Please login'}</span>
                        </div>
                    </Link>
                    <button onClick={handleLogout} className="ml-auto text-[#6A7282] hover:text-red-500 transition-colors" title="Logout">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M10 17l5-5-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>
            </div>
        </motion.div>
        </>
    );
}

function NavItem({ label, href, icon, active, badge }: NavItemProps) {
    return (
        <Link href={href} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${active ? 'bg-[#EFF6FF] text-[#0052CC]' : 'text-[#4A5565] hover:bg-[#F9FAFB] hover:text-[#101828]'}`}>
            {icon}
            <span className="font-arimo text-[14px] font-medium">{label}</span>
            {badge && (
                <span className="ml-auto bg-[#F2F4F7] text-[#4A5565] text-[11px] px-2 py-0.5 rounded text-center min-w-[24px] font-medium">{badge}</span>
            )}
        </Link>
    )
}

function ProjectItem({ label, color, active = false }: { label: string; color: string; active?: boolean }) {
    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 ${active ? 'bg-[#EFF6FF]' : 'hover:bg-[#F9FAFB]'}`}>
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="font-arimo text-[13px] text-[#4A5565] truncate">{label}</span>
        </div>
    );
}

function FavoriteItem({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-200 hover:bg-[#F9FAFB]">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className="text-[#F59E0B] flex-shrink-0">
                <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" />
            </svg>
            <span className="font-arimo text-[13px] text-[#4A5565] truncate">{label}</span>
        </div>
    );
}

// Icons
const DashboardIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="11" y="3" width="6" height="6" rx="1" /><rect x="3" y="11" width="6" height="6" rx="1" /><rect x="11" y="11" width="6" height="6" rx="1" /></svg>;
const InboxIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h12v12H4z" /><path d="M4 8l8 5 8-5" /></svg>;
const ProfileIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="6" r="3" /><path d="M4 16c1.2-2.7 3.5-4 6-4s4.8 1.3 6 4" /></svg>;
const FolderIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h4l1.5 2h6.5A1.5 1.5 0 0 1 17.5 8.5v6A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8z" /></svg>;
const ClockIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7" /><path d="M10 6.5v4l2.5 1.5" /></svg>;
const StarIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" /></svg>;
const UsersIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="7" cy="7" r="2.5" /><circle cx="13.5" cy="8" r="2" /><path d="M3.5 15c.8-2 2.5-3 4.7-3s3.9 1 4.7 3" /><path d="M12.2 14.5c.5-1.2 1.5-1.9 2.9-1.9 1.4 0 2.4.7 2.9 1.9" /></svg>;
const TrashIcon = () => <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 5.5h13" /><path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" /><path d="M6 5.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 14 15.5v-10" /><path d="M8.5 8.5v5" /><path d="M11.5 8.5v5" /></svg>;
