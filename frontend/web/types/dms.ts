// ── Document / DMS Domain Types ────────────────────

export type DocumentStatus = 'ACTIVE' | 'SOFT_DELETED';

export interface DocumentFolder {
  id: number;
  name: string;
  projectId: number;
  parentFolderId: number | null;
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: number;
  name: string;
  contentType: string;
  fileSize: number;
  status: DocumentStatus;
  projectId: number;
  folderId: number | null;
  latestVersionNumber: number;
  downloadUrl: string | null;
  uploadedById: number;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface DocumentVersionItem {
  id: number;
  versionNumber: number;
  contentType: string;
  fileSize: number;
  uploadedById: number;
  uploadedByName: string;
  uploadedAt: string;
  downloadUrl: string;
}

// ── Pages / Documentation ──────────────────────────

export interface PageItem {
  id: string | number;
  title: string;
  content?: string;
  parentId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  isStarred?: boolean;
}

export interface PageHistoryItem {
  id: string;
  pageId: string | number;
  editedBy: string;
  editedAt: string;
  action: 'created' | 'edited' | 'restored';
}

// ── DMS View Mode ──────────────────────────────────

export type ViewMode = 'view-all' | 'recent' | 'favorites' | 'shared' | 'trash';
