'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import DocumentSidebar from '../components/DocumentSidebar';
import Editor from '../components/Editor';
import { usePages } from '../components/usePages';
import { PageItem, PageHistoryItem } from '../components/types';
import { predefinedTemplates } from '../components/TemplateSelector';
import axiosInstance from '../../../../lib/axios';
import {
  Download, Upload, Trash2, CheckCircle2, Loader2,
  Save, FileEdit, History, X,
} from 'lucide-react';
import TurndownService from 'turndown';
import { marked } from 'marked';

export default function PageDetailPage() {
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

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center text-gray-500">Loading project information...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-white overflow-hidden rounded-lg border border-gray-200 shadow-sm mt-4 mb-4 mx-4">
      {/* Left Sidebar */}
      <DocumentSidebar
        pages={filteredPages}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedPageId={isDraft ? null : pageId}
        projectId={projectId}
        onCreateClick={() => router.push(projectId ? `/pages?projectId=${projectId}` : '/pages')}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
        {loadingPage ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : selectedPage ? (
          <>
            {/* ─── Page Header ─── */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white flex-shrink-0">
              {/* Title + rename hint */}
              <div className="flex items-center gap-3 flex-1 min-w-0 group">
                <div className="relative flex items-center flex-1 min-w-0 max-w-lg">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-xl font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-blue-200 rounded px-1 truncate"
                    placeholder="Document Title..."
                    title="Click to rename"
                  />
                  <FileEdit
                    className="absolute right-2 opacity-0 group-hover:opacity-30 transition-opacity text-gray-500 pointer-events-none flex-shrink-0"
                    size={16}
                  />
                </div>

                {/* Save status / Publish button */}
                <div className="flex items-center text-sm flex-shrink-0">
                  {isDraft ? (
                    <button
                      onClick={handleManualCreate}
                      disabled={saveStatus === 'saving'}
                      className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 text-sm"
                    >
                      {saveStatus === 'saving' ? (
                        <><Loader2 size={14} className="animate-spin" /> Publishing...</>
                      ) : (
                        <><Save size={14} /> Publish</>
                      )}
                    </button>
                  ) : (
                    <span className="w-24 text-right">
                      {saveStatus === 'saving' && (
                        <span className="flex items-center gap-1 text-gray-400 text-xs">
                          <Loader2 size={12} className="animate-spin" /> Saving...
                        </span>
                      )}
                      {saveStatus === 'saved' && (
                        <span className="flex items-center gap-1 text-green-600 text-xs">
                          <CheckCircle2 size={12} /> Saved
                        </span>
                      )}
                      {saveStatus === 'error' && (
                        <span className="text-red-500 text-xs">Save failed</span>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
                <input
                  type="file" ref={fileInputRef} className="hidden"
                  accept=".md,.html" onChange={handleFileImport}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Import Markdown or HTML"
                >
                  <Upload size={14} /> Import
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Export as Markdown"
                >
                  <Download size={14} /> Export .md
                </button>

                {!isDraft && (
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      showHistory
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'text-gray-600 bg-gray-50 border border-gray-200 hover:bg-gray-100'
                    }`}
                    title="Version History"
                  >
                    <History size={14} /> History
                  </button>
                )}

                <div className="h-5 w-px bg-gray-200 mx-1" />
                <button
                  onClick={handleDeletePage}
                  className="p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                  title={isDraft ? 'Discard Draft' : 'Delete Document'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* ─── Editor + History Panel ─── */}
            <div className="flex-1 flex overflow-hidden relative">
              <div className={`flex-1 overflow-hidden transition-all duration-300 ${showHistory ? 'mr-[300px]' : ''}`}>
                <Editor
                  content={selectedPage.content || ''}
                  onUpdate={handleUpdateContent}
                />
              </div>

              {/* Version History Drawer */}
              {showHistory && (
                <div className="absolute right-0 top-0 w-[300px] h-full border-l border-gray-200 bg-gray-50 flex flex-col z-20 shadow-[-4px_0_15px_rgba(0,0,0,0.04)]">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
                      <History size={16} className="text-blue-500" /> Version History
                    </h3>
                    <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-5">
                      {historyMock.map((history) => (
                        <div key={history.id} className="relative pl-5 border-l-2 border-gray-200 py-0.5">
                          <div className="absolute -left-[7px] top-1.5 h-3 w-3 rounded-full bg-white border-2 border-blue-500" />
                          <p className="text-sm font-medium text-gray-900 mb-0.5 flex items-center gap-1.5 flex-wrap">
                            {history.editedBy}
                            <span className="text-xs font-normal px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                              {history.action}
                            </span>
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(history.editedAt).toLocaleString(undefined, {
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 bg-white border-t border-gray-100 text-xs text-gray-400 text-center">
                    Tracking edits in real time
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">Page not found or you do not have access.</p>
          </div>
        )}
      </div>

      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-lg shadow-md z-50">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  );
}
