'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
import { getUserFromToken, User } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/axios';

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */
interface UserSummary { email: string; profilePicUrl?: string; }
interface Project { id: number; name: string; projectKey?: string; isFavorite?: boolean; }
interface ChatRoomSummary {
    roomId: number;
    roomName?: string;
    lastMessage?: string;
    lastMessageSender?: string;
    unseenCount?: number;
}
interface DirectMessageSummary {
    username: string;
    lastMessage?: string;
    lastMessageSender?: string;
    unseenCount?: number;
}
interface ChatSummaries {
    rooms: ChatRoomSummary[];
    directMessages: DirectMessageSummary[];
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'Unknown error';
}

/* storage sync helper */
const subscribeToBrowserStorage = (onChange: () => void) => {
    if (typeof window === 'undefined') return () => {};
    window.addEventListener('storage', onChange);
    window.addEventListener('focus', onChange);
    return () => {
        window.removeEventListener('storage', onChange);
        window.removeEventListener('focus', onChange);
    };
};

/* stable colour per project id */
const PROJECT_COLOURS = [
    'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
    'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500',
];
function projectColour(id: number) {
    return PROJECT_COLOURS[Math.abs(id) % PROJECT_COLOURS.length];
}

/* ─────────────────────────────────────────────
   Main Sidebar
───────────────────────────────────────────── */
export default function Sidebar() {
    const router = useRouter();
    const pathname = usePathname();

    const token = useSyncExternalStore<string | null>(
        subscribeToBrowserStorage,
        () => localStorage.getItem('token'),
        () => null,
    );
    const user = useMemo<User | null>(() => {
        if (!token) return null;
        return getUserFromToken();
    }, [token]);

    const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) return profilePicUrl;
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl, API_BASE_URL]);

    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [favoriteProjects, setFavoriteProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [togglingFavoriteId, setTogglingFavoriteId] = useState<number | null>(null);

    const [chatSummaries, setChatSummaries] = useState<ChatSummaries | null>(null);
    const [inboxOpen, setInboxOpen] = useState(false);
    const [inboxSearch, setInboxSearch] = useState('');
    const [loadingInbox, setLoadingInbox] = useState(false);

    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        let isCurrentlyMobile = window.innerWidth < 768;
        setIsMobile(isCurrentlyMobile);
        if (isCurrentlyMobile) {
            setCollapsed(true);
        }

        const handleResize = () => {
            const mobile = window.innerWidth < 768;
            if (mobile && !isCurrentlyMobile) {
                // Just crossed into mobile breakpoint
                setCollapsed(true);
            }
            if (mobile !== isCurrentlyMobile) {
                setIsMobile(mobile);
                isCurrentlyMobile = mobile;
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    /* collapse — default true (hidden) to prevent flash on first render; hydrated below */
    const [collapsed, setCollapsed] = useState(true);

    /* dropdown open state */
    const [favOpen, setFavOpen] = useState(false);
    const [recentOpen, setRecentOpen] = useState(false);
    const [favSearch, setFavSearch] = useState('');
    const [recentSearch, setRecentSearch] = useState('');

    /* folders */
    const [isFoldersExpanded, setIsFoldersExpanded] = useState(true);
    const [folderStats, setFolderStats] = useState({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 });

    /* refs for click-outside + anchor position */
    const favRef    = useRef<HTMLDivElement>(null);
    const recentRef = useRef<HTMLDivElement>(null);
    const inboxRef  = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

    /* ── fetch projects ── */
    const fetchProjects = useCallback(async () => {
        try {
            const [recentRes, favRes] = await Promise.all([
                api.get('/api/projects/recent?limit=10'),
                api.get('/api/projects/favorites'),
            ]);
            setRecentProjects(recentRes.data);
            setFavoriteProjects(favRes.data);
        } catch (error: unknown) {
            console.error('Sidebar: failed to fetch projects', getErrorMessage(error));
        } finally {
            setLoadingProjects(false);
        }
    }, []);

    /* ── fetch chats ── */
    const fetchChatSummaries = useCallback(async (projId: number) => {
        setLoadingInbox(true);
        try {
            const res = await api.get(`/api/projects/${projId}/chat/summaries`);
            setChatSummaries(res.data);
        } catch (error) {
            console.error('Sidebar: failed to fetch chat summaries', error);
        } finally {
            setLoadingInbox(false);
        }
    }, []);

    /* ── effects ── */
    useEffect(() => {
        if (!user?.email) return;
        api.get('/api/auth/users').then(res => {
            const found = res.data.find((u: UserSummary) => u.email.toLowerCase() === user.email.toLowerCase());
            if (found?.profilePicUrl) setProfilePicUrl(found.profilePicUrl);
        }).catch(() => {});
    }, [user]);

    // Hydrate persisted collapse preference.
    // On mobile: always start collapsed regardless of stored value to prevent sidebar flashing open.
    // On desktop: restore the user's saved preference.
    useEffect(() => {
        if (window.innerWidth >= 768) {
            setCollapsed(localStorage.getItem('planora:sidebar:collapsed') === 'true');
        }
        // On mobile: keep collapsed=true (initial state) — don't override with localStorage
    }, []);

    useEffect(() => { void fetchProjects(); }, [fetchProjects]); // fetch once on mount

    // Re-fetch with debounce when pathname changes (e.g. returning from a project to dashboard).
    // 600ms debounce ensures any in-flight DB writes complete before we read.
    useEffect(() => {
        const timer = setTimeout(() => void fetchProjects(), 600);
        return () => clearTimeout(timer);
    }, [pathname, fetchProjects]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let debounceTimer: ReturnType<typeof setTimeout>;
        const handleFavToggled = () => void fetchProjects();
        const handleProjectAccessed = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => void fetchProjects(), 400);
        };
        window.addEventListener('planora:favorite-toggled', handleFavToggled);
        window.addEventListener('planora:project-accessed', handleProjectAccessed);
        return () => {
            clearTimeout(debounceTimer);
            window.removeEventListener('planora:favorite-toggled', handleFavToggled);
            window.removeEventListener('planora:project-accessed', handleProjectAccessed);
        };
    }, [fetchProjects]);

    useEffect(() => {
        const projectId =
            (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('projectId'))
            || localStorage.getItem('currentProjectId')
            || (recentProjects.length > 0 ? recentProjects[0].id.toString() : null);

        if (!projectId) { 
            setFolderStats({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 }); 
            setChatSummaries(null);
            return; 
        }

        const pid = parseInt(projectId);
        void fetchChatSummaries(pid);

        Promise.all([
            api.get(`/api/projects/${projectId}/documents?includeDeleted=false`),
            api.get(`/api/projects/${projectId}/documents?includeDeleted=true`),
        ]).then(([docsRes, trashRes]) => {
            const docs = Array.isArray(docsRes.data) ? docsRes.data : [];
            const allDocs = Array.isArray(trashRes.data) ? trashRes.data : [];
            const recentWindow = 14 * 24 * 60 * 60 * 1000;
            const now = Date.now();
            const raw = typeof window !== 'undefined' ? localStorage.getItem('dmsFavoriteDocumentIds') : null;
            let favoriteIds: number[] = [];
            if (raw) { try { favoriteIds = JSON.parse(raw); } catch {} }
            setFolderStats({
                viewAll: docs.length,
                recent: docs.filter((d: { createdAt: string }) => now - new Date(d.createdAt).getTime() <= recentWindow).length,
                favorites: docs.filter((d: { id: number }) => favoriteIds.includes(d.id)).length,
                shared: user?.username ? docs.filter((d: { uploadedByName: string }) => d.uploadedByName !== user.username).length : 0,
                trash: allDocs.filter((d: { status?: string }) => d.status === 'SOFT_DELETED').length,
            });
        }).catch(() => setFolderStats({ viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 }));
    }, [pathname, user, recentProjects, fetchChatSummaries]);

    /* click-outside to close dropdowns */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            // check if click is inside either anchor OR inside a fixed dropdown
            const inFav    = favRef.current?.contains(target);
            const inRecent = recentRef.current?.contains(target);
            const inInbox  = inboxRef.current?.contains(target);
            // also check if click is inside a fixed dropdown portal (data attribute)
            const inDropdown = (target as Element)?.closest?.('[data-sidebar-dropdown]');
            if (!inFav && !inDropdown)    setFavOpen(false);
            if (!inRecent && !inDropdown) setRecentOpen(false);
            if (!inInbox && !inDropdown)  setInboxOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        
        const handleToggle = () => setCollapsed(prev => !prev);
        // Close sidebar on mobile when navigation happens (dispatched by NavigationContext)
        const handleClose = () => { if (window.innerWidth < 768) setCollapsed(true); };
        window.addEventListener('planora:sidebar:toggle', handleToggle);
        window.addEventListener('planora:sidebar:close', handleClose);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('planora:sidebar:toggle', handleToggle);
            window.removeEventListener('planora:sidebar:close', handleClose);
        };
    }, []);

    /* measure anchor position before opening dropdown */
    const openFavDropdown = () => {
        setRecentOpen(false);
        if (favRef.current) {
            const rect = favRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.top, left: rect.right + 8 });
        }
        setFavOpen(p => !p);
        setFavSearch('');
    };
    const openRecentDropdown = () => {
        setFavOpen(false);
        setInboxOpen(false);
        if (recentRef.current) {
            const rect = recentRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.top, left: rect.right + 8 });
        }
        setRecentOpen(p => !p);
        setRecentSearch('');
    };

    const openInboxDropdown = () => {
        setFavOpen(false);
        setRecentOpen(false);
        if (inboxRef.current) {
            const rect = inboxRef.current.getBoundingClientRect();
            setDropdownPos({ top: rect.top, left: rect.right + 8 });
        }
        setInboxOpen(p => !p);
        setInboxSearch('');
    };

    /* ── handlers ── */
    const handleLogout = () => { localStorage.removeItem('token'); router.push('/login'); };

    const handleProjectClick = async (project: Project) => {
        localStorage.setItem('currentProjectName', project.name);
        localStorage.setItem('currentProjectId', project.id.toString());
        try { await api.post(`/api/projects/${project.id}/access`); } catch {}
        window.dispatchEvent(new CustomEvent('planora:project-accessed'));
        setFavOpen(false);
        setRecentOpen(false);
    };

    const handleToggleFavourite = async (e: React.MouseEvent, project: Project) => {
        e.preventDefault(); e.stopPropagation();
        if (togglingFavoriteId === project.id) return;
        setTogglingFavoriteId(project.id);
        setFavoriteProjects(prev => prev.filter(p => p.id !== project.id));
        try {
            await api.post(`/api/projects/${project.id}/favorite`);
            window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
            await fetchProjects();
        } catch { await fetchProjects(); }
        finally { setTogglingFavoriteId(null); }
    };

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('planora:sidebar:collapsed', String(next));
            window.dispatchEvent(new CustomEvent('planora:sidebar:collapsed', { detail: { collapsed: next } }));
            return next;
        });
    };

    /* filtered lists (max 4 shown in dropdown) */
    const filteredFavs = favoriteProjects.filter(p =>
        p.name.toLowerCase().includes(favSearch.toLowerCase()) ||
        (p.projectKey || '').toLowerCase().includes(favSearch.toLowerCase())
    );
    const filteredRecent = recentProjects.filter(p =>
        p.name.toLowerCase().includes(recentSearch.toLowerCase()) ||
        (p.projectKey || '').toLowerCase().includes(recentSearch.toLowerCase())
    );

    /* ── render ── */
    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {isMobile && !collapsed && (
                <div 
                    className="fixed inset-0 bg-black/40 z-[90] md:hidden transition-opacity" 
                    onClick={() => setCollapsed(true)} 
                />
            )}
            
            <div
                className={`h-screen flex-shrink-0 z-[100] bg-white transition-all duration-300 ease-in-out ${isMobile ? 'fixed left-0 top-0' : 'relative'} ${isMobile && collapsed ? 'pointer-events-none' : ''}`}
                style={{ 
                    width: isMobile ? (collapsed ? '0px' : '260px') : (collapsed ? '64px' : '240px'),
                    opacity: isMobile && collapsed ? 0 : 1
                }}
            >
                <div className="h-full bg-white border-r border-[#E3E8EF] flex flex-col overflow-x-hidden w-[240px] md:w-[inherit]">

                    {/* ── Header: Planora logo + wordmark ── */}
                <div className="h-[56px] flex items-center border-b border-[#F2F4F7] flex-shrink-0"
                    style={{ justifyContent: collapsed ? 'center' : 'flex-start', paddingLeft: collapsed ? '0' : '12px' }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        {/* Logo */}
                        <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-gradient-to-br from-[#155DFC] to-[#0052CC] flex items-center justify-center shadow-sm shadow-blue-200">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <path d="M12 2L20 7V17L12 22L4 17V7L12 2Z" fill="white" fillOpacity="0.9" />
                                <path d="M12 6L16 8.5V13.5L12 16L8 13.5V8.5L12 6Z" fill="white" fillOpacity="0.45" />
                            </svg>
                        </div>
                        {/* Wordmark — fades out when collapsed */}
                        <span
                            className="font-arimo font-bold text-[16px] bg-gradient-to-r from-[#155DFC] to-[#0052CC] bg-clip-text text-transparent whitespace-nowrap overflow-hidden"
                            style={{
                                maxWidth: collapsed ? '0px' : '120px',
                                opacity: collapsed ? 0 : 1,
                                transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 180ms',
                            }}
                        >
                            Planora
                        </span>
                    </div>
                </div>

                {/* ── Floating collapse button — always on the right edge, vertically centred in header ── */}
                <button
                    onClick={toggleCollapsed}
                    title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    className="hidden md:flex absolute top-[14px] right-[-13px] z-50 w-[26px] h-[26px] items-center justify-center rounded-full bg-white border border-[#E3E8EF] shadow-md text-[#9AA3AE] hover:text-[#155DFC] hover:border-[#155DFC]/30 hover:shadow-blue-100 transition-all duration-150"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="1" y="1.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
                        <line x1="5" y1="1.5" x2="5" y2="14.5" stroke="currentColor" strokeWidth="1.4" />
                        <path
                            d={collapsed ? 'M8.5 10L11 8L8.5 6' : 'M10.5 10L8 8L10.5 6'}
                            stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
                        />
                    </svg>
                </button>

                {/* ── Nav body ── */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-0.5">

                    {/* For You */}
                    <NavRow
                        icon={<HomeIcon />}
                        label="For You"
                        collapsed={collapsed}
                        active={pathname === '/dashboard'}
                        onClick={() => { setFavOpen(false); setRecentOpen(false); router.push('/dashboard'); }}
                    />

                    {/* Favourites row + dropdown */}
                    <div ref={favRef} className="relative">
                        <NavRow
                            icon={<StarIcon className="text-amber-400" />}
                            label="Favourites"
                            collapsed={collapsed}
                            active={favOpen}
                            hasChevron
                            chevronOpen={favOpen}
                            onClick={openFavDropdown}
                        />
                    </div>

                    {/* Recent Spaces row + dropdown */}
                    <div ref={recentRef} className="relative">
                        <NavRow
                            icon={<ClockIcon />}
                            label="Recent Spaces"
                            collapsed={collapsed}
                            active={recentOpen}
                            hasChevron
                            chevronOpen={recentOpen}
                            onClick={openRecentDropdown}
                        />
                    </div>

                    {/* Inbox row + dropdown */}
                    <div ref={inboxRef} className="relative">
                        <NavRow
                            icon={<InboxIcon />}
                            label="Inbox"
                            collapsed={collapsed}
                            active={inboxOpen}
                            hasChevron
                            chevronOpen={inboxOpen}
                            onClick={openInboxDropdown}
                        />
                    </div>

                    {/* Profile */}
                    <NavRow
                        icon={<ProfileIcon />}
                        label="Profile"
                        collapsed={collapsed}
                        active={pathname === '/profile'}
                        onClick={() => { setFavOpen(false); setRecentOpen(false); router.push('/profile'); }}
                    />

                    {/* Divider */}
                    <div className="my-2 mx-1 border-t border-[#F2F4F7]" />

                    {/* Folders section */}
                    <SectionHeader
                        label="FOLDERS"
                        collapsed={collapsed}
                        expanded={isFoldersExpanded}
                        onToggle={() => setIsFoldersExpanded(p => !p)}
                    />
                    <div
                        className="flex flex-col gap-0.5 overflow-hidden"
                        style={{
                            maxHeight: isFoldersExpanded ? '300px' : '0',
                            transition: 'max-height 250ms cubic-bezier(0.4,0,0.2,1)',
                        }}
                    >
                        <FolderNavRow icon={<FolderIcon />} label="View all"   href="/folders/view-all"  badge={folderStats.viewAll || undefined}    active={pathname === '/folders/view-all'}    collapsed={collapsed} />
                        <FolderNavRow icon={<ClockIcon />}  label="Recent"     href="/folders/recent"    badge={folderStats.recent || undefined}     active={pathname === '/folders/recent'}     collapsed={collapsed} />
                        <FolderNavRow icon={<StarIcon />}   label="Favourites" href="/folders/favorites" badge={folderStats.favorites || undefined}  active={pathname === '/folders/favorites'}  collapsed={collapsed} />
                        <FolderNavRow icon={<UsersIcon />}  label="Shared"     href="/folders/shared"    badge={folderStats.shared || undefined}     active={pathname === '/folders/shared'}     collapsed={collapsed} />
                        <FolderNavRow icon={<TrashIcon />}  label="Trash"      href="/folders/trash"     badge={folderStats.trash || undefined}      active={pathname === '/folders/trash'}      collapsed={collapsed} />
                    </div>
                </div>

                {/* ── User section ── */}
                <div className="px-2 pb-3 flex-shrink-0 border-t border-[#F2F4F7] pt-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Link
                            href="/profile"
                            onClick={() => { setFavOpen(false); setRecentOpen(false); }}
                            className="flex items-center gap-2 min-w-0 flex-1 rounded-lg px-2 py-1.5 hover:bg-[#F9FAFB] transition-colors"
                        >
                            <div className="w-8 h-8 rounded-full bg-[#F2F4F7] flex items-center justify-center text-[#4A5565] font-semibold text-sm overflow-hidden border border-[#E3E8EF] flex-shrink-0">
                                {resolvedProfilePicUrl ? (
                                    <Image src={resolvedProfilePicUrl} alt="Profile" width={32} height={32} className="w-full h-full object-cover" unoptimized />
                                ) : (
                                    <span>{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            <div
                                className="flex flex-col overflow-hidden"
                                style={{
                                    maxWidth: collapsed ? '0px' : '130px',
                                    opacity: collapsed ? 0 : 1,
                                    transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 180ms',
                                }}
                            >
                                <span className="text-[13px] font-medium text-[#101828] truncate">{user?.username || 'Guest'}</span>
                                <span className="text-[11px] text-[#6A7282] truncate">{user?.email || ''}</span>
                            </div>
                        </Link>
                        {!collapsed && (
                            <button onClick={handleLogout} title="Logout" className="ml-auto text-[#9AA3AE] hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50 flex-shrink-0">
                                <LogoutIcon />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Fixed dropdowns rendered OUTSIDE the sidebar body to escape overflow:hidden ── */}
            {favOpen && (
                <ProjectDropdown
                    fixedTop={dropdownPos.top}
                    fixedLeft={dropdownPos.left}
                    items={filteredFavs}
                    loading={loadingProjects}
                    search={favSearch}
                    onSearch={setFavSearch}
                    emptyMsg="No favourites yet"
                    placeholder="Search favourites…"
                    viewAllHref="/spaces?filter=favorites"
                    viewAllLabel="View all favourites"
                    onProjectClick={handleProjectClick}
                    onToggleFav={handleToggleFavourite}
                    togglingId={togglingFavoriteId}
                />
            )}
            {recentOpen && (
                <ProjectDropdown
                    fixedTop={dropdownPos.top}
                    fixedLeft={dropdownPos.left}
                    items={filteredRecent}
                    loading={loadingProjects}
                    search={recentSearch}
                    onSearch={setRecentSearch}
                    emptyMsg="No recent spaces"
                    placeholder="Search recent…"
                    viewAllHref="/spaces?filter=recent"
                    viewAllLabel="View all recent spaces"
                    onProjectClick={handleProjectClick}
                />
            )}
            {inboxOpen && (
                <InboxDropdown
                    fixedTop={dropdownPos.top}
                    fixedLeft={dropdownPos.left}
                    summaries={chatSummaries}
                    loading={loadingInbox}
                    search={inboxSearch}
                    onSearch={setInboxSearch}
                    onClose={() => setInboxOpen(false)}
                />
            )}
        </div>
        </>
    );
}

/* ─────────────────────────────────────────────
   Project Dropdown Box
───────────────────────────────────────────── */
function ProjectDropdown({
    fixedTop, fixedLeft,
    items, loading, search, onSearch, emptyMsg, placeholder,
    viewAllHref, viewAllLabel, onProjectClick, onToggleFav, togglingId,
}: {
    fixedTop: number;
    fixedLeft: number;
    items: Project[];
    loading: boolean;
    search: string;
    onSearch: (v: string) => void;
    emptyMsg: string;
    placeholder: string;
    viewAllHref: string;
    viewAllLabel: string;
    onProjectClick: (p: Project) => void;
    onToggleFav?: (e: React.MouseEvent, p: Project) => void;
    togglingId?: number | null;
}) {
    const router = useRouter();
    const visible = items.slice(0, 4);

    return (
        <div
            data-sidebar-dropdown
            className="bg-white rounded-xl border border-[#E8ECF0] shadow-2xl shadow-black/10 overflow-hidden"
            style={{
                position: 'fixed',
                top: fixedTop,
                left: fixedLeft,
                width: '248px',
                zIndex: 9999,
                animation: 'dropdownIn 180ms cubic-bezier(0.4,0,0.2,1)',
            }}
        >
            {/* Search bar */}
            <div className="px-3 pt-3 pb-2 border-b border-[#F2F4F7]">
                <div className="relative">
                    <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#B0B8C4" strokeWidth="2" strokeLinecap="round">
                            <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        placeholder={placeholder}
                        autoFocus
                        className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-[#F7F8FA] border border-[#E8ECF0] rounded-lg placeholder-[#B0B8C4] text-[#1D293D] focus:outline-none focus:ring-1 focus:ring-[#155DFC]/30 focus:border-[#155DFC]/40 font-arimo transition-all"
                    />
                </div>
            </div>

            {/* Items list */}
            <div className="py-1">
                {loading ? (
                    <div className="px-3 py-3 flex flex-col gap-2 animate-pulse">
                        <div className="h-2 w-32 bg-gray-100 rounded" />
                        <div className="h-2 w-24 bg-gray-100 rounded" />
                    </div>
                ) : visible.length > 0 ? (
                    visible.map(project => (
                        <DropdownItem
                            key={project.id}
                            project={project}
                            onProjectClick={() => { onProjectClick(project); router.push(`/summary/${project.id}`); }}
                            onToggleFav={onToggleFav}
                            isToggling={(togglingId ?? -1) === project.id}
                        />
                    ))
                ) : (
                    <div className="px-3 py-3 text-[12px] text-[#B0B8C4] italic">{emptyMsg}</div>
                )}
            </div>

            {/* View all footer */}
            <div className="border-t border-[#F2F4F7] px-3 py-2">
                <Link
                    href={viewAllHref}
                    className="flex items-center gap-1.5 text-[12px] font-medium text-[#155DFC] hover:text-[#0040C4] transition-colors font-arimo"
                >
                    <span>{viewAllLabel}</span>
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M3 6h6M7 4l2 2-2 2" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   Dropdown Item
───────────────────────────────────────────── */
function DropdownItem({
    project, onProjectClick, onToggleFav, isToggling,
}: {
    project: Project;
    onProjectClick: () => void;
    onToggleFav?: (e: React.MouseEvent, p: Project) => void;
    isToggling: boolean;
}) {
    const colour = projectColour(project.id);
    return (
        <div
            className="group flex items-center gap-2.5 px-3 py-2 hover:bg-[#F5F7FA] transition-colors cursor-pointer"
            onClick={onProjectClick}
        >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colour}`} />
            <div className="flex flex-col flex-1 min-w-0">
                <span className="font-arimo text-[12.5px] font-medium text-[#1D293D] truncate leading-tight">{project.name}</span>
                {project.projectKey && (
                    <span className="font-arimo text-[10.5px] text-[#99A1AF] truncate">{project.projectKey}</span>
                )}
            </div>
            {onToggleFav && (
                <button
                    onClick={e => onToggleFav(e, project)}
                    disabled={isToggling}
                    title="Remove from favourites"
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-0.5 rounded text-amber-400 hover:text-gray-400 disabled:cursor-not-allowed"
                >
                    <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor">
                        <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" />
                    </svg>
                </button>
            )}
        </div>
    );
}

/* ─────────────────────────────────────────────
   Nav Row
───────────────────────────────────────────── */
function NavRow({
    icon, label, collapsed, active = false, hasChevron = false, chevronOpen = false, onClick,
}: {
    icon: React.ReactNode;
    label: string;
    collapsed: boolean;
    active?: boolean;
    hasChevron?: boolean;
    chevronOpen?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-left ${
                active ? 'bg-[#EFF6FF] text-[#155DFC]' : 'text-[#4A5565] hover:bg-[#F5F7FA] hover:text-[#101828]'
            }`}
        >
            <span className="flex-shrink-0 w-[18px] flex items-center justify-center">{icon}</span>
            <span
                className="font-arimo text-[13.5px] font-medium flex-1 whitespace-nowrap overflow-hidden text-left"
                style={{
                    maxWidth: collapsed ? '0px' : '150px',
                    opacity: collapsed ? 0 : 1,
                    transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
                }}
            >
                {label}
            </span>
            {hasChevron && !collapsed && (
                <svg
                    width="13" height="13" viewBox="0 0 13 13" fill="none"
                    className="flex-shrink-0 transition-transform duration-200"
                    style={{ transform: chevronOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                    <path d="M4.5 3L8 6.5L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </button>
    );
}

/* ─────────────────────────────────────────────
   Folder Nav Row
───────────────────────────────────────────── */
function FolderNavRow({
    icon, label, href, badge, active, collapsed,
}: {
    icon: React.ReactNode; label: string; href: string;
    badge?: number; active: boolean; collapsed: boolean;
}) {
    return (
        <Link
            href={href}
            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 ${
                active ? 'bg-[#EFF6FF] text-[#155DFC]' : 'text-[#4A5565] hover:bg-[#F5F7FA] hover:text-[#101828]'
            }`}
        >
            <span className="flex-shrink-0 w-[18px] flex items-center justify-center">{icon}</span>
            <span
                className="font-arimo text-[13.5px] font-medium flex-1 whitespace-nowrap overflow-hidden"
                style={{
                    maxWidth: collapsed ? '0px' : '130px',
                    opacity: collapsed ? 0 : 1,
                    transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
                }}
            >
                {label}
            </span>
            {badge !== undefined && badge > 0 && !collapsed && (
                <span className="ml-auto bg-[#F2F4F7] text-[#4A5565] text-[11px] px-1.5 py-0.5 rounded min-w-[20px] text-center font-medium">
                    {badge}
                </span>
            )}
        </Link>
    );
}

/* ─────────────────────────────────────────────
   Section Header
───────────────────────────────────────────── */
function SectionHeader({ label, collapsed, expanded, onToggle }: {
    label: string; collapsed: boolean; expanded: boolean; onToggle: () => void;
}) {
    return (
        <button onClick={onToggle} className="w-full flex items-center gap-2 px-2.5 py-1.5 mb-0.5 group">
            <svg
                width="9" height="9" viewBox="0 0 10 10" fill="none"
                className="text-[#B0B8C4] flex-shrink-0 transition-transform duration-200"
                style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
            >
                <path d="M3.5 2L6.5 5L3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span
                className="font-arimo text-[10.5px] font-bold text-[#B0B8C4] uppercase tracking-widest whitespace-nowrap overflow-hidden"
                style={{
                    maxWidth: collapsed ? '0px' : '150px',
                    opacity: collapsed ? 0 : 1,
                    transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
                }}
            >
                {label}
            </span>
        </button>
    );
}

/* ─────────────────────────────────────────────
   Inbox Nav Row (with unread dot)
   ───────────────────────────────────────────── */
function _InboxNavRow({
    icon, label, subtitle, unseenCount, collapsed, onClick,
}: {
    icon: React.ReactNode;
    label: string;
    subtitle?: string;
    unseenCount: number;
    collapsed: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-150 text-left hover:bg-[#F5F7FA] group"
        >
            <span className="flex-shrink-0 w-4 flex items-center justify-center text-[#94A3B8] group-hover:text-[#64748B]">
                {icon}
            </span>
            <div
                className="flex flex-col flex-1 min-w-0"
                style={{
                    maxWidth: collapsed ? '0px' : '160px',
                    opacity: collapsed ? 0 : 1,
                    transition: 'max-width 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms',
                }}
            >
                <div className="flex items-center gap-1.5">
                    <span className={`font-arimo text-[12.5px] truncate font-medium ${unseenCount > 0 ? 'text-[#101828]' : 'text-[#4A5565]'}`}>
                        {label}
                    </span>
                    {unseenCount > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse flex-shrink-0" title={`${unseenCount} unread messages`} />
                    )}
                </div>
                {subtitle && (
                    <span className="font-arimo text-[10.5px] text-[#94A3B8] truncate leading-tight group-hover:text-[#64748B]">
                        {subtitle}
                    </span>
                )}
            </div>
        </button>
    );
}

/* ─────────────────────────────────────────────
   Inbox Dropdown Box
   ───────────────────────────────────────────── */
function InboxDropdown({
    fixedTop, fixedLeft, summaries, loading, search, onSearch, onClose
}: {
    fixedTop: number;
    fixedLeft: number;
    summaries: ChatSummaries | null;
    loading: boolean;
    search: string;
    onSearch: (v: string) => void;
    onClose: () => void;
}) {
    const router = useRouter();
    const pid = typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null;

    const filteredRooms = (summaries?.rooms || []).filter((r: ChatRoomSummary) => 
        (r.roomName || '').toLowerCase().includes(search.toLowerCase())
    ).slice(0, 3);

    const filteredDirects = (summaries?.directMessages || []).filter((d: DirectMessageSummary) => 
        d.username.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 3);

    return (
        <div
            data-sidebar-dropdown
            className="bg-white rounded-xl border border-[#E8ECF0] shadow-2xl shadow-black/10 overflow-hidden flex flex-col"
            style={{
                position: 'fixed',
                top: fixedTop,
                left: fixedLeft,
                width: '260px',
                zIndex: 9999,
                animation: 'dropdownIn 180ms cubic-bezier(0.4,0,0.2,1)',
                maxHeight: '400px'
            }}
        >
            {/* Search bar */}
            <div className="px-3 pt-3 pb-2 border-b border-[#F2F4F7]">
                <div className="relative">
                    <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#B0B8C4" strokeWidth="2" strokeLinecap="round">
                            <circle cx="7" cy="7" r="5" /><path d="M11 11L14 14" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        placeholder="Search messages…"
                        autoFocus
                        className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-[#F7F8FA] border border-[#E8ECF0] rounded-lg placeholder-[#B0B8C4] text-[#1D293D] focus:outline-none focus:ring-1 focus:ring-[#155DFC]/30 focus:border-[#155DFC]/40 font-arimo transition-all"
                    />
                </div>
            </div>

            {/* Content list */}
            <div className="overflow-y-auto flex-1 py-1 custom-scrollbar">
                {loading && !summaries ? (
                    <div className="px-3 py-3 flex flex-col gap-3 animate-pulse">
                        <div className="h-3 w-32 bg-gray-100 rounded" />
                        <div className="h-3 w-24 bg-gray-100 rounded" />
                        <div className="h-3 w-28 bg-gray-100 rounded" />
                    </div>
                ) : (
                    <>
                        {/* Direct Messages */}
                        {filteredDirects.length > 0 && (
                            <div className="mb-2">
                                <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-[#B0B8C4] uppercase tracking-wider">Direct Messages</div>
                                {filteredDirects.map((dm: DirectMessageSummary) => (
                                    <InboxDropdownItem
                                        key={`dm-${dm.username}`}
                                        item={dm}
                                        icon={<UserIcon size={14} />}
                                        label={dm.username}
                                        onClick={() => {
                                            router.push(`/projects/${pid}/chat?with=${dm.username}`);
                                            onClose();
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Group Chats */}
                        {filteredRooms.length > 0 && (
                            <div>
                                <div className="px-3 pt-1 pb-1 text-[10px] font-bold text-[#B0B8C4] uppercase tracking-wider">Group Chats</div>
                                {filteredRooms.map((room: ChatRoomSummary) => (
                                    <InboxDropdownItem
                                        key={`room-${room.roomId}`}
                                        item={room}
                                        icon={<MessageSquareIcon size={14} />}
                                        label={room.roomName || 'General'}
                                        onClick={() => {
                                            router.push(`/projects/${pid}/chat?roomId=${room.roomId}`);
                                            onClose();
                                        }}
                                    />
                                ))}
                            </div>
                        )}

                        {filteredRooms.length === 0 && filteredDirects.length === 0 && (
                            <div className="px-3 py-6 text-center">
                                <div className="text-[12px] text-[#9AA3AE] font-medium">No recent messages</div>
                                <div className="text-[10px] text-[#B0B8C4] mt-0.5">Start a conversation in your project chat</div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* View all footer */}
            <div className="border-t border-[#F2F4F7] px-3 py-2 bg-[#F9FAFB]">
                <Link
                    href={`/projects/${pid}/chat`}
                    onClick={onClose}
                    className="flex items-center justify-between w-full text-[12px] font-medium text-[#155DFC] hover:text-[#0040C4] transition-colors font-arimo"
                >
                    <span>Go to project chat</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                        <path d="M3 6h6M7 4l2 2-2 2" />
                    </svg>
                </Link>
            </div>
        </div>
    );
}

function InboxDropdownItem({
    item, icon, label, onClick
}: {
    item: ChatRoomSummary | DirectMessageSummary;
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <div
            className="group flex items-start gap-2.5 px-3 py-2 hover:bg-[#F5F7FA] transition-colors cursor-pointer"
            onClick={onClick}
        >
            <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center text-[#155DFC] flex-shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                    <span className="font-arimo text-[12px] font-semibold text-[#1D293D] truncate">{label}</span>
                    {(item.unseenCount ?? 0) > 0 && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" />
                    )}
                </div>
                <div className="font-arimo text-[10.5px] text-[#6A7282] truncate leading-normal">
                    {item.lastMessageSender && <span className="font-medium mr-1 text-[#4B5563]">{item.lastMessageSender}:</span>}
                    {item.lastMessage || 'No messages yet'}
                </div>
            </div>
        </div>
    );
}

/* ─────────────────────────────────────────────
   Icons
   ───────────────────────────────────────────── */
const HomeIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5L10 3L17 9.5V17H13V13H7V17H3V9.5Z" />
    </svg>
);
function StarIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m10 2.8 2.2 4.6 5 .7-3.6 3.5.9 5L10 14.7 5.5 16.6l.9-5L2.8 8.1l5-.7L10 2.8z" />
        </svg>
    );
}
function ClockIcon({ className = '', size = 16 }: { className?: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="10" cy="10" r="7" /><path d="M10 6.5v4l2.5 1.5" />
        </svg>
    );
}
const ProfileIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="6" r="3" /><path d="M4 16c1.2-2.7 3.5-4 6-4s4.8 1.3 6 4" />
    </svg>
);
const FolderIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 6.5A1.5 1.5 0 0 1 4 5h4l1.5 2h6.5A1.5 1.5 0 0 1 17.5 8.5v6A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5v-8z" />
    </svg>
);
const UsersIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="7" cy="7" r="2.5" /><circle cx="13.5" cy="8" r="2" />
        <path d="M3.5 15c.8-2 2.5-3 4.7-3s3.9 1 4.7 3" />
        <path d="M12.2 14.5c.5-1.2 1.5-1.9 2.9-1.9 1.4 0 2.4.7 2.9 1.9" />
    </svg>
);
const TrashIcon = () => (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 5.5h13" /><path d="M7.5 5.5V4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
        <path d="M6 5.5v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 14 15.5v-10" />
        <path d="M8.5 8.5v5M11.5 8.5v5" />
    </svg>
);
const LogoutIcon = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
        <path d="M10 17l5-5-5-5" /><path d="M15 12H3" />
    </svg>
);

const InboxIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="m22 13-1.29-2.58a3 3 0 0 0-2.68-1.51H14.12l-1.42-3.12A2 2 0 0 0 10.88 4.67H5.29A3 3 0 0 0 2.61 6.25L1 9.47V17a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2Z" />
        <path d="M2 13h4.45l.91 1.82A2 2 0 0 0 9.15 16h5.7a2 2 0 0 0 1.79-1.18L17.55 13H22" />
    </svg>
);

const MessageSquareIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
);

const UserIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);
