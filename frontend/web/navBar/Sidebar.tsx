'use client';

import { useEffect, useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT, clearTokens, getUserFromToken, getValidToken, User } from '@/lib/auth';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';

/* ── Hooks ── */
import { useSidebarProjects } from '@/hooks/useSidebarProjects';

/* ── Sub-components ── */
import { SidebarHeader, CollapseButton } from './sidebar/SidebarHeader';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { NavRow } from './sidebar/NavRows';
import { ProjectDropdown } from './sidebar/ProjectDropdown';
import { InboxDropdown } from './sidebar/InboxDropdown';
import {
  HomeIcon, StarIcon, ClockIcon, ProfileIcon,
  InboxIcon,
} from './sidebar/SidebarIcons';

/* ── Types ── */
interface UserSummary { email: string; profilePicUrl?: string; }
interface Project { id: number; name: string; projectKey?: string; isFavorite?: boolean; }
interface ChatRoomSummary {
  roomId: number; roomName?: string; lastMessage?: string;
  lastMessageSender?: string; unseenCount?: number;
}
interface DirectMessageSummary {
  username: string; lastMessage?: string;
  lastMessageSender?: string; unseenCount?: number;
}
interface ChatSummaries {
  rooms: ChatRoomSummary[];
  directMessages: DirectMessageSummary[];
}

interface InboxNavRowProps {
  collapsed: boolean;
  active: boolean;
  unseenCount: number;
  onClick: () => void;
}

function InboxNavRow({ collapsed, active, unseenCount, onClick }: InboxNavRowProps) {
  return (
    <NavRow
      icon={
        <div className="relative">
          <InboxIcon />
          {unseenCount > 0 && (
            <span className="absolute -top-1 -right-1.5 bg-cu-primary text-white text-[9px] font-bold px-1 rounded-full border border-white">
              {unseenCount > 9 ? '9+' : unseenCount}
            </span>
          )}
        </div>
      }
      label="Inbox"
      collapsed={collapsed}
      active={active}
      hasChevron
      chevronOpen={active}
      badge={unseenCount}
      onClick={onClick}
    />
  );
}

/* storage sync helper */
const subscribeToBrowserStorage = (onChange: () => void) => {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', onChange);
  window.addEventListener('focus', onChange);
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('focus', onChange);
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onChange);
  };
};

