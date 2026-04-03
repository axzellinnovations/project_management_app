'use client';

import { create } from 'zustand';

interface TaskStoreState {
  // Active task for detail panel
  activeTaskId: number | null;
  setActiveTaskId: (id: number | null) => void;

  // Bulk selection
  selectedTaskIds: Set<number>;
  toggleTaskSelection: (id: number) => void;
  selectAllTasks: (ids: number[]) => void;
  clearSelection: () => void;
  isSelected: (id: number) => boolean;

  // Inline editing
  editingTaskId: number | null;
  setEditingTaskId: (id: number | null) => void;
}

export const useTaskStore = create<TaskStoreState>()((set, get) => ({
  // Active task
  activeTaskId: null,
  setActiveTaskId: (id) => set({ activeTaskId: id }),

  // Bulk selection
  selectedTaskIds: new Set<number>(),
  toggleTaskSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedTaskIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedTaskIds: next };
    }),
  selectAllTasks: (ids) => set({ selectedTaskIds: new Set(ids) }),
  clearSelection: () => set({ selectedTaskIds: new Set() }),
  isSelected: (id) => get().selectedTaskIds.has(id),

  // Inline editing
  editingTaskId: null,
  setEditingTaskId: (id) => set({ editingTaskId: id }),
}));
