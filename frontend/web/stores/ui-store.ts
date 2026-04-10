'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceView } from '@/types';

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;

  // Active view
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;

  // Command palette (Cmd+K)
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // Detail panel
  detailPanelOpen: boolean;
  detailPanelFullPage: boolean;
  setDetailPanelOpen: (open: boolean) => void;
  setDetailPanelFullPage: (full: boolean) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),

      // Active view
      activeView: 'board',
      setActiveView: (view) => set({ activeView: view }),

      // Command palette
      commandPaletteOpen: false,
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

      // Detail panel
      detailPanelOpen: false,
      detailPanelFullPage: false,
      setDetailPanelOpen: (open) => set({ detailPanelOpen: open }),
      setDetailPanelFullPage: (full) => set({ detailPanelFullPage: full }),
    }),
    {
      name: 'planora-ui',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        activeView: state.activeView,
      }),
    }
  )
);
