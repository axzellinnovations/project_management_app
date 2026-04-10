import { useState, useEffect } from 'react';
import * as projectsApi from '@/services/projects-service';

interface FolderStats {
  viewAll: number;
  recent: number;
  favorites: number;
  shared: number;
  trash: number;
}

interface Doc {
  id: number;
  createdAt: string;
  uploadedByName?: string;
  status?: string;
}

const EMPTY_STATS: FolderStats = { viewAll: 0, recent: 0, favorites: 0, shared: 0, trash: 0 };

export function useFolderStats(projectId: string | null, username?: string, pathname?: string) {
  const [folderStats, setFolderStats] = useState<FolderStats>(EMPTY_STATS);

  useEffect(() => {
    const update = () => {
      if (!projectId) {
        setFolderStats(EMPTY_STATS);
        return;
      }

      Promise.all([
      projectsApi.fetchDocuments(projectId, false),
      projectsApi.fetchDocuments(projectId, true),
    ])
      .then(([docs, allDocs]) => {
        const docList = (Array.isArray(docs) ? docs : []) as Doc[];
        const allDocList = (Array.isArray(allDocs) ? allDocs : []) as Doc[];
        const recentWindow = 14 * 24 * 60 * 60 * 1000;
        const now = Date.now();

        let favoriteIds: number[] = [];
        if (typeof window !== 'undefined') {
          try {
            favoriteIds = JSON.parse(localStorage.getItem('dmsFavoriteDocumentIds') || '[]');
          } catch { /* ignore */ }
        }

        setFolderStats({
          viewAll: docList.length,
          recent: docList.filter(d => now - new Date(d.createdAt).getTime() <= recentWindow).length,
          favorites: docList.filter(d => favoriteIds.includes(d.id)).length,
          shared: username ? docList.filter(d => d.uploadedByName !== username).length : 0,
          trash: allDocList.filter(d => d.status === 'SOFT_DELETED').length,
        });
      })
      .catch(() => setFolderStats(EMPTY_STATS));
    };
    update();
  }, [projectId, username, pathname]);

  return folderStats;
}
