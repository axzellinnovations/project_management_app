'use client';

import { useState, useEffect, useMemo, useSyncExternalStore, Suspense } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { getUserFromToken, User } from '@/lib/auth';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { useNavigation } from '@/lib/navigation-context';
import { Menu } from 'lucide-react';
import api from '@/lib/axios';
import * as projectsApi from '@/services/projects-service';

import { NotificationBell } from './topbar/NotificationBell';
import { TabBar } from './topbar/TabBar';

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
  if (typeof window === 'undefined') return () => {};
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

  useNavigation();
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [recentProjectsList, setRecentProjectsList] = useState<{ id: number; name: string }[]>([]);
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

  const resolvedProfilePicUrl = useMemo(() => {
    if (!profilePicUrl) return '';
    if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) return profilePicUrl;
    return `${API_BASE_URL}${profilePicUrl}`;
  }, [profilePicUrl, API_BASE_URL]);

  const projectId = useMemo(() => {
    const queryProjectId = searchParams.get('projectId');
    const routeProjectId =
      (typeof params?.id === 'string' ? params.id : null) ||
      (typeof (params as Record<string, string | string[] | undefined>)?.projectId === 'string'
        ? ((params as Record<string, string | string[] | undefined>).projectId as string)
        : null);
    return queryProjectId || routeProjectId || storedProjectId;
  }, [params, searchParams, storedProjectId]);

  const activeTab = useMemo(() => {
    if (pathname.startsWith('/calendar')) return 'calendar';
    if (pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board')) return 'board';
    if (pathname.startsWith('/timeline')) return 'timeline';
    if (pathname.startsWith('/sprint-backlog')) return 'backlog';
    if (pathname.startsWith('/project/') && pathname.includes('/chat')) return 'chats';
    if (pathname.startsWith('/pages')) return 'pages';
    if (pathname.startsWith('/spaces') || pathname.startsWith('/folders')) return 'list';
    if (pathname.startsWith('/summary')) return 'summary';
    if (pathname.startsWith('/members')) return 'members';
    return 'summary';
  }, [pathname]);

  useEffect(() => {
    if (projectId && localStorage.getItem('currentProjectId') !== projectId) {
      localStorage.setItem('currentProjectId', projectId);
    }
    const fetchProjectStatus = async () => {
      if (!projectId) { setIsFavorite(false); return; }
      try {
        const projectData = await projectsApi.fetchProjectDetails(projectId);
        setIsFavorite(Boolean(projectData?.isFavorite));
      } catch { setIsFavorite(false); }
    };
    void fetchProjectStatus();
  }, [projectId]);

  useEffect(() => {
    if (user?.email) {
      const loadProfilePic = async () => {
        try {
          const response = await api.get('/api/auth/users');
          interface UserSummary { email: string; profilePicUrl?: string; }
          const currentUser = response.data.find(
            (u: UserSummary) => u.email.toLowerCase() === user.email.toLowerCase()
          );
          if (currentUser?.profilePicUrl) setProfilePicUrl(currentUser.profilePicUrl);
        } catch {}
      };
      void loadProfilePic();
    }
  }, [user]);

  // Close project dropdown on outside click
  useEffect(() => {
    if (!projectsOpen) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-project-switcher]')) setProjectsOpen(false);
    };
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler); };
  }, [projectsOpen]);

  const handleOpenProjectDropdown = async () => {
    if (projectsOpen) { setProjectsOpen(false); return; }
    try {
      const res = await projectsApi.fetchRecentProjects(5);
      setRecentProjectsList(res as { id: number; name: string }[]);
    } catch {}
    setProjectsOpen(true);
  };

  const handleSwitchProject = (proj: { id: number; name: string }) => {
    localStorage.setItem('currentProjectName', proj.name);
    localStorage.setItem('currentProjectId', proj.id.toString());
    window.dispatchEvent(new CustomEvent('planora:project-accessed'));
    window.dispatchEvent(new Event('storage'));
    setProjectsOpen(false);
  };

  const withProjectId = (basePath: string) => {
    if (!projectId) return basePath;
    return `${basePath}?projectId=${projectId}`;
  };

  const getTabHref = (tabId: string) => {
    switch (tabId) {
      case 'summary': return projectId ? `/summary/${projectId}` : '/dashboard';
      case 'timeline': return withProjectId('/timeline');
      case 'backlog': return withProjectId('/sprint-backlog');
      case 'board': return withProjectId('/kanban');
      case 'calendar': return withProjectId('/calendar');
      case 'chats': return projectId ? `/project/${projectId}/chat` : '/dashboard';
      case 'members': return projectId ? `/members/${projectId}` : '/members';
      case 'pages': return withProjectId('/pages');
      case 'list': return '/spaces';
      default: return projectId ? `/summary/${projectId}` : '/dashboard';
    }
  };

  const isProjectPage = useMemo(() => {
    const projectPaths = ['/summary', '/timeline', '/sprint-backlog', '/kanban', '/calendar', '/burndown', '/pages', '/members', '/project/'];
    return projectPaths.some(path => pathname.startsWith(path));
  }, [pathname]);

  /* ── Profile avatar block (shared) ── */
  const profileAvatar = resolvedProfilePicUrl ? (
    <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white">
      <Image src={resolvedProfilePicUrl} alt="Profile" width={32} height={32} className="w-full h-full object-cover" unoptimized />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cu-primary to-cu-primary-dark border-2 border-white flex items-center justify-center text-white text-[12px] font-bold shadow-sm">
      {user?.username?.charAt(0).toUpperCase() || 'U'}
    </div>
  );

  /* ── Non-project page TopBar ── */
  if (!isProjectPage) {
    return (
      <div className="w-full h-[64px] bg-cu-bg-secondary border-b border-cu-border px-4 sm:px-8 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
            className="lg:hidden p-2 -ml-2 text-cu-text-secondary hover:bg-gray-200/50 rounded-lg transition-colors"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <span className="text-[16px] font-semibold text-cu-text-primary">Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex -space-x-2">
            {profileAvatar}
          </div>
        </div>
      </div>
    );
  }

  /* ── Project page TopBar ── */
  return (
    <div className="w-full h-[119px] relative flex flex-col shrink-0">
      {/* Top Header Section */}
      <div className="flex-1 bg-cu-bg-secondary px-4 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
            className="lg:hidden p-2 -ml-2 text-cu-text-secondary hover:bg-gray-200/50 rounded-lg transition-colors"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Project icon */}
          <div className="w-10 h-10 bg-gradient-to-br from-cu-primary to-cu-primary-dark rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-cu-primary/20">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2.5L16.6667 6.66667V13.3333L10 17.5L3.33333 13.3333V6.66667L10 2.5Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className="flex flex-col">
            <span className="text-[12px] uppercase tracking-[0.3px] text-cu-text-secondary mb-0.5">Projects</span>
            <div className="flex items-center gap-2">
              <span className="text-[19px] text-cu-text-primary whitespace-nowrap">{projectName}</span>

              {/* Project Switcher */}
              <div className="relative" data-project-switcher>
                <button
                  onClick={() => void handleOpenProjectDropdown()}
                  className="ml-1 p-0.5 rounded hover:bg-gray-200/50 transition-colors"
                  aria-label="Switch project"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 6L8 10L12 6" stroke="#1D293D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {projectsOpen && recentProjectsList.length > 0 && (
                  <div className="absolute left-0 top-full mt-1 z-[200] bg-white border border-[#E5E7EB] rounded-xl shadow-xl py-1 min-w-[200px]">
                    {recentProjectsList.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleSwitchProject(proj)}
                        className={`w-full text-left px-4 py-2 text-[13px] hover:bg-[#F9FAFB] transition-colors ${proj.id.toString() === projectId ? 'font-semibold text-[#155DFC]' : 'text-[#374151]'}`}
                      >
                        {proj.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={async () => {
                  if (!projectId) return;
                  const nextState = !isFavorite;
                  setIsFavorite(nextState);
                  try {
                    await projectsApi.toggleFavorite(projectId);
                    window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                  } catch { setIsFavorite(!nextState); }
                }}
                className="ml-1"
              >
                <motion.svg
                  animate={{
                    fill: isFavorite ? '#FFD700' : 'transparent',
                    stroke: isFavorite ? '#FFD700' : '#6A7282',
                    scale: isFavorite ? [1, 1.3, 1] : 1
                  }}
                  transition={{ duration: 0.3 }}
                  width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </motion.svg>
              </motion.button>

              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="ml-1">
                <path d="M4 6L8 10L12 6" stroke="#1D293D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          <NotificationBell />
          <div className="flex -space-x-2">
            {profileAvatar}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <TabBar tabs={baseTabs} activeTab={activeTab} getTabHref={getTabHref} />
    </div>
  );
}

export default function TopBar() {
  return (
    <Suspense fallback={<div className="w-full h-[74px] bg-cu-bg-secondary border-b border-cu-border px-4 sm:px-8 flex items-center shrink-0"><div className="animate-pulse bg-gray-200 h-4 w-32 rounded" /></div>}>
      <TopBarContent />
    </Suspense>
  );
}
