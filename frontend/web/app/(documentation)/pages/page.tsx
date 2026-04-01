'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import DocumentSidebar from './components/DocumentSidebar';
import TemplateSelector from './components/TemplateSelector';
import { usePages } from './components/usePages';
import { Template } from './components/types';

export default function PagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projectId, setProjectId] = useState<string | number | null>(null);

  // We are currently viewing the root page list
  // The selected page logic is usually handled by [pageId]/page.tsx
  // But here in the root, we default to TemplateSelector
  
  useEffect(() => {
    const queryProjectId = searchParams.get('projectId');
    if (queryProjectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    searchQuery,
    setSearchQuery,
  } = usePages(projectId);

  const [showDocSidebar, setShowDocSidebar] = useState(false);

  const handleTemplateSelect = async (template: Template) => {
    try {
      router.push(projectId ? `/pages/new?projectId=${projectId}&template=${template.id}` : `/pages/new?template=${template.id}`);
    } catch (err) {
      console.error('Error selecting template:', err);
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
      <div className="flex flex-col lg:flex-row h-full w-full bg-white overflow-hidden rounded-lg border border-gray-200 shadow-sm mt-4 mb-4 ml-4 mr-4 mx-4">
        {/* Mobile sidebar toggle button */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 lg:hidden">
          <button
            onClick={() => setShowDocSidebar(s => !s)}
            className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <PanelLeft size={16} />
            {showDocSidebar ? 'Hide pages' : 'Show pages'}
          </button>
        </div>

        {/* Left Sidebar */}
        <div className={showDocSidebar ? 'flex' : 'hidden lg:flex'}>
          <DocumentSidebar
            pages={filteredPages}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            projectId={projectId}
            selectedPageId={null} // Root path has no selected page
            onCreateClick={() => {
              // Already showing template selector here in root, but just in case
            }}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto pb-28 lg:pb-0">
          <TemplateSelector 
            onSelect={handleTemplateSelect} 
          />
        </div>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 right-4 p-4 bg-red-50 border border-red-200 rounded-md shadow-md z-40">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </>
  );
}
