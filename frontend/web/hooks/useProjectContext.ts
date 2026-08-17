import { useState, useEffect, useMemo, useSyncExternalStore, startTransition } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import api from '@/lib/axios';
import * as projectsApi from '@/services/projects-service';
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import { AUTH_TOKEN_CHANGED_EVENT } from '@/lib/auth';
import { isAgileProjectType } from '@/components/shared/ProjectTypeIcon';

type ProjectContextCache = {
  isFavorite: boolean;
  type: string;
  name: string;
  figmaUrl?: string | null;
  ownerId?: number | null;
};

const fetchProject = (url: string) => api.get(url).then((response) => response.data);

export const subscribeToBrowserStorage = (onStoreChange: () => void) => {
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

export const getScopedProjectValue = (key: 'currentProjectName' | 'currentProjectId' | 'currentProjectType') => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(key) || localStorage.getItem(key);
};

export const setScopedProjectValue = (key: 'currentProjectName' | 'currentProjectId' | 'currentProjectType', value: string) => {
  sessionStorage.setItem(key, value);
  localStorage.setItem(key, value);
};

export const removeScopedProjectValue = (key: 'currentProjectName' | 'currentProjectId' | 'currentProjectType') => {
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
};

export function useProjectContext() {
  const params = useParams();
  const searchParams = useSearchParams();

  const projectName = useSyncExternalStore(
    subscribeToBrowserStorage,
    () => getScopedProjectValue('currentProjectName') || 'Project Name',
    () => 'Project Name'
  );
  
  const storedProjectId = useSyncExternalStore(
    subscribeToBrowserStorage,
    () => getScopedProjectValue('currentProjectId'),
    () => null
  );
  
  const storedProjectType = useSyncExternalStore(
    subscribeToBrowserStorage,
    () => getScopedProjectValue('currentProjectType'),
    () => null
  );

  const [isFavorite, setIsFavorite] = useState(false);
  const [projectType, setProjectType] = useState<string | null>(storedProjectType);
  const [figmaUrl, setFigmaUrl] = useState<string | null>(null);
  const [projectOwnerId, setProjectOwnerId] = useState<number | null>(null);

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
  const isAgile = useMemo(() => isAgileProjectType(effectiveProjectType), [effectiveProjectType]);
  const projectCacheKey = useMemo(
    () => (projectId ? buildSessionCacheKey('topbar-project', [projectId]) : null),
    [projectId],
  );
  const cachedProject = useMemo(
    () => (projectCacheKey
      ? getSessionCache<ProjectContextCache>(projectCacheKey, { allowStale: true }).data
      : null),
    [projectCacheKey],
  );
  const { data: projectData, mutate: mutateProject } = useSWR(
    projectId ? `/api/projects/${projectId}` : null,
    fetchProject,
    {
      fallbackData: cachedProject
        ? {
          name: cachedProject.name,
          type: cachedProject.type,
          isFavorite: cachedProject.isFavorite,
          figmaUrl: cachedProject.figmaUrl ?? null,
          ownerId: cachedProject.ownerId ?? null,
        }
        : undefined,
      dedupingInterval: 60_000,
      revalidateIfStale: true,
    },
  );

  useEffect(() => {
    const storedId = getScopedProjectValue('currentProjectId');
    if (projectId && storedId !== projectId) {
      setScopedProjectValue('currentProjectId', projectId);
      removeScopedProjectValue('currentProjectType');
      // Do not call setProjectType synchronously here to avoid cascading renders.
    }

    if (!projectId) {
      startTransition(() => {
        setIsFavorite(false);
        setFigmaUrl(null);
        setProjectOwnerId(null);
      });
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectData) return;

    const resolvedProjectType = projectData?.type || 'KANBAN';
    const isFav = Boolean(projectData?.isFavorite);
    startTransition(() => {
      setIsFavorite(isFav);
      setProjectType(resolvedProjectType);
      setFigmaUrl(projectData?.figmaUrl ?? null);
      setProjectOwnerId(typeof projectData?.ownerId === 'number' ? projectData.ownerId : null);
    });
    setScopedProjectValue('currentProjectType', resolvedProjectType);

    if (projectData?.name && getScopedProjectValue('currentProjectName') !== projectData.name) {
      setScopedProjectValue('currentProjectName', projectData.name);
      window.dispatchEvent(new Event('storage'));
    }

    if (projectCacheKey && projectData?.name) {
      setSessionCache(projectCacheKey, {
        isFavorite: isFav,
        type: resolvedProjectType,
        name: projectData.name,
        figmaUrl: projectData?.figmaUrl ?? null,
        ownerId: typeof projectData?.ownerId === 'number' ? projectData.ownerId : null,
      }, 10 * 60_000);
    }
  }, [projectData, projectCacheKey]);

  useEffect(() => {
    const handleProjectUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId?: string | number; figmaUrl?: string | null; name?: string }>;
      if (customEvent.detail?.projectId && String(customEvent.detail.projectId) !== String(projectId)) {
        return;
      }
      if (customEvent.detail && 'figmaUrl' in customEvent.detail) {
        setFigmaUrl(customEvent.detail.figmaUrl ?? null);
      }
      void mutateProject();
    };

    window.addEventListener('planora:project-updated', handleProjectUpdated);
    window.addEventListener('planora:figma-updated', handleProjectUpdated);
    return () => {
      window.removeEventListener('planora:project-updated', handleProjectUpdated);
      window.removeEventListener('planora:figma-updated', handleProjectUpdated);
    };
  }, [projectId, mutateProject]);

  const toggleFavorite = async () => {
    if (!projectId) return;
    const nextState = !isFavorite;
    setIsFavorite(nextState);
    try {
      await projectsApi.toggleFavorite(projectId);
      window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
    } catch { setIsFavorite(!nextState); }
  };

  const switchProject = (proj: { id: number; name: string }) => {
    setScopedProjectValue('currentProjectName', proj.name);
    setScopedProjectValue('currentProjectId', proj.id.toString());
    removeScopedProjectValue('currentProjectType');
    setProjectType(null);
    window.dispatchEvent(new CustomEvent('planora:project-accessed'));
    window.dispatchEvent(new Event('storage'));
  };

  return {
    projectId,
    projectName,
    projectType: effectiveProjectType,
    isAgile,
    isFavorite,
    figmaUrl,
    projectOwnerId,
    setFigmaUrl,
    mutateProject,
    toggleFavorite,
    switchProject
  };
}
