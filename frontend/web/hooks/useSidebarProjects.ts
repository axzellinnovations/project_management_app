import { useState, useCallback, useEffect } from 'react';
import * as projectsApi from '@/services/projects-service';

interface Project {
  id: number;
  name: string;
  projectKey?: string;
  isFavorite?: boolean;
}

export function useSidebarProjects(_pathname?: string) {
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [favoriteProjects, setFavoriteProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingFavoriteId, setTogglingFavoriteId] = useState<number | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      const [recent, favorites] = await Promise.all([
        projectsApi.fetchRecentProjects(10),
        projectsApi.fetchFavoriteProjects(),
      ]);
      setRecentProjects(recent as Project[]);
      setFavoriteProjects(favorites as Project[]);
    } catch (err) {
      console.error('Sidebar: failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load only — event listeners handle subsequent refreshes
  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  // Listen for custom events (favorite toggled, project accessed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let debounce: ReturnType<typeof setTimeout>;
    const onFav = () => void fetchProjects();
    const onAccess = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void fetchProjects(), 400);
    };
    window.addEventListener('planora:favorite-toggled', onFav);
    window.addEventListener('planora:project-accessed', onAccess);
    return () => {
      clearTimeout(debounce);
      window.removeEventListener('planora:favorite-toggled', onFav);
      window.removeEventListener('planora:project-accessed', onAccess);
    };
  }, [fetchProjects]);

  const handleProjectClick = useCallback(async (project: Project) => {
    localStorage.setItem('currentProjectName', project.name);
    localStorage.setItem('currentProjectId', project.id.toString());
    try { await projectsApi.recordProjectAccess(project.id); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent('planora:project-accessed'));
  }, []);

  const handleToggleFavourite = useCallback(
    async (e: React.MouseEvent, project: Project) => {
      e.preventDefault();
      e.stopPropagation();
      if (togglingFavoriteId === project.id) return;
      setTogglingFavoriteId(project.id);
      setFavoriteProjects(prev => prev.filter(p => p.id !== project.id));
      try {
        await projectsApi.toggleFavorite(project.id);
        window.dispatchEvent(new CustomEvent('planora:favorite-toggled'));
        await fetchProjects();
      } catch {
        await fetchProjects();
      } finally {
        setTogglingFavoriteId(null);
      }
    },
    [togglingFavoriteId, fetchProjects],
  );

  return {
    recentProjects,
    favoriteProjects,
    loading,
    togglingFavoriteId,
    fetchProjects,
    handleProjectClick,
    handleToggleFavourite,
  };
}