/* ─────────────────────────────────────────────
   Main Sidebar
───────────────────────────────────────────── */
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const token = useSyncExternalStore<string | null>(
    subscribeToBrowserStorage,
    () => getValidToken(),
    () => null,
  );
  const user = useMemo<User | null>(() => {
    if (!token) return null;
    return getUserFromToken();
  }, [token]);

  const currentProjectId = useSyncExternalStore<string | null>(
    subscribeToBrowserStorage,
    () => localStorage.getItem('currentProjectId'),
    () => null,
  );

  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
  const resolvedProfilePicUrl = useMemo(() => {
    if (!profilePicUrl) return '';
    if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) return profilePicUrl;
    return `${API_BASE_URL}${profilePicUrl}`;
  }, [profilePicUrl, API_BASE_URL]);

  /* ── Project & folder data (extracted hooks) ── */
  const {
    recentProjects,
    favoriteProjects,
    loading: loadingProjects,
    togglingFavoriteId,
    handleProjectClick: rawProjectClick,
    handleToggleFavourite,
  } = useSidebarProjects(pathname);


  const [chatSummaries, setChatSummaries] = useState<ChatSummaries | null>(null);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    let isCurrentlyMobile = window.innerWidth < 768;
    setIsMobile(isCurrentlyMobile);
    if (isCurrentlyMobile) setCollapsed(true);

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      if (mobile && !isCurrentlyMobile) setCollapsed(true);
      if (mobile !== isCurrentlyMobile) {
        setIsMobile(mobile);
        isCurrentlyMobile = mobile;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [collapsed, setCollapsed] = useState(true);
  const [favOpen, setFavOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [recentSearch, setRecentSearch] = useState('');

  const favRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const inboxRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

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

  useEffect(() => {
    if (window.innerWidth >= 768) {
      setCollapsed(localStorage.getItem('planora:sidebar:collapsed') === 'true');
    }
  }, []);

  useEffect(() => {
    const projectId =
      (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('projectId'))
      || localStorage.getItem('currentProjectId')
      || (recentProjects.length > 0 ? recentProjects[0].id.toString() : null);

    if (!projectId) {
      setChatSummaries(null);
      return;
    }

    void fetchChatSummaries(parseInt(projectId));
  }, [pathname, fetchChatSummaries, recentProjects]);

  /* click-outside to close dropdowns */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inFav = favRef.current?.contains(target);
      const inRecent = recentRef.current?.contains(target);
      const inInbox = inboxRef.current?.contains(target);
      const inDropdown = (target as Element)?.closest?.('[data-sidebar-dropdown]');
      if (!inFav && !inDropdown) setFavOpen(false);
      if (!inRecent && !inDropdown) setRecentOpen(false);
      if (!inInbox && !inDropdown) setInboxOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);

    const handleToggle = () => setCollapsed(prev => !prev);
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

  /* handlers */
  const handleLogout = () => { clearTokens(); router.push('/login'); };

  const handleProjectClick = async (project: Project) => {
    await rawProjectClick(project);
    setFavOpen(false);
    setRecentOpen(false);
  };

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('planora:sidebar:collapsed', String(next));
      window.dispatchEvent(new CustomEvent('planora:sidebar:collapsed', { detail: { collapsed: next } }));
      return next;
    });
  };

  /* filtered lists */
  const filteredFavs = favoriteProjects.filter(p =>
    p.name.toLowerCase().includes(favSearch.toLowerCase()) ||
    (p.projectKey || '').toLowerCase().includes(favSearch.toLowerCase())
  );
  const filteredRecent = recentProjects.filter(p =>
    p.name.toLowerCase().includes(recentSearch.toLowerCase()) ||
    (p.projectKey || '').toLowerCase().includes(recentSearch.toLowerCase())
  );
  
  const inboxItems = useMemo(() => {
    if (!chatSummaries) return [];
    return [
      ...(chatSummaries.rooms || []),
      ...(chatSummaries.directMessages || []),
    ].filter(item => (item.unseenCount || 0) > 0);
  }, [chatSummaries]);


  const closeDropdowns = () => { setFavOpen(false); setRecentOpen(false); };

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
        className={`h-screen flex-shrink-0 z-[500] bg-[#F9FAFB] transition-all duration-300 ease-in-out ${isMobile ? 'fixed left-0 top-0' : 'relative'} ${isMobile && collapsed ? 'pointer-events-none' : ''}`}
        style={{
          width: isMobile ? (collapsed ? '0px' : '260px') : (collapsed ? '64px' : '240px'),
          opacity: isMobile && collapsed ? 0 : 1
        }}
      >
        <div className="relative h-full bg-[#F9FAFB] border-r border-cu-border flex flex-col w-[240px] md:w-[inherit]">

          {/* Header */}
          <SidebarHeader collapsed={collapsed} />

          {/* Collapse button */}
          <CollapseButton collapsed={collapsed} onToggle={toggleCollapsed} />

          {/* Nav body */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-0.5">
            {/* For You */}
            <NavRow
              icon={<HomeIcon />}
              label="For You"
              collapsed={collapsed}
              active={pathname === '/dashboard'}
              onClick={() => { closeDropdowns(); router.push('/dashboard'); }}
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
              <InboxNavRow
                collapsed={collapsed}
                active={inboxOpen}
                unseenCount={inboxItems.length}
                onClick={openInboxDropdown}
              />
            </div>

            {/* Profile */}
            <NavRow
              icon={<ProfileIcon />}
              label="Profile"
              collapsed={collapsed}
              active={pathname === '/profile'}
              onClick={() => { closeDropdowns(); router.push('/profile'); }}
            />


          </div>

          {/* User section */}
          <SidebarFooter
            collapsed={collapsed}
            user={user}
            resolvedProfilePicUrl={resolvedProfilePicUrl}
            onLogout={handleLogout}
            onLinkClick={closeDropdowns}
          />
        </div>

        {/* Fixed dropdowns rendered OUTSIDE the sidebar body to escape overflow:hidden */}
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
