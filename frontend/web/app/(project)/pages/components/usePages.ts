'use client';

import { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../../../../lib/axios';

import { PageItem } from './types';
export type { PageItem };

interface PageSummaryDto {
  id: number;
  title: string;
}

interface PageDetailDto {
  id: number;
  title: string;
  content?: string;
  updatedAt?: string;
}

interface UsePagesReturn {
  pages: PageItem[];
  filteredPages: PageItem[];
  loading: boolean;
  error: string | null;
  activeTab: 'all' | 'starred' | 'recent';
  setActiveTab: (tab: 'all' | 'starred' | 'recent') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  createPage: (title: string, content: string) => Promise<PageItem>;
  updatePage: (pageId: string | number, title: string, content: string) => Promise<PageItem>;
  deletePage: (pageId: string | number) => Promise<void>;
  refetch: () => Promise<void>;
  toggleStar: (pageId: string | number) => void;
}

export function usePages(projectId: string | number | null): UsePagesReturn {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'starred' | 'recent'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all pages for the project
  const fetchPages = useCallback(async () => {
    if (!projectId) {
      setError('Project ID not found');
      return;
    }

    const cacheKey = `planora:pages:${projectId}`;
    // Stale-while-revalidate: the sidebar populates instantly from cache while the fresh list loads in the background
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setPages(JSON.parse(cached) as PageItem[]);
        setLoading(false);
      } catch { /* ignore corrupt cache */ }
    }

    setError(null);
    try {
      const response = await axiosInstance.get<PageSummaryDto[]>(`/api/projects/${projectId}/pages`);
      const pagesData = (response.data || []).map((page) => ({
        id: page.id,
        title: page.title,
        isStarred: false, // TODO: sync with backend when implemented
      }));
      setPages(pagesData);
      localStorage.setItem(cacheKey, JSON.stringify(pagesData));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to fetch pages';
      if (!cached) setError(message);
      console.error('Error fetching pages:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch pages on mount or when projectId changes
  useEffect(() => {
    fetchPages();
  }, [projectId, fetchPages]);

  // Filter pages based on active tab and search query
  const filteredPages = pages.filter((page) => {
    const matchesSearch = page.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'starred':
        return page.isStarred;
      case 'recent':
        // Show 5 most recent pages
        return pages.indexOf(page) < 5;
      case 'all':
      default:
        return true;
    }
  });

  // Create a new page
  const createPage = async (title: string, content: string): Promise<PageItem> => {
    if (!projectId) throw new Error('Project ID not found');

    try {
      const response = await axiosInstance.post<PageDetailDto>(`/api/projects/${projectId}/pages`, { title, content });
      const newPage: PageItem = {
        id: response.data.id,
        title: response.data.title,
        content: response.data.content,
        updatedAt: response.data.updatedAt,
        isStarred: false,
      };
      setPages((prev) => [...prev, newPage]);
      return newPage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to create page';
      setError(message);
      throw new Error(message);
    }
  };

  // Update an existing page
  const updatePage = async (pageId: string | number, title: string, content: string): Promise<PageItem> => {
    try {
      const response = await axiosInstance.put<PageDetailDto>(`/api/pages/${pageId}`, {
        title,
        content,
      });
      const updatedPage: PageItem = {
        id: response.data.id,
        title: response.data.title,
        content: response.data.content,
        updatedAt: response.data.updatedAt,
        isStarred: pages.find((p) => p.id === pageId)?.isStarred || false,
      };
      setPages((prev) => prev.map((p) => (p.id === pageId ? updatedPage : p)));
      return updatedPage;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to update page';
      setError(message);
      throw new Error(message);
    }
  };

  // Delete a page
  const deletePage = async (pageId: string | number): Promise<void> => {
    try {
      await axiosInstance.delete(`/api/pages/${pageId}`);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const message = err.response?.data?.message || 'Failed to delete page';
      setError(message);
      throw new Error(message);
    }
  };

  // Toggle star status
  const toggleStar = (pageId: string | number) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isStarred: !p.isStarred } : p)));
  };

  // Refetch pages
  const refetch = fetchPages;

  return {
    pages,
    filteredPages,
    loading,
    error,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    createPage,
    updatePage,
    deletePage,
    refetch,
    toggleStar,
  };
}
