'use client';

import { useState, useEffect, useMemo, useSyncExternalStore, Suspense, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { AUTH_TOKEN_CHANGED_EVENT, getUserFromToken, getValidToken, User } from '@/lib/auth';
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useNavigation } from '@/lib/navigation-context';
import { Menu, Plus } from 'lucide-react';
import * as projectsApi from '@/services/projects-service';

import { NotificationBell } from './topbar/NotificationBell';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TabBar } from './topbar/TabBar';
import { ProjectDropdown } from './sidebar/ProjectDropdown';
import GlobalSearch from './topbar/GlobalSearch';

const subscribeToBrowserStorage = (onStoreChange: () => void) => {
  if (typeof window === 'undefined') return () => { };
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener('focus', handler);
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('focus', handler);
    window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handler);
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
  const storedProjectType = useSyncExternalStore(
    subscribeToBrowserStorage,
    () => localStorage.getItem('currentProjectType'),
    () => null
  );
  const token = useSyncExternalStore<string | null>(
    subscribeToBrowserStorage,
    () => getValidToken(),
    () => null
  );
  const user = useMemo<User | null>(() => {
    if (!token) return null;
    return getUserFromToken();
  }, [token]);

  useNavigation();
  const { profilePicUrl: resolvedProfilePicUrl } = useCurrentUser();
  const [isFavorite, setIsFavorite] = useState(false);
  const [projectType, setProjectType] = useState<string | null>(storedProjectType);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [isRecentProjectsLoading, setIsRecentProjectsLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const switcherRef = useRef<HTMLDivElement>(null);
  const [recentProjectsList, setRecentProjectsList] = useState<{ id: number; name: string }[]>([]);
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const projectId = useMemo(() => {
    const queryProjectId = searchParams.get('projectId');
    const routeProjectId =
      (typeof params?.id === 'string' ? params.id : null) ||
      (typeof (params as Record<string, string | string[] | undefined>)?.projectId === 'string'
        ? ((params as Record<string, string | string[] | undefined>).projectId as string)
        : null);
    return queryProjectId || routeProjectId || storedProjectId;
  }, [params, searchParams, storedProjectId]);

  const effectiveProjectType = projectType || storedProjectType;

  const isAgile = useMemo(() => {
    return effectiveProjectType === 'AGILE' || effectiveProjectType === 'Agile Scrum' || effectiveProjectType === 'SCRUM';
  }, [effectiveProjectType]);

  const tabs = useMemo(() => {
    const base = [
      { id: 'summary', label: 'Summary' },
      { id: 'timeline', label: 'Timeline' },
      { id: 'backlog', label: 'Backlog' },
      { id: 'board', label: 'Board' },
      { id: 'calendar', label: 'Calendar' },
    ];

    if (isAgile) {
      base.push({ id: 'burndown', label: 'Burndown' });
    }

    base.push(
      { id: 'chats', label: 'Chats' },
      { id: 'inbox', label: 'Inbox' },
      { id: 'notifications', label: 'Notifications' },
      { id: 'milestones', label: 'Milestones' },
      { id: 'members', label: 'Members' },
      { id: 'pages', label: 'Pages' },
      { id: 'list', label: 'List' }
    );

    return base;
  }, [isAgile]);

  const activeTab = useMemo(() => {
    if (pathname.startsWith('/summary')) return 'summary';
    if (pathname.startsWith('/timeline')) return 'timeline';
    if (pathname.startsWith('/sprint-backlog') || pathname.startsWith('/backlog')) return 'backlog';
    if (pathname.startsWith('/kanban') || pathname.startsWith('/sprint-board')) return 'board';
    if (pathname.startsWith('/list')) return 'list';
    if (pathname.startsWith('/calendar')) return 'calendar';
    if (pathname.startsWith('/burndown')) return 'burndown';
    if (pathname.startsWith('/milestones')) return 'milestones';
    if (pathname.startsWith('/workload')) return 'workload';
    if (pathname.startsWith('/inbox')) return 'inbox';
    if (pathname.startsWith('/project/') && pathname.includes('/chat')) return 'chats';
    if (pathname.startsWith('/members')) return 'members';
    if (pathname.startsWith('/pages')) return 'pages';
    return 'summary';
  }, [pathname]);

  useEffect(() => {
    if (projectId && localStorage.getItem('currentProjectId') !== projectId) {
      localStorage.setItem('currentProjectId', projectId);
    }

    if (storedProjectType) {
      setProjectType(storedProjectType);
    }

    const fetchProjectStatus = async () => {
      if (!projectId) { setIsFavorite(false); return; }
      try {
        const projectData = await projectsApi.fetchProjectDetails(projectId);
        const resolvedProjectType = projectData?.type || 'KANBAN';
        setIsFavorite(Boolean(projectData?.isFavorite));
        setProjectType(resolvedProjectType);
        localStorage.setItem('currentProjectType', resolvedProjectType);

        if (projectData?.name && localStorage.getItem('currentProjectName') !== projectData.name) {
          localStorage.setItem('currentProjectName', projectData.name);
          window.dispatchEvent(new Event('storage'));
        }
      } catch { setIsFavorite(false); }
    };
    void fetchProjectStatus();
  }, [projectId, storedProjectType]);

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

    // Set position and open immediately
    if (switcherRef.current) {
      const rect = switcherRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left });
    }
    setProjectsOpen(true);
    setProjectsSearch('');
    setIsRecentProjectsLoading(true);

    try {
      const res = await projectsApi.fetchRecentProjects(10);
      setRecentProjectsList(res as { id: number; name: string }[]);
    } catch {
      console.error("Failed to fetch recent projects");
    } finally {
      setIsRecentProjectsLoading(false);
    }
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
      case 'backlog': return isAgile ? withProjectId('/sprint-backlog') : withProjectId('/backlog');
      case 'board': return isAgile ? withProjectId('/sprint-board') : withProjectId('/kanban');
      case 'list': return withProjectId('/list');
      case 'calendar': return withProjectId('/calendar');
      case 'burndown': return withProjectId('/burndown');
      case 'chats': return projectId ? `/project/${projectId}/chat` : '/dashboard';
      case 'inbox': return '/inbox';
      case 'notifications': return projectId ? `/notifications?projectId=${projectId}` : '/notifications';
      case 'milestones': return withProjectId('/milestones');
      case 'workload': return withProjectId('/workload');
      case 'members': return projectId ? `/members/${projectId}` : '/members';
      case 'pages': return withProjectId('/pages');
      default: return projectId ? `/summary/${projectId}` : '/dashboard';
    }
  };

  const isProjectPage = useMemo(() => {
    const hasProjectContext = Boolean(projectId);
    if (pathname.startsWith('/project/') && pathname.includes('/chat')) {
      return true;
    }
    const projectScopedPaths = [
      '/summary',
      '/timeline',
      '/sprint-backlog',
      '/backlog',
      '/kanban',
      '/sprint-board',
      '/calendar',
      '/burndown',
      '/list',
      '/milestones',
      '/workload',
      '/pages',
      '/notifications',
      '/members',
    ];
    return hasProjectContext && projectScopedPaths.some(path => pathname.startsWith(path));
  }, [pathname, projectId]);

  /* ── Profile avatar block (shared) ── */
  const profileAvatar = resolvedProfilePicUrl ? (
    <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden bg-white shadow-sm ring-1 ring-slate-200 max-sm:w-9 max-sm:h-9 max-sm:ring-2 max-sm:ring-blue-100 max-sm:border-[2.5px] max-sm:shadow-md transition-all">
      <Image src={resolvedProfilePicUrl} alt="Profile" width={36} height={36} className="w-full h-full object-cover" unoptimized />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 border-2 border-white flex items-center justify-center text-white text-[11px] font-bold shadow-sm ring-1 ring-slate-200 max-sm:w-9 max-sm:h-9 max-sm:ring-2 max-sm:ring-blue-100 max-sm:border-[2.5px] max-sm:text-[13px] max-sm:shadow-md transition-all">
      {user?.username?.charAt(0).toUpperCase() || 'U'}
    </div>
  );

  /* ── Non-project page: no TopBar (greeting is in page content) ── */
  if (!isProjectPage) return null;


  /* ── Project page TopBar ── */
  return (
    <div className="w-full h-[120px] sticky top-0 flex flex-col shrink-0 bg-white border-b border-slate-200 z-[100]">
      {/* Top Header Section */}
      <div className="flex-1 px-4 sm:px-8 flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Project animated icon */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all duration-500 max-sm:w-[42px] max-sm:h-[42px] max-sm:rounded-2xl max-sm:shadow-lg ${isAgile
            ? 'bg-blue-600 max-sm:shadow-blue-600/30'
            : 'bg-indigo-600 max-sm:shadow-indigo-600/30'
            }`}>
            {isAgile ? (
              <motion.svg
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </motion.svg>
            ) : (
              <div className="relative w-4 h-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" className="opacity-30" />
                </svg>
                <motion.div
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-[4px] top-[5px] w-[2.5px] h-[6px] bg-white rounded-full"
                />
                <motion.div
                  animate={{ y: [0, 3, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute left-[10px] top-[5px] w-[2.5px] h-[6px] bg-white rounded-full opacity-80"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col justify-center gap-0.5 ml-1 max-sm:gap-0 max-sm:ml-2.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 tracking-[0.05em] leading-tight cursor-default uppercase font-outfit max-sm:text-[10px] max-sm:font-extrabold max-sm:text-slate-400 max-sm:-mb-0.5">
              <span>Project</span>
              <span className="text-slate-300 font-medium">/</span>
            </div>

            <div className="flex items-center gap-2 max-sm:gap-1.5">
              <h1 className="text-[18px] font-bold text-slate-900 whitespace-nowrap leading-tight font-outfit tracking-tight max-sm:text-[19px] max-sm:font-black max-sm:text-blue-700 max-sm:-tracking-[0.01em]">
                {projectName}
              </h1>

              {/* Status Badge */}
              <div className="hidden min-[450px]:flex items-center gap-2 px-2 py-0.5 rounded-[6px] bg-emerald-50 whitespace-nowrap border border-emerald-100 cursor-default">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">
                  Active
                </span>
              </div>

              {/* Project Switcher */}
              <div className="relative flex items-center" ref={switcherRef} data-project-switcher>
                <button
                  onClick={() => void handleOpenProjectDropdown()}
                  className="p-1 rounded-full hover:bg-slate-50 transition-colors"
                  aria-label="Switch project"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {projectsOpen && (
                  <ProjectDropdown
                    fixedTop={dropdownPos.top}
                    fixedLeft={dropdownPos.left}
                    items={recentProjectsList.filter(p => p.name.toLowerCase().includes(projectsSearch.toLowerCase()))}
                    loading={isRecentProjectsLoading}
                    search={projectsSearch}
                    onSearch={setProjectsSearch}
                    emptyMsg="No recent projects"
                    placeholder="Search projects…"
                    viewAllHref="/spaces"
                    viewAllLabel="View all projects"
                    onProjectClick={handleSwitchProject}
                  />
                )}
              </div>

              {/* Favorite Star */}
              <button
                onClick={async () => {
                  if (!projectId) return;
                  const nextState = !isFavorite;
                  setIsFavorite(nextState);
                  try {
                    await projectsApi.toggleFavorite(projectId);
                    window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
                  } catch { setIsFavorite(!nextState); }
                }}
                className="p-1 rounded-full hover:bg-slate-50 transition-colors group flex items-center justify-center -ml-1"
              >
                <svg
                  width="18" height="18" viewBox="0 0 24 24"
                  fill={isFavorite ? '#EAB308' : 'none'}
                  stroke={isFavorite ? '#EAB308' : '#94A3B8'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-all duration-300 ${isFavorite ? 'scale-110 drop-shadow-[0_4px_10px_rgba(234,179,8,0.4)]' : 'group-hover:stroke-slate-500'}`}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4 flex-1 justify-end max-w-[900px] ml-auto">

          {/* Global Search Bar - Hidden on small screens to save space */}
          <div className="flex-1 max-w-[400px] hidden md:block">
            <GlobalSearch projectId={projectId} />
          </div>

          {activeTab === 'backlog' && (
            <div className="flex items-center gap-2.5 shrink-0">
              {isAgile && (
                <button
                  onClick={() => {
                    if (!projectId) return;
                    router.push(`/sprint-backlog?projectId=${projectId}&action=create-sprint`);
                  }}
                  className="hidden sm:flex items-center justify-center px-3.5 h-[34px] bg-white hover:bg-slate-50 rounded-lg text-[13px] font-bold text-slate-700 transition-all border border-slate-200 active:scale-95 shadow-sm font-outfit"
                >
                  New Sprint
                </button>
              )}

              <button
                onClick={() => {
                  if (!projectId) return;
                  const path = isAgile ? '/sprint-backlog' : '/backlog';
                  router.push(`${path}?projectId=${projectId}&action=add-task`);
                }}
                className="flex items-center justify-center px-4 max-sm:px-0 max-sm:w-9 h-[34px] max-sm:h-9 bg-blue-600 text-white rounded-lg max-sm:rounded-[10px] text-[13px] font-bold hover:bg-blue-700 transition-all font-outfit gap-1.5 max-sm:gap-0 shadow-sm shadow-blue-200 active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} className="max-sm:w-[18px] max-sm:h-[18px]" />
                <span className="max-sm:hidden">New Task</span>
              </button>
            </div>
          )}

          <div className="w-[1px] h-6 bg-slate-200 mx-1 hidden lg:block" />

          <div className="flex items-center gap-4 max-sm:gap-3 shrink-0">
            <NotificationBell />
            <div className="flex">
              {profileAvatar}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 sm:px-8 mt-1 mb-0.5">
        <TabBar tabs={tabs} activeTab={activeTab} getTabHref={getTabHref} />
      </div>
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
