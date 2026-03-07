'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PagesList from './components/PagesList';
import PagesContent from './components/PagesContent';
import PageEditor from './components/PageEditor';
import { usePages } from './components/usePages';

export default function PagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState<string | number | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    loading,
    error,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    createPage,
  } = usePages(projectId);

  const handleCreatePage = async (title: string, content: string) => {
    setIsSaving(true);
    try {
      const newPage = await createPage(title, content);
      router.push(projectId ? `/pages/${newPage.id}?projectId=${projectId}` : `/pages/${newPage.id}`);
      setIsEditorOpen(false);
    } catch (err) {
      console.error('Error creating page:', err);
    } finally {
      setIsSaving(false);
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
          projectId={projectId}
          onCreateClick={() => setIsEditorOpen(true)}
        />

        {/* Main Content Area */}
        <PagesContent
          selectedPage={null}
          loading={loading}
          onCreateClick={() => setIsEditorOpen(true)}
          onEditClick={() => {}}
          onDeleteClick={() => {}}
          onStarClick={() => {}}
        />
      </div>

      {/* Page Editor Modal */}
      <PageEditor
        isOpen={isEditorOpen}
        page={null}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleCreatePage}
        isLoading={isSaving}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-md shadow-md z-40">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );
}
