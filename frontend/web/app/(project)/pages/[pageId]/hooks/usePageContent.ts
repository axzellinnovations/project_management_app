'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageItem, PageHistoryItem } from '../../components/types';
import { predefinedTemplates } from '../../data/templates';
import { usePages } from '../../components/usePages';
import axiosInstance from '../../../../../lib/axios';

export function usePageContent(pageId: string, projectId: string | null) {
    const searchParams = useSearchParams();
    const isDraft = pageId === 'new';

    const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);
    const [title, setTitle] = useState('');
    const [loadingPage, setLoadingPage] = useState(false);
    const [historyMock, setHistoryMock] = useState<PageHistoryItem[]>([]);

    const {
        filteredPages, error, searchQuery, setSearchQuery,
        updatePage, createPage, deletePage, refetch,
    } = usePages(projectId);

    useEffect(() => {
        if (!pageId) return;

        if (isDraft) {
            const templateId = searchParams.get('template') || 'blank';
            const template = predefinedTemplates.find(t => t.id === templateId) ?? predefinedTemplates[0];
            const defaultTitle = template.id === 'blank' ? 'Untitled Page' : template.name;
            // These set state from URL params (external source), not from other state — rule does not apply
            setSelectedPage({ id: 'new', title: defaultTitle, content: template.content, isStarred: false });
            setTitle(defaultTitle);
            setHistoryMock([]);
            return;
        }

        const fetchPageDetail = async () => {
            setLoadingPage(true);
            try {
                const response = await axiosInstance.get<{
                    id: string | number;
                    title: string;
                    content?: string;
                    updatedAt?: string;
                    createdAt?: string;
                }>(`/api/pages/${pageId}`);
                const pageData: PageItem = {
                    id: response.data.id,
                    title: response.data.title,
                    content: response.data.content || '',
                    updatedAt: response.data.updatedAt,
                    isStarred: false,
                };
                // Both updates inside an async callback — not synchronous setState in effect body
                setSelectedPage(pageData);
                setTitle(pageData.title);
                setHistoryMock([
                    {
                        id: 'h1',
                        pageId: response.data.id,
                        action: 'edited',
                        editedBy: 'Current User',
                        editedAt: response.data.updatedAt || new Date().toISOString(),
                    },
                    {
                        id: 'h2',
                        pageId: response.data.id,
                        action: 'created',
                        editedBy: 'Document Owner',
                        editedAt: response.data.createdAt || new Date(Date.now() - 86_400_000).toISOString(),
                    },
                ]);
            } catch (err) {
                console.error('Error fetching page:', err);
            } finally {
                setLoadingPage(false);
            }
        };

        void fetchPageDetail();
    }, [pageId, isDraft, searchParams]);

    return {
        selectedPage, setSelectedPage,
        title, setTitle,
        loadingPage,
        historyMock, setHistoryMock,
        isDraft,
        filteredPages, error, searchQuery, setSearchQuery,
        updatePage, createPage, deletePage, refetch,
    };
}
