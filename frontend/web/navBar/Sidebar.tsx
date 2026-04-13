'use client';

import { useEffect, useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AUTH_TOKEN_CHANGED_EVENT, clearTokens, getUserFromToken, getValidToken, User } from '@/lib/auth';
import { useRouter, usePathname } from 'next/navigation';
import { fetchChatInbox, type ChatInboxResponse } from '@/services/chat-service';

/* -- Hooks -- */
import { useSidebarProjects } from '@/hooks/useSidebarProjects';
import { useCurrentUser } from '@/hooks/useCurrentUser';

/* -- Sub-components -- */
import { SidebarHeader, CollapseButton } from './sidebar/SidebarHeader';
import { SidebarFooter } from './sidebar/SidebarFooter';
import { NavRow } from './sidebar/NavRows';
import { InboxDropdown } from './sidebar/InboxDropdown';
import { NotificationsDropdown } from './sidebar/NotificationsDropdown';
import { ProjectDropdown } from './sidebar/ProjectDropdown';
import ProjectList from '@/components/layout/sidebar/ProjectList';
import InboxBadge from '@/components/layout/sidebar/InboxBadge';
import { useGlobalNotifications } from '@/components/providers/GlobalNotificationProvider';
import {
  HomeIcon,
  ProfileIcon,
  InboxIcon,
  BellIcon,
} from './sidebar/SidebarIcons';

/* -- Types -- */
interface Project { id: number; name: string; projectKey?: string; isFavorite?: boolean; }
const INBOX_STALE_MS = 5 * 60_000;

interface NavRowProps {
  collapsed: boolean;
  active: boolean;
  badge: number;
  onClick: () => void;
}

function InboxNavRow({ collapsed, active, badge, onClick }: NavRowProps) {
  return (
    <div data-sidebar-panel-trigger>
      <NavRow
        icon={<InboxIcon />}
        label="Inbox"
        collapsed={collapsed}
        active={active}
        badge={badge}
        onClick={onClick}
        hasChevron
        chevronOpen={active}
      />
    </div>
  );
}

