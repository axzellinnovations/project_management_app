'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { PageItem, PageHistoryItem } from '../components/types';
import { predefinedTemplates } from '../components/TemplateSelector';
import { usePages } from '../components/usePages';
import axiosInstance from '../../../../lib/axios';
import TurndownService from 'turndown';
import { marked } from 'marked';

export function usePageEditor() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string;
  const isDraft = pageId === 'new';

  const [projectId, setProjectId] = useState<string | number | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle' | 'draft'>('idle');
  const [title, setTitle] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyMock, setHistoryMock] = useState<PageHistoryItem[]>([]);
  const [showDocSidebar, setShowDocSidebar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const queryProjectId = searchParams.get('projectId');
    if (queryProjectId) {
      setProjectId(queryProjectId);
      localStorage.setItem('currentProjectId', queryProjectId);
      return;
    }
    const storedProjectId = localStorage.getItem('currentProjectId');
    if (storedProjectId) setProjectId(storedProjectId);
  }, [searchParams]);

  const {
    filteredPages, error, searchQuery, setSearchQuery,
    updatePage, createPage, deletePage, refetch,
  } = usePages(projectId);

  useEffect(() => {
    if (!pageId) return;

    if (isDraft) {
      const templateId = searchParams.get('template') || 'blank';
      const template = predefinedTemplates.find(t => t.id === templateId) || predefinedTemplates[0];
      const defaultTitle = template.id === 'blank' ? 'Untitled Page' : template.name;
      setSelectedPage({ id: 'new', title: defaultTitle, content: template.content, isStarred: false });
      setTitle(defaultTitle);
      setSaveStatus('draft');
      setHistoryMock([]);
      return;
    }

    const fetchPageDetail = async () => {
      setLoadingPage(true);
      try {
        const response = await axiosInstance.get(`/api/pages/${pageId}`);
        const pageData: PageItem = {
          id: response.data.id,
          title: response.data.title,
          content: response.data.content || '',
          updatedAt: response.data.updatedAt,
          isStarred: false,
        };
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
            editedAt: response.data.createdAt || new Date(Date.now() - 86400000).toISOString(),
          },
        ]);
      } catch (err) {
        console.error('Error fetching page:', err);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchPageDetail();
  }, [pageId, isDraft, searchParams]);

  const handleUpdateContent = useCallback(async (htmlContent: string) => {
    if (!selectedPage || !projectId) return;
    setSelectedPage(prev => prev ? { ...prev, content: htmlContent } : null);
    if (isDraft) { setSaveStatus('draft'); return; }

    setSaveStatus('saving');
    try {
      await updatePage(selectedPage.id, title, htmlContent);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      setHistoryMock(prev => [{
        id: Math.random().toString(),
        pageId: selectedPage.id,
        action: 'edited',
        editedBy: 'You',
        editedAt: new Date().toISOString(),
      }, ...prev.slice(0, 9)]);
    } catch (err) {
      console.error('Error auto-saving:', err);
      setSaveStatus('error');
    }
  }, [selectedPage, title, projectId, updatePage, isDraft]);

  // Debounced title save
  useEffect(() => {
    if (!selectedPage || title === selectedPage.title || !projectId) return;
    if (isDraft) { setSelectedPage(prev => prev ? { ...prev, title } : null); return; }

    const timeoutId = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updatePage(selectedPage.id, title, selectedPage.content || '');
        setSelectedPage(prev => prev ? { ...prev, title } : null);
        refetch();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Error auto-saving title:', err);
        setSaveStatus('error');
      }
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [title, selectedPage, projectId, updatePage, refetch, isDraft]);

  const handleManualCreate = async () => {
    if (!selectedPage || !projectId) return;
    setSaveStatus('saving');
    try {
      const newPage = await createPage(title, selectedPage.content || '');
      setSaveStatus('saved');
      router.replace(projectId ? `/pages/${newPage.id}?projectId=${projectId}` : `/pages/${newPage.id}`);
    } catch (err) {
      console.error('Error creating document:', err);
      setSaveStatus('error');
    }
  };

  const handleDeletePage = async () => {
    if (isDraft) {
      router.push(projectId ? `/pages?projectId=${projectId}` : '/pages');
      return;
    }
    if (!selectedPage || !confirm('Are you sure you want to delete this document?')) return;
    try {
      await deletePage(selectedPage.id);
      router.push(projectId ? `/pages?projectId=${projectId}` : '/pages');
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPage) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      let htmlContent = text;
      if (file.name.endsWith('.md')) {
        htmlContent = await marked.parse(text);
      }
      handleUpdateContent(htmlContent);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExport = () => {
    if (!selectedPage) return;
    const turndownService = new TurndownService({ headingStyle: 'atx' });
    const mdContent = turndownService.turndown(selectedPage.content || '');
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    pageId,
    isDraft,
    projectId,
    selectedPage,
    loadingPage,
    saveStatus,
    title, setTitle,
    showHistory, setShowHistory,
    historyMock,
    showDocSidebar, setShowDocSidebar,
    fileInputRef,
    filteredPages,
    error,
    searchQuery, setSearchQuery,
    handleUpdateContent,
    handleManualCreate,
    handleDeletePage,
    handleFileImport,
    handleExport,
  };
}
