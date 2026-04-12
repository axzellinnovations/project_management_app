'use client';

import { useEffect, useState, useMemo, useSyncExternalStore, useCallback, useRef } from 'react';
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
import { ProjectDropdown } from './sidebar/ProjectDropdown';
import { SidebarPanel } from './sidebar/SidebarPanel';
import { NotificationsPanelContent } from './sidebar/NotificationsPanel';
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
        icon={
          <div className="relative">
            <InboxIcon />
            <div className="absolute -top-1 -right-2">
              <InboxBadge count={badge} size="overlay" cap={99} />
            </div>
          </div>
        }
        label="Inbox"
        collapsed={collapsed}
        active={active}
        badge={0}
        onClick={onClick}
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

/* Inbox Panel Items */
import type { ChatInboxActivity } from '@/services/chat-service';

function InboxPanelItem({ item, onClick }: { item: ChatInboxActivity; onClick: () => void }) {
  const label = item.chatType === 'ROOM'
    ? (item.roomName || 'Channel')
    : item.chatType === 'DIRECT'
      ? (item.username || 'Direct Message')
      : 'Team Chat';

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-cu-hover transition-colors"
    >
      <div className="w-7 h-7 rounded-full bg-cu-primary/10 flex items-center justify-center text-cu-primary flex-shrink-0 mt-0.5">
        <InboxIcon size={13} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-cu-text-muted uppercase tracking-wide truncate">
            {item.projectName}
          </span>
          {item.unread && <InboxBadge count={item.unseenCount} size="inline" cap={99} />}
        </div>
        <span className="text-[12px] font-semibold text-cu-text-primary truncate">{label}</span>
        <span className="text-[10.5px] text-cu-text-secondary truncate leading-normal mt-0.5">
          {item.lastMessageSender && <span className="font-medium mr-1">{item.lastMessageSender}:</span>}
          {item.lastMessage || 'No messages yet'}
        </span>
      </div>
    </button>
  );
}

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
      const inDropdown = (target as Element)?.closest?.('[data-sidebar-dropdown]');
      if (!inFav && !inDropdown) setFavOpen(false);
      if (!inRecent && !inDropdown) setRecentOpen(false);
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
    setInboxPanelOpen(p => !p);
  };

  const openNotifPanel = () => {
    setFavOpen(false);
    setRecentOpen(false);
    setInboxPanelOpen(false);
    setNotifPanelOpen(p => !p);
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

  const inboxItems = useMemo(
    () => chatInbox?.recentActivities?.slice(0, 5) || [],
    [chatInbox],
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
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[1px] z-[9998]"
          onClick={() => setCollapsed(true)}
        />
      )}

      <div
        ref={sidebarRef}
        className={`h-screen flex-shrink-0 ${isMobile ? 'fixed left-0 top-0 z-[9999]' : 'relative'}`}
        style={{
          width: isMobile ? '260px' : (collapsed ? '64px' : '240px'),
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

              <InboxNavRow
                collapsed={collapsed}
                active={inboxPanelOpen}
                badge={inboxBadgeCount}
                onClick={openInboxPanel}
              />

              <NotificationsNavRow
                collapsed={collapsed}
                active={notifPanelOpen}
                badge={globalUnreadCount}
                onClick={openNotifPanel}
              />

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

        {/* Inbox right panel */}
        <SidebarPanel
          open={inboxPanelOpen}
          onClose={() => setInboxPanelOpen(false)}
          title="Inbox"
          badge={inboxBadgeCount}
          anchorLeft={panelAnchorLeft}
          footer={
            <button
              onClick={() => { setInboxPanelOpen(false); router.push('/inbox'); }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-cu-primary hover:text-cu-primary-dark transition-colors w-full"
            >
              <span>View All Messages</span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 6h6M7 4l2 2-2 2" />
              </svg>
            </button>
          }
        >
          {loadingInbox ? (
            <div className="px-3 py-4 flex flex-col gap-3 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="h-2 w-20 bg-gray-100 rounded" />
                    <div className="h-2 w-32 bg-gray-100 rounded" />
                    <div className="h-2 w-24 bg-gray-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : inboxItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <InboxIcon size={18} />
              </div>
              <span className="text-[12px] font-medium text-cu-text-muted">No recent messages</span>
              <span className="text-[10px] text-cu-text-muted mt-0.5">Start a conversation in your project chat</span>
            </div>
          ) : (
            <div className="py-1">
              {inboxItems.map((item) => {
                const handleOpenActivity = () => {
                  setInboxPanelOpen(false);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('currentProjectId', String(item.projectId));
                    localStorage.setItem('currentProjectName', item.projectName || `Project ${item.projectId}`);
                    window.dispatchEvent(new CustomEvent('planora:project-accessed'));
                  }
                  const basePath = `/project/${item.projectId}/chat`;
                  if (item.chatType === 'ROOM' && item.roomId) {
                    router.push(`${basePath}?roomId=${item.roomId}`);
                  } else if (item.chatType === 'DIRECT' && item.username) {
                    router.push(`${basePath}?with=${encodeURIComponent(item.username)}`);
                  } else {
                    router.push(`${basePath}?view=team`);
                  }
                };
                return (
                  <InboxPanelItem key={`${item.chatType}-${item.projectId}-${item.roomId || item.username || 'team'}`} item={item} onClick={handleOpenActivity} />
                );
              })}
            </div>
          )}
        </SidebarPanel>

        {/* Notifications right panel */}
        <SidebarPanel
          open={notifPanelOpen}
          onClose={() => setNotifPanelOpen(false)}
          title="Notifications"
          badge={globalUnreadCount}
          anchorLeft={panelAnchorLeft}
          footer={
            <button
              onClick={() => { setNotifPanelOpen(false); router.push('/dashboard/notifications'); }}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-cu-primary hover:text-cu-primary-dark transition-colors w-full"
            >
              <span>View All Notifications</span>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 6h6M7 4l2 2-2 2" />
              </svg>
            </button>
          }
        >
          <NotificationsPanelContent
            notifications={notifications}
            onClose={() => setNotifPanelOpen(false)}
          />
        </SidebarPanel>
      </div>
    </>
  );
}