function NotificationsNavRow({ collapsed, active, badge, onClick }: NavRowProps) {
  return (
    <div data-sidebar-panel-trigger>
      <NavRow
        icon={<BellIcon />}
        label="Notifications"
        collapsed={collapsed}
        active={active}
        badge={badge}
        onClick={onClick}
        hasChevron
        chevronOpen={active}
      />
    </div>
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

/* --------------------------------------------
   Main Sidebar
 -------------------------------------------- */
export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount: globalUnreadCount, notifications } = useGlobalNotifications();

  const token = useSyncExternalStore<string | null>(
    subscribeToBrowserStorage,
    () => getValidToken(),
    () => null,
  );
  const user = useMemo<User | null>(() => {
    if (!token) return null;
    return getUserFromToken();
  }, [token]);

  const { profilePicUrl: resolvedProfilePicUrl } = useCurrentUser();

  /* -- Project & folder data (extracted hooks) -- */
  const {
    recentProjects,
    favoriteProjects,
    loading: loadingProjects,
    togglingFavoriteId,
    handleProjectClick: rawProjectClick,
    handleToggleFavourite,
  } = useSidebarProjects();

  const [chatInbox, setChatInbox] = useState<ChatInboxResponse | null>(null);
  const [inboxPanelOpen, setInboxPanelOpen] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [inboxSearch, setInboxSearch] = useState('');
  const [notifSearch, setNotifSearch] = useState('');
  const [loadingInbox, setLoadingInbox] = useState(false);

  const [collapsed, setCollapsed] = useState(true);
  const [favOpen, setFavOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [favSearch, setFavSearch] = useState('');
  const [recentSearch, setRecentSearch] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(64);

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

  const favRef = useRef<HTMLDivElement>(null);
  const recentRef = useRef<HTMLDivElement>(null);
  const inboxRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const lastInboxFetchedAtRef = useRef(0);
  const latestSyncedNotificationRef = useRef<number | null>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  /* Track sidebar right edge for panel positioning */
  useEffect(() => {
    const updateWidth = () => {
      if (sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        setSidebarWidth(rect.right);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [collapsed]);

  /* -- fetch inbox activity -- */
  const fetchInboxActivity = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (!force && lastInboxFetchedAtRef.current > 0 && Date.now() - lastInboxFetchedAtRef.current < INBOX_STALE_MS) {
      return;
    }

    setLoadingInbox(true);
    try {
      const data = await fetchChatInbox({ projectLimit: 10, activityLimit: 4, status: 'all' });
      setChatInbox(data);
      lastInboxFetchedAtRef.current = Date.now();
    } catch {
      // silently fail — badge count is non-critical
    } finally {
      setLoadingInbox(false);
    }
  }, []);

  const refreshInboxCounts = useCallback(() => {
    void fetchInboxActivity({ force: true });
  }, [fetchInboxActivity]);

  /* -- effects -- */
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setCollapsed(localStorage.getItem('planora:sidebar:collapsed') === 'true');
    }
  }, []);

  useEffect(() => {
    void fetchInboxActivity();
  }, [pathname, fetchInboxActivity, recentProjects.length]);

  useEffect(() => {
    const handleInboxUpdated = () => {
      void fetchInboxActivity({ force: true });
    };

    window.addEventListener('planora:chat-inbox-updated', handleInboxUpdated);
    return () => {
      window.removeEventListener('planora:chat-inbox-updated', handleInboxUpdated);
    };
  }, [fetchInboxActivity]);

  useEffect(() => {
    const latest = notifications[0];
    if (!latest || latest.id === latestSyncedNotificationRef.current) {
      return;
    }

    latestSyncedNotificationRef.current = latest.id;
    if (typeof latest.link === 'string' && latest.link.includes('/chat')) {
      refreshInboxCounts();
    }
  }, [notifications, refreshInboxCounts]);

  /* click-outside to close dropdowns */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inFav = favRef.current?.contains(target);
      const inRecent = recentRef.current?.contains(target);
      const inInbox = inboxRef.current?.contains(target);
      const inNotif = notifRef.current?.contains(target);
      const inDropdown = (target as Element)?.closest?.('[data-sidebar-dropdown]');
      if (!inFav && !inDropdown) setFavOpen(false);
      if (!inRecent && !inDropdown) setRecentOpen(false);
      if (!inInbox && !inDropdown) setInboxPanelOpen(false);
      if (!inNotif && !inDropdown) setNotifPanelOpen(false);
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
    setInboxPanelOpen(false);
    setNotifPanelOpen(false);
    if (favRef.current) {
      const rect = favRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.top, left: rect.right + 8 });
    }
    setFavOpen(p => !p);
    setFavSearch('');
  };

  const openRecentDropdown = () => {
    setFavOpen(false);
    setInboxPanelOpen(false);
    setNotifPanelOpen(false);
    if (recentRef.current) {
      const rect = recentRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.top, left: rect.right + 8 });
    }
    setRecentOpen(p => !p);
    setRecentSearch('');
  };

  const openInboxPanel = () => {
    setFavOpen(false);
    setRecentOpen(false);
    setNotifPanelOpen(false);
    void fetchInboxActivity();
    if (inboxRef.current) {
      const rect = inboxRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.top, left: rect.right + 8 });
    }
    setInboxPanelOpen(p => !p);
    setInboxSearch('');
  };

  const openNotifPanel = () => {
    setFavOpen(false);
    setRecentOpen(false);
    setInboxPanelOpen(false);
    if (notifRef.current) {
      const rect = notifRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.top, left: rect.right + 8 });
    }
    setNotifPanelOpen(p => !p);
    setNotifSearch('');
  };

  /* handlers */
  const handleLogout = () => { clearTokens(); router.push('/login'); };

  const handleProjectClick = async (project: Project) => {
    await rawProjectClick(project);
    setFavOpen(false);
    setRecentOpen(false);
    setInboxPanelOpen(false);
    setNotifPanelOpen(false);
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

  const inboxBadgeCount = useMemo(() => {
    if (!chatInbox) return 0;
    return Number(chatInbox.totalUnread) || 0;
  }, [chatInbox]);

  const closeAll = () => {
    setFavOpen(false);
    setRecentOpen(false);
    setInboxPanelOpen(false);
    setNotifPanelOpen(false);
  };

  const panelAnchorLeft = isMobile ? 260 : (collapsed ? 64 : 240);

  /* -- render -- */
  return (
    <>
      {isMobile && !collapsed && typeof document !== 'undefined' && createPortal(
        <div
          role="button"
          tabIndex={0}
          className="fixed inset-0 w-[100vw] h-[100vh] bg-black/50 backdrop-blur-sm z-[9990] cursor-pointer touch-none"
          onClick={() => setCollapsed(true)}
          onKeyDown={(e) => e.key === 'Escape' && setCollapsed(true)}
          aria-label="Close Sidebar"
        />,
        document.body
      )}

      <div
        ref={sidebarRef}
        className={`h-screen flex-shrink-0 ${isMobile ? 'fixed left-0 top-0 z-[9999]' : 'relative'} ${isMobile && collapsed ? 'pointer-events-none' : ''}`}
        style={{
          width: isMobile ? (collapsed ? '0px' : '260px') : (collapsed ? '64px' : '240px'),
        }}
      >
        <div
          className={`bg-[#F9FAFB] transition-all duration-300 ease-in-out ${isMobile ? 'relative h-full' : 'fixed left-0 top-0 h-screen z-[9999]'}`}
          style={{
            width: isMobile ? '260px' : (collapsed ? '64px' : '240px'),
            transform: isMobile && collapsed ? 'translateX(-100%)' : 'translateX(0)',
            opacity: isMobile && collapsed ? 0.5 : 1,
          }}
        >
          <div className="relative h-full bg-[#F9FAFB] border-r border-cu-border flex flex-col w-[260px] md:w-[inherit]">
            <SidebarHeader collapsed={collapsed} />
            <CollapseButton collapsed={collapsed} onToggle={toggleCollapsed} />

            <div className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-2 flex flex-col gap-0.5">
              <NavRow
                icon={<HomeIcon />}
                label="For You"
                collapsed={collapsed}
                active={pathname === '/dashboard'}
                onClick={() => { closeAll(); router.push('/dashboard'); }}
              />

              <ProjectList
                collapsed={collapsed}
                favOpen={favOpen}
                recentOpen={recentOpen}
                loading={loadingProjects}
                favoriteCount={favoriteProjects.length}
                recentCount={recentProjects.length}
                favRef={favRef}
                recentRef={recentRef}
                onOpenFav={openFavDropdown}
                onOpenRecent={openRecentDropdown}
              />

              <div ref={inboxRef}>
                <InboxNavRow
                  collapsed={collapsed}
                  active={inboxPanelOpen}
                  badge={inboxBadgeCount}
                  onClick={openInboxPanel}
                />
              </div>

              <div ref={notifRef}>
                <NotificationsNavRow
                  collapsed={collapsed}
                  active={notifPanelOpen}
                  badge={globalUnreadCount}
                  onClick={openNotifPanel}
                />
              </div>

              <NavRow
                icon={<ProfileIcon />}
                label="Profile"
                collapsed={collapsed}
                active={pathname === '/profile'}
                onClick={() => { closeAll(); router.push('/profile'); }}
              />
            </div>

            <SidebarFooter
              collapsed={collapsed}
              user={user}
              resolvedProfilePicUrl={resolvedProfilePicUrl}
              onLogout={handleLogout}
              onLinkClick={closeAll}
            />
          </div>
        </div>

        {/* Favorites dropdown */}
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

        {/* Recent dropdown */}
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

        {/* Inbox dropdown */}
        {inboxPanelOpen && (
          <InboxDropdown
            fixedTop={dropdownPos.top}
            fixedLeft={dropdownPos.left}
            activities={chatInbox?.recentActivities || []}
            loading={loadingInbox}
            error={!chatInbox && !loadingInbox ? "Unable to load inbox." : null}
            search={inboxSearch}
            onSearch={setInboxSearch}
            onRetry={() => void fetchInboxActivity({ force: true })}
            onClose={() => setInboxPanelOpen(false)}
          />
        )}

        {/* Notifications dropdown */}
        {notifPanelOpen && (
          <NotificationsDropdown
            fixedTop={dropdownPos.top}
            fixedLeft={dropdownPos.left}
            notifications={notifications}
            search={notifSearch}
            onSearch={setNotifSearch}
            onClose={() => setNotifPanelOpen(false)}
          />
        )}
      </div>
    </>
  );
}
