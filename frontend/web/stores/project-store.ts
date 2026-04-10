'use client';

import { create } from 'zustand';
import type { Project } from '@/types';

interface ProjectStoreState {
  // Current active project
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;

  // Projects list (spaces tree)
  projects: Project[];
  setProjects: (projects: Project[]) => void;

  // Spaces tree expand/collapse
  expandedSpaces: Record<number, boolean>;
  toggleSpaceExpanded: (id: number) => void;
  setSpaceExpanded: (id: number, expanded: boolean) => void;

  // Favorites
  favoriteProjectIds: Set<number>;
  toggleFavorite: (id: number) => void;
  setFavorites: (ids: number[]) => void;
}

export const useProjectStore = create<ProjectStoreState>()((set, _get) => ({
  // Current project
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),

  // Projects list
  projects: [],
  setProjects: (projects) => set({ projects }),

  // Spaces tree
  expandedSpaces: {},
  toggleSpaceExpanded: (id) =>
    set((s) => ({
      expandedSpaces: {
        ...s.expandedSpaces,
        [id]: !s.expandedSpaces[id],
      },
    })),
  setSpaceExpanded: (id, expanded) =>
    set((s) => ({
      expandedSpaces: { ...s.expandedSpaces, [id]: expanded },
    })),

  // Favorites
  favoriteProjectIds: new Set<number>(),
  toggleFavorite: (id) =>
    set((s) => {
      const next = new Set(s.favoriteProjectIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { favoriteProjectIds: next };
    }),
  setFavorites: (ids) => set({ favoriteProjectIds: new Set(ids) }),
}));
