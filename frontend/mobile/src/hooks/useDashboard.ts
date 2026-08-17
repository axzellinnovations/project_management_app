import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/axios';
import { taskService, sprintboardService } from '../services/task-service';
import { getValidToken, getUserFromToken } from '../lib/auth';
import { offlineSyncManager } from '../services/offlineSyncManager';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectSummary {
  id: number;
  name: string;
  projectKey?: string;
  isFavorite?: boolean;
  type: 'AGILE' | 'KANBAN' | string;
}

export interface DashboardItem {
  id: string;
  realId: number;
  projectId?: number;
  type: 'TASK' | 'PROJECT_AGILE' | 'PROJECT_KANBAN' | 'BOARD';
  name: string;
  location: string;
  status?: string;
  timestamp: string;
}

export type TabKey = 'assigned-to-me' | 'worked-on' | 'viewed' | 'favorites' | 'boards';
export type TabItemsByKey = Record<TabKey, DashboardItem[]>;
export type TabLoadingByKey = Record<TabKey, boolean>;

const EMPTY_TAB_ITEMS: TabItemsByKey = {
  'assigned-to-me': [],
  'worked-on': [],
  viewed: [],
  favorites: [],
  boards: [],
};

const EMPTY_TAB_LOADING: TabLoadingByKey = {
  'assigned-to-me': false,
  'worked-on': false,
  viewed: false,
  favorites: false,
  boards: false,
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapProject(p: {
  id: number; type?: string; name: string; projectKey?: string; updatedAt?: string; createdAt?: string;
}): DashboardItem {
  return {
    id: `P-${p.id}`,
    realId: p.id,
    type: p.type === 'KANBAN' ? 'PROJECT_KANBAN' : 'PROJECT_AGILE',
    name: p.name,
    location: p.projectKey || 'Workspace',
    timestamp: p.updatedAt || p.createdAt || new Date().toISOString(),
  };
}

function mapTask(t: {
  id: number; projectId?: number; title: string; projectName?: string; status?: string;
  updatedAt?: string; createdAt?: string;
}): DashboardItem {
  const VALID = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
  const normalized = t.status?.toUpperCase() ?? 'TODO';
  const status = VALID.includes(normalized) ? normalized : 'TODO';
  return {
    id: `T-${t.id}`,
    realId: t.id,
    projectId: t.projectId,
    type: 'TASK',
    name: t.title,
    location: t.projectName || 'Project',
    status,
    timestamp: t.updatedAt || t.createdAt || new Date().toISOString(),
  };
}

function mapBoard(b: {
  id: number; projectId: number; name: string; projectName: string; updatedAt?: string;
}): DashboardItem {
  return {
    id: `B-${b.id}`,
    realId: b.projectId,
    type: 'BOARD',
    name: b.name,
    location: b.projectName,
    timestamp: b.updatedAt || new Date().toISOString(),
  };
}

// ─── Tab Data Fetcher ─────────────────────────────────────────────────────────

async function fetchTabData(tab: TabKey): Promise<DashboardItem[]> {
  switch (tab) {
    case 'boards': {
      const data = await sprintboardService.getRecent(20);
      return data.map(mapBoard);
    }
    case 'favorites': {
      const res = await api.get('/api/projects/favorites');
      return res.data.map(mapProject);
    }
    case 'assigned-to-me': {
      const data = await taskService.getAssigned();
      return data.map(mapTask);
    }
    case 'worked-on': {
      const data = await taskService.getWorkedOn();
      return data.map(mapTask);
    }
    case 'viewed': {
      const [pRes, tData] = await Promise.all([
        api.get('/api/projects/recent?limit=20').catch(() => ({ data: [] })),
        taskService.getRecent({ limit: 20 }).catch(() => []),
      ]);
      return [
        ...pRes.data.map(mapProject),
        ...tData.map(mapTask),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    default:
      return [];
  }
}

// ─── useDashboard Hook ────────────────────────────────────────────────────────

interface UseDashboardReturn {
  user: { username?: string; email?: string; profilePicUrl?: string | null } | null;
  projects: { recent: ProjectSummary[]; favorites: ProjectSummary[] };
  tabItems: DashboardItem[];
  tabItemsByTab: TabItemsByKey;
  assignedCount: number;
  loadingProjects: boolean;
  loadingTab: boolean;
  loadingTabs: TabLoadingByKey;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  refreshProjects: () => void;
  refreshTab: () => void;
  toggleFavorite: (id: number) => Promise<void>;
  recordAccess: (id: number) => Promise<void>;
  isOnline: boolean;
  isStale: boolean;
}

export function useDashboard(): UseDashboardReturn {
  const router = useRouter();

  const [user, setUser]                       = useState<{ username?: string; email?: string; profilePicUrl?: string | null } | null>(null);
  const [projects, setProjects]               = useState<{ recent: ProjectSummary[]; favorites: ProjectSummary[] }>({ recent: [], favorites: [] });
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [activeTab, setActiveTab]             = useState<TabKey>('assigned-to-me');
  const [tabItemsByTab, setTabItemsByTab]     = useState<TabItemsByKey>(EMPTY_TAB_ITEMS);
  const [loadingTabs, setLoadingTabs]         = useState<TabLoadingByKey>(EMPTY_TAB_LOADING);
  const [assignedCount, setAssignedCount]     = useState(0);

  const [isOnline, setIsOnline]               = useState(offlineSyncManager.getOnlineStatus());
  const [isStale, setIsStale]                 = useState(true);

  // ── Load cached data from AsyncStorage ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [cachedProj, cachedTabs, cachedCount] = await Promise.all([
          AsyncStorage.getItem('dashboard_projects'),
          AsyncStorage.getItem('dashboard_tabs'),
          AsyncStorage.getItem('dashboard_assigned_count'),
        ]);
        if (cachedProj) {
          setProjects(JSON.parse(cachedProj));
        }
        if (cachedTabs) {
          setTabItemsByTab(JSON.parse(cachedTabs));
        }
        if (cachedCount) {
          setAssignedCount(Number(cachedCount));
        }
      } catch (e) {
        console.error('Failed to load dashboard cache', e);
      }
    })();
  }, []);

  // ── Check auth ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace('/(auth)/login');
        return;
      }
      // Decode username from JWT payload using safe base64url decoder
      try {
        const decodedUser = await getUserFromToken();
        const username = decodedUser?.username || decodedUser?.email;
        setUser({ username, email: decodedUser?.email, profilePicUrl: null });

        // Fetch user profile to get the S3 presigned URL for the profile photo
        api.get('/api/user/profile')
          .then((res) => {
            if (res.data && res.data.profilePicUrl) {
              setUser(prev => prev ? { ...prev, profilePicUrl: res.data.profilePicUrl } : null);
            }
          })
          .catch(() => {});
      } catch {
        setUser({});
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch recent & favorite projects ────────────────────────────────────────
  const fetchProjects = useCallback(async () => {
    setLoadingProjects(true);
    try {
      const [recentRes, favRes] = await Promise.all([
        api.get('/api/projects/recent'),
        api.get('/api/projects/favorites'),
      ]);
      const data = { recent: recentRes.data || [], favorites: favRes.data || [] };
      setProjects(data);
      await AsyncStorage.setItem('dashboard_projects', JSON.stringify(data));
      setIsStale(false);
    } catch (e) {
      console.error('Dashboard fetchProjects error', e);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => { void fetchProjects(); }, [fetchProjects]);

  // ── Fetch assigned count (always) ───────────────────────────────────────────
  const fetchAssignedCount = useCallback(async () => {
    try {
      const data = await taskService.getAssigned({ limit: 100 });
      const pending = data.filter((t: { status?: string }) => t.status !== 'DONE').length;
      setAssignedCount(pending);
      await AsyncStorage.setItem('dashboard_assigned_count', String(pending));
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    void fetchAssignedCount();
  }, [fetchAssignedCount]);

  // ── Fetch tab data ───────────────────────────────────────────────────────────
  const fetchTab = useCallback(async (tab: TabKey) => {
    setLoadingTabs(prev => ({ ...prev, [tab]: true }));
    try {
      const items = await fetchTabData(tab);
      setTabItemsByTab(prev => {
        const next = { ...prev, [tab]: items };
        AsyncStorage.setItem('dashboard_tabs', JSON.stringify(next)).catch(console.error);
        return next;
      });
      setIsStale(false);
    } catch (e) {
      console.error('Dashboard fetchTab error', e);
      // In case of error (e.g. offline), we keep using cache if present
    } finally {
      setLoadingTabs(prev => ({ ...prev, [tab]: false }));
    }
  }, []);

  useEffect(() => { void fetchTab(activeTab); }, [activeTab, fetchTab]);

  // Preload other tabs
  useEffect(() => {
    void fetchTab('worked-on');
    void fetchTab('favorites');
  }, [fetchTab]);

  // ── Listen to Sync Manager connection & sync events ────────────────────────
  useEffect(() => {
    const removeListener = offlineSyncManager.addListener((event) => {
      if (event.type === 'CONNECTION_CHANGED') {
        setIsOnline(event.isOnline);
      } else if (event.type === 'SYNC_COMPLETED') {
        void fetchProjects();
        void fetchAssignedCount();
        void fetchTab(activeTab);
      }
    });
    return removeListener;
  }, [fetchProjects, fetchAssignedCount, fetchTab, activeTab]);

  // ── Toggle favorite ──────────────────────────────────────────────────────────
  const toggleFavorite = useCallback(async (id: number) => {
    try {
      await api.post(`/api/projects/${id}/favorite`);
      void fetchProjects();
      void fetchTab('favorites');
    } catch (e) {
      console.error('toggleFavorite error', e);
    }
  }, [fetchProjects, fetchTab]);

  // ── Record project access ────────────────────────────────────────────────────
  const recordAccess = useCallback(async (id: number) => {
    try { await api.post(`/api/projects/${id}/access`); } catch { /* silent */ }
  }, []);

  return {
    user,
    projects,
    tabItems: tabItemsByTab[activeTab],
    tabItemsByTab,
    assignedCount,
    loadingProjects,
    loadingTab: loadingTabs[activeTab],
    loadingTabs,
    activeTab,
    setActiveTab,
    refreshProjects: fetchProjects,
    refreshTab: () => {
      (Object.keys(EMPTY_TAB_ITEMS) as TabKey[]).forEach(tab => { void fetchTab(tab); });
    },
    toggleFavorite,
    recordAccess,
    isOnline,
    isStale,
  };
}
