import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import api from '@/lib/axios';

interface Project {
  id: number;
  name: string;
  projectKey?: string;
  isFavorite?: boolean;
}

async function fetcher(url: string) {
  const { data } = await api.get(url);
  return data;
}

type ProjectEventName =
  | 'planora:project-created'
  | 'planora:project-updated'
  | 'planora:project-deleted';

const PROJECT_REFRESH_EVENTS: ProjectEventName[] = [
  'planora:project-created',
  'planora:project-updated',
  'planora:project-deleted',
];

export function useSidebarProjects() {
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<number | null>(null);

  // Cache recent projects and avoid revalidating on every route change.
  const { data: recentData, isLoading: loadingRecent, mutate: mutateRecent } = useSWR<Project[]>(
    '/api/projects/recent',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 30000 }
  );

  const { data: favoritesData, isLoading: loadingFav, mutate: mutateFav } = useSWR<Project[]>(
    '/api/projects/favorites',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: true, revalidateIfStale: false }
  );

  const recentProjects = recentData || [];
  const favoriteProjects = favoritesData || [];
  const loading = loadingRecent || loadingFav;

  // Refresh recent projects only when create/update/delete events happen.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onProjectChanged = () => {
      void mutateRecent();
      void mutateFav();
    };

    PROJECT_REFRESH_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, onProjectChanged);
    });

    return () => {
      PROJECT_REFRESH_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, onProjectChanged);
      });
    };
  }, [mutateRecent, mutateFav]);

  const handleProjectClick = useCallback(async (project: Project) => {
    localStorage.setItem('currentProjectName', project.name);
    localStorage.setItem('currentProjectId', project.id.toString());
    try {
      await api.post(`/api/projects/${project.id}/access`);
    } catch {
      // ignore
    }
  }, []);

  const handleToggleFavourite = useCallback(
    async (e: React.MouseEvent, project: Project) => {
      e.preventDefault();
      e.stopPropagation();
      if (togglingFavoriteId === project.id) return;
      
      setTogglingFavoriteId(project.id);

      try {
        await api.post(`/api/projects/${project.id}/favorite`);

        // Keep dropdowns responsive without network revalidation.
        mutateFav((prev) => {
          const list = prev || [];
          const exists = list.some((item) => item.id === project.id);
          if (exists) {
            return list.filter((item) => item.id !== project.id);
          }
          return [{ ...project, isFavorite: true }, ...list];
        }, false);

        mutateRecent((prev) => {
          const list = prev || [];
          return list.map((item) =>
            item.id === project.id ? { ...item, isFavorite: !item.isFavorite } : item
          );
        }, false);
      } catch {
        // no-op
      } finally {
        setTogglingFavoriteId(null);
      }
    },
    [togglingFavoriteId, mutateRecent, mutateFav],
  );

  return {
    recentProjects,
    favoriteProjects,
    loading,
    togglingFavoriteId,
    handleProjectClick,
    handleToggleFavourite,
    refreshRecentProjects: mutateRecent,
  };
}
