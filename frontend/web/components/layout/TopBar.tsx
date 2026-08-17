'use client';

// Global TopBar component containing search, notifications, project title, and dynamic project tabs based on the active route.
import { useState, useEffect, useSyncExternalStore, Suspense, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Plus, Settings, Github, Figma, ExternalLink, Copy, Check } from 'lucide-react';

import { useNavigation } from '@/lib/navigation-context';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getUserFromToken, getValidToken, User, getUserIdFromToken } from '@/lib/auth';
import * as projectsApi from '@/services/projects-service';
import { normalizeExternalUrl, openSafeExternalUrl } from '@/lib/url-utils';

import { NotificationBell } from './topbar/NotificationBell';
import { TabBar } from './topbar/TabBar';
import { SpacesDropdown } from './sidebar/SpacesDropdown';
import GlobalSearch from './topbar/GlobalSearch';
import { ProjectTypeIcon } from '@/components/shared/ProjectTypeIcon';
import { Modal } from '@/components/ui/Modal';
import { getProjectFigmaPath } from '@/lib/figma';

// Extracted hooks for cleaner logic separation
import { useProjectContext, subscribeToBrowserStorage } from '@/hooks/useProjectContext';
import { useProjectTabs } from '@/hooks/useProjectTabs';

function TopBarContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { profilePicUrl: resolvedProfilePicUrl } = useCurrentUser();

  const token = useSyncExternalStore<string | null>(subscribeToBrowserStorage, () => getValidToken(), () => null);
  const user = useMemo<User | null>(() => token ? getUserFromToken() : null, [token]);

  useNavigation();

  const {
    projectId, projectName, projectType, isAgile, isFavorite, toggleFavorite, switchProject,
    figmaUrl, projectOwnerId, setFigmaUrl, mutateProject,
  } = useProjectContext();

  const { tabs, activeTab, getTabHref, isProjectPage } = useProjectTabs(projectId, isAgile);

  // Dropdown UI State
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [projectsSearch, setProjectsSearch] = useState('');
  const [isRecentProjectsLoading, setIsRecentProjectsLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const switcherRef = useRef<HTMLDivElement>(null);
  const [recentProjectsList, setRecentProjectsList] = useState<{ id: number; name: string }[]>([]);
  const [figmaModalOpen, setFigmaModalOpen] = useState(false);
  const [figmaLinkInput, setFigmaLinkInput] = useState('');
  const [figmaLinkError, setFigmaLinkError] = useState('');
  const [isSavingFigma, setIsSavingFigma] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const currentUserId = getUserIdFromToken();
  const isProjectOwner = Boolean(currentUserId && projectOwnerId && currentUserId === projectOwnerId);

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

    if (switcherRef.current) {
      const rect = switcherRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left });
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
    switchProject(proj);
    setProjectsOpen(false);
    router.push(getTabHref(activeTab, String(proj.id)));
  };

  const handleOpenFigma = () => {
    if (!projectId) return;
    if (figmaUrl) {
      router.push(getProjectFigmaPath(projectId));
    } else {
      if (isProjectOwner) {
        setFigmaLinkInput('');
        setFigmaLinkError('');
        setFigmaModalOpen(true);
      }
    }
  };

  const handleEditFigmaLink = () => {
    setFigmaLinkInput(figmaUrl ?? '');
    setFigmaLinkError('');
    setFigmaModalOpen(true);
  };

  const handleCopyFigmaLink = async () => {
    if (!figmaUrl) return;
    try {
      await navigator.clipboard.writeText(figmaUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleSaveFigmaLink = async () => {
    if (!projectId) return;
    const rawTrimmed = figmaLinkInput.trim();
    const normalized = rawTrimmed === '' ? '' : normalizeExternalUrl(rawTrimmed);
    if (rawTrimmed !== '' && !normalized) {
      setFigmaLinkError('Enter a valid URL (e.g. https://www.figma.com/file/...).');
      return;
    }
    setIsSavingFigma(true);
    try {
      const savedUrl = normalized || null;
      await projectsApi.updateProjectDetails(Number(projectId), { figmaUrl: savedUrl });
      if (setFigmaUrl) setFigmaUrl(savedUrl);
      if (mutateProject) void mutateProject();
      window.dispatchEvent(new CustomEvent('planora:figma-updated', {
        detail: { projectId: Number(projectId), figmaUrl: savedUrl },
      }));
      window.dispatchEvent(new Event('storage'));
      setFigmaModalOpen(false);
      if (savedUrl) router.push(getProjectFigmaPath(projectId));
    } catch {
      setFigmaLinkError('Failed to save. Please try again.');
    } finally {
      setIsSavingFigma(false);
    }
  };

  /* ── Profile avatar block (shared) ── */
  const profileAvatar = resolvedProfilePicUrl ? (
    <div className="w-8 h-8 rounded-full border-2 border-cu-bg overflow-hidden bg-cu-bg shadow-sm ring-1 ring-cu-border max-sm:w-9 max-sm:h-9 max-sm:ring-2 max-sm:ring-cu-primary/20 max-sm:border-[2.5px] max-sm:shadow-md transition-all">
      <Image src={resolvedProfilePicUrl} alt="Profile" width={36} height={36} className="w-full h-full object-cover" unoptimized />
    </div>
  ) : (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 border-2 border-cu-bg flex items-center justify-center text-white text-[11px] font-bold shadow-sm ring-1 ring-cu-border max-sm:w-9 max-sm:h-9 max-sm:ring-2 max-sm:ring-cu-primary/20 max-sm:border-[2.5px] max-sm:text-[13px] max-sm:shadow-md transition-all">
      {user?.username?.charAt(0).toUpperCase() || 'U'}
    </div>
  );

  /* ── Non-project page: no TopBar ── */
  if (!isProjectPage) return null;

  /* ── Project page TopBar ── */
  return (
    <div className="w-full h-[120px] sticky top-0 flex flex-col shrink-0 glass-panel glass-panel-topbar z-[var(--cu-z-topbar)]" style={{ borderRadius: '0px' }}>
      {/* Top Header Section */}
      <div className="flex-1 px-4 sm:px-8 flex items-center justify-between pt-2">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
            className="md:hidden p-2 -ml-2 text-cu-text-tertiary hover:bg-cu-hover rounded-lg transition-colors"
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>

          {/* Project animated icon */}
          <div
            className="w-9 h-9 min-w-9 min-h-9 rounded-xl relative flex items-center justify-center shrink-0 text-white border border-white/20 transition-all duration-500 max-sm:w-[42px] max-sm:h-[42px] max-sm:min-w-[42px] max-sm:min-h-[42px] max-sm:rounded-2xl"
            style={{
              backgroundColor: isAgile ? '#2563EB' : '#1D4ED8',
              boxShadow: isAgile ? '0 8px 18px rgba(37,99,235,0.28)' : '0 8px 18px rgba(29,78,216,0.28)',
            }}
            title={isAgile ? 'Agile project' : 'Kanban project'}
          >
            <div
              className="absolute inset-[3px] rounded-lg border border-white/40 animate-spin pointer-events-none"
              style={{ animationDuration: '7s' }}
            />
            <ProjectTypeIcon
              projectType={projectType!}
              size={16}
              animated
              stroke="white"
              className="relative z-10 text-white"
            />
          </div>

          <div className="flex flex-col justify-center gap-0.5 ml-1 max-sm:gap-0 max-sm:ml-2.5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-cu-text-muted tracking-[0.05em] leading-tight cursor-default uppercase font-outfit max-sm:text-[10px] max-sm:font-extrabold max-sm:-mb-0.5">
              <span>Project</span>
              <span className="text-cu-text-muted font-medium">/</span>
            </div>

            <div className="flex items-center gap-2 max-sm:gap-1.5">
              <h1 className="text-[18px] font-bold text-cu-text-primary whitespace-nowrap leading-tight font-outfit tracking-tight max-sm:text-[19px] max-sm:font-black max-sm:text-cu-primary max-sm:-tracking-[0.01em]">
                {projectName}
              </h1>

              {/* Project Switcher */}
              <div className="relative flex items-center" ref={switcherRef} data-project-switcher>
                <button
                  onClick={() => void handleOpenProjectDropdown()}
                  className="p-1 rounded-full hover:bg-cu-hover transition-colors"
                  aria-label="Switch project"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cu-text-muted">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                {projectsOpen && (
                  <SpacesDropdown
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
                onClick={toggleFavorite}
                className="p-1 rounded-full hover:bg-cu-hover transition-colors group flex items-center justify-center -ml-1"
              >
                <svg
                  width="18" height="18" viewBox="0 0 24 24"
                  fill={isFavorite ? '#EAB308' : 'none'}
                  stroke={isFavorite ? '#EAB308' : 'var(--cu-text-muted)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-all duration-300 ${isFavorite ? 'scale-110 drop-shadow-[0_4px_10px_rgba(234,179,8,0.4)]' : ''}`}
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4 flex-1 justify-end max-w-[900px] ml-auto">
          {/* Integration + Settings Icons */}
          {projectId && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => router.push(`/github/${projectId}`)}
                className={`p-2 rounded-lg transition-all ${
                  pathname.startsWith('/github')
                    ? 'bg-cu-primary/10 text-cu-primary ring-1 ring-cu-primary/20'
                    : 'text-cu-text-muted hover:text-cu-text-secondary hover:bg-cu-hover'
                }`}
                title="GitHub"
                aria-label="GitHub"
              >
                <Github size={18} strokeWidth={pathname.startsWith('/github') ? 2.5 : 2} />
              </button>
              {/* Figma button — open link for all, edit accessible to project members */}
              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleOpenFigma}
                  className={`p-2 rounded-lg transition-all ${
                    figmaUrl
                      ? 'text-[#F24E1E] bg-[#F24E1E]/10 hover:bg-[#F24E1E]/20 ring-1 ring-[#F24E1E]/20'
                      : 'text-cu-text-muted hover:text-cu-text-secondary hover:bg-cu-hover'
                  }`}
                  title={figmaUrl ? 'Open Figma in Planora' : isProjectOwner ? 'Add Figma link' : 'No Figma link set'}
                  aria-label={figmaUrl ? 'Open Figma in Planora' : isProjectOwner ? 'Add Figma link' : 'No Figma link set'}
                >
                  <Figma size={18} strokeWidth={figmaUrl ? 2.2 : 2} />
                </button>
                {isProjectOwner && (
                  <button
                    onClick={handleEditFigmaLink}
                    className="p-1 rounded-md transition-all text-cu-text-muted hover:text-cu-text-secondary hover:bg-cu-hover"
                    title={figmaUrl ? 'Edit Figma link' : 'Add Figma link'}
                    aria-label={figmaUrl ? 'Edit Figma link' : 'Add Figma link'}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => router.push(`/project/${projectId}/settings`)}
                className={`p-2 rounded-lg transition-all ${
                  pathname.includes('/settings')
                    ? 'bg-cu-primary/10 text-cu-primary ring-1 ring-cu-primary/20'
                    : 'text-cu-text-muted hover:text-cu-text-secondary hover:bg-cu-hover'
                }`}
                title="Project Settings"
                aria-label="Project Settings"
              >
                <Settings size={18} strokeWidth={pathname.includes('/settings') ? 2.5 : 2} />
              </button>
            </div>
          )}

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
                  className="hidden sm:flex items-center justify-center px-3.5 h-[34px] bg-cu-bg hover:bg-cu-hover rounded-lg text-[13px] font-bold text-cu-text-primary transition-all border border-cu-border active:scale-95 shadow-sm font-outfit"
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
                className="flex items-center justify-center px-4 max-sm:px-0 max-sm:w-9 h-[34px] max-sm:h-9 bg-cu-primary text-white rounded-lg max-sm:rounded-[10px] text-[13px] font-bold hover:bg-cu-primary-hover transition-all font-outfit gap-1.5 max-sm:gap-0 shadow-sm shadow-cu-primary/20 active:scale-95"
              >
                <Plus size={16} strokeWidth={2.5} className="max-sm:w-[18px] max-sm:h-[18px]" />
                <span className="max-sm:hidden">New Task</span>
              </button>
            </div>
          )}

          <div className="w-[1px] h-6 bg-cu-border mx-1 hidden lg:block" />

          <div className="flex items-center gap-4 max-sm:gap-3 shrink-0">
            <NotificationBell />
            <div className="flex items-center">
              {profileAvatar}
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 sm:px-8 mt-1 mb-0.5">
        <TabBar tabs={tabs} activeTab={activeTab} getTabHref={getTabHref} />
      </div>

      <Modal
        open={figmaModalOpen}
        onOpenChange={setFigmaModalOpen}
        title={figmaUrl ? 'Edit Figma Link' : 'Connect Figma'}
        description="Save the shared Figma file or prototype link for this project. All team members will be able to open it."
        size="md"
      >
        <form
          className="pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSaveFigmaLink();
          }}
        >
          <div className="flex items-center justify-between gap-3 rounded-lg border border-cu-border bg-cu-bg-secondary px-3.5 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-cu-bg text-[#F24E1E] ring-1 ring-cu-border">
                <Figma size={20} strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-cu-text-primary font-outfit">Project design link</p>
                <p className="text-xs text-cu-text-secondary font-outfit">All project members can view and access this link.</p>
              </div>
            </div>
            {figmaUrl && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyFigmaLink}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-cu-border bg-cu-bg hover:bg-cu-hover text-xs font-semibold text-cu-text-secondary transition-colors font-outfit"
                  title="Copy link"
                >
                  {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => openSafeExternalUrl(figmaUrl)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F24E1E]/10 hover:bg-[#F24E1E]/20 text-[#F24E1E] text-xs font-semibold transition-colors font-outfit"
                  title="Open Figma in new tab"
                >
                  <ExternalLink size={13} />
                  <span>Open</span>
                </button>
              </div>
            )}
          </div>

          <label className="mt-5 block text-xs font-bold uppercase tracking-[0.04em] text-cu-text-muted font-outfit">
            Figma URL
          </label>
          <input
            value={figmaLinkInput}
            onChange={(event) => {
              setFigmaLinkInput(event.target.value);
              if (figmaLinkError) setFigmaLinkError('');
            }}
            autoFocus
            placeholder="https://www.figma.com/file/... or figma.com/design/..."
            className={`mt-2 h-11 w-full rounded-lg border bg-cu-bg px-3 text-sm font-medium text-cu-text-primary outline-none transition-all placeholder:text-cu-text-muted focus:ring-2 focus:ring-cu-primary/20 ${
              figmaLinkError ? 'border-red-400 focus:border-red-400' : 'border-cu-border focus:border-cu-primary'
            }`}
          />
          {figmaLinkError && (
            <p className="mt-2 text-xs font-semibold text-red-500 font-outfit">{figmaLinkError}</p>
          )}
          {figmaUrl && (
            <p className="mt-2 text-xs text-cu-text-muted font-outfit">Leave blank to remove the Figma link.</p>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setFigmaModalOpen(false)}
              className="h-10 rounded-lg border border-cu-border px-4 text-sm font-bold text-cu-text-secondary transition-colors hover:bg-cu-hover hover:text-cu-text-primary font-outfit"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingFigma}
              className="h-10 rounded-lg bg-cu-primary px-4 text-sm font-bold text-white shadow-sm shadow-cu-primary/20 transition-colors hover:bg-cu-primary-hover font-outfit disabled:opacity-60 flex items-center gap-2"
            >
              {isSavingFigma && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              {figmaLinkInput.trim() ? 'Save Link' : (figmaUrl ? 'Remove Link' : 'Save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function TopBar() {
  return (
    <Suspense fallback={<div className="w-full h-[74px] bg-cu-bg border-b border-cu-border px-4 sm:px-8 flex items-center shrink-0"><div className="animate-pulse bg-cu-bg-tertiary h-4 w-32 rounded" /></div>}>
      <TopBarContent />
    </Suspense>
  );
}
