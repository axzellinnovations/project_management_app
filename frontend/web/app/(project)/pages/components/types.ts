// Shared types live here to prevent circular imports between usePages, DocumentSidebar, and the page routes
import React from 'react';

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

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  content: string;
}
