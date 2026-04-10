'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { usePageContent } from './hooks/usePageContent';
import TurndownService from 'turndown';
import { marked } from 'marked';

export function usePageEditor() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string;

  // Optimized: Derive projectId immediately for lag-free initialization
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const {
    selectedPage, setSelectedPage,
    title, setTitle,
    loadingPage,
    historyMock, setHistoryMock,
    isDraft,
    filteredPages, error, searchQuery, setSearchQuery,
    updatePage, createPage, deletePage, refetch,
  } = usePageContent(pageId, projectId);

  // saveStatus starts as 'draft' for new pages, 'idle' otherwise
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error' | 'idle' | 'draft'>(
    () => (pageId === 'new' ? 'draft' : 'idle'),
  );
  const [showHistory, setShowHistory] = useState(false);
  const [showDocSidebar, setShowDocSidebar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [selectedPage, title, projectId, updatePage, isDraft, setSelectedPage, setHistoryMock]);

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
  }, [title, selectedPage, projectId, updatePage, refetch, isDraft, setSelectedPage]);

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
