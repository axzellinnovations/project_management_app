'use client';
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PanelLeft } from 'lucide-react';
import DocumentSidebar from './components/DocumentSidebar';
import TemplateSelector from './components/TemplateSelector';
import { usePages } from './components/usePages';
import { Template } from './components/types';

export default function PagesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Directly derive projectId from URL for immediate, lag-free UI
  const projectId = searchParams.get('projectId') || (typeof window !== 'undefined' ? localStorage.getItem('currentProjectId') : null);

  const {
    filteredPages,
    error,
    searchQuery,
    setSearchQuery,
  } = usePages(projectId);

  const [showDocSidebar, setShowDocSidebar] = useState(false);

  const handleTemplateSelect = (template: Template) => {
    try {
      router.push(projectId ? `/pages/new?projectId=${projectId}&template=${template.id}` : `/pages/new?template=${template.id}`);
    } catch (err) {
      console.error('Error selecting template:', err);
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F7F8FA]">
        <div className="text-center">
          <p className="text-gray-500 font-outfit text-sm">Loading project information...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col lg:flex-row h-full w-full bg-white overflow-hidden">
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
