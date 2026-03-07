'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import PagesList from '../components/PagesList';
import PagesContent from '../components/PagesContent';
import PageEditor from '../components/PageEditor';
import { usePages, PageItem } from '../components/usePages';
import axiosInstance from '../../../../lib/axios';

export default function PageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params?.pageId as string;

  const [projectId, setProjectId] = useState<string | number | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageItem | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Prefer route query (?projectId=), then fallback to localStorage
  useEffect(() => {
    const queryProjectId = searchParams.get('projectId');
    if (queryProjectId) {
      setProjectId(queryProjectId);
      localStorage.setItem('currentProjectId', queryProjectId);
      return;
    }

    const storedProjectId = localStorage.getItem('currentProjectId');
    if (storedProjectId) {
      setProjectId(storedProjectId);
    }
  }, [searchParams]);

  const {
    filteredPages,
    error,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    updatePage,
    deletePage,
    toggleStar,
  } = usePages(projectId);

  // Fetch single page details
  useEffect(() => {
    if (!pageId) return;

    const fetchPageDetail = async () => {
      setLoadingPage(true);
      try {
        const response = await axiosInstance.get(`/api/pages/${pageId}`);
        setSelectedPage({
          id: response.data.id,
          title: response.data.title,
          content: response.data.content,
          updatedAt: response.data.updatedAt,
          isStarred: false,
        });
      } catch (err) {
        console.error('Error fetching page:', err);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchPageDetail();
  }, [pageId]);

  const handleEditPage = async (title: string, content: string) => {
    if (!selectedPage) return;

    setIsSaving(true);
    try {
      const updated = await updatePage(selectedPage.id, title, content);
      setSelectedPage(updated);
      setIsEditorOpen(false);
    } catch (err) {
      console.error('Error updating page:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePage = async () => {
    if (!selectedPage) return;

    try {
      await deletePage(selectedPage.id);
      setShowDeleteConfirm(false);
      router.push(projectId ? `/pages?projectId=${projectId}` : '/pages');
    } catch (err) {
      console.error('Error deleting page:', err);
    }
  };

  const handleToggleStar = () => {
    if (selectedPage) {
      toggleStar(selectedPage.id);
      setSelectedPage({
        ...selectedPage,
        isStarred: !selectedPage.isStarred,
      });
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading project information...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full w-full gap-6 bg-[#f4f7f9]">
        {/* Left Sidebar */}
        <PagesList
          pages={filteredPages}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPageId={pageId}
          projectId={projectId}
          onCreateClick={() => setIsEditorOpen(true)}
        />

        {/* Main Content Area */}
        <PagesContent
          selectedPage={selectedPage}
          loading={loadingPage}
          onCreateClick={() => setIsEditorOpen(true)}
          onEditClick={() => setIsEditorOpen(true)}
          onDeleteClick={() => setShowDeleteConfirm(true)}
          onStarClick={handleToggleStar}
        />
      </div>

      {/* Page Editor Modal */}
      <PageEditor
        isOpen={isEditorOpen}
        page={selectedPage}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleEditPage}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Page?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{selectedPage?.title}"? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePage}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-md shadow-md z-40">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );
}
