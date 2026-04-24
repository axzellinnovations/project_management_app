'use client';

import React, { useState } from 'react';
import { Search, Plus, FileText, ChevronRight, ChevronDown, Folder } from 'lucide-react';
import Link from 'next/link';
import { PageItem } from './types';

interface DocumentSidebarProps {
  pages: PageItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPageId?: string | number | null;
  projectId?: string | number | null;
  onCreateClick: () => void;
}

export default function DocumentSidebar({
  pages,
  searchQuery,
  onSearchChange,
  selectedPageId,
  projectId,
  onCreateClick,
}: DocumentSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (e: React.MouseEvent, folderId: string) => {
    // preventDefault stops the wrapping <Link> from navigating when the user just wants to collapse the folder
    e.preventDefault();
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Build the hierarchical tree (this assumes parentId exists)
  // Since currently all pages likely have no parentId, they will be flat until API supports it.
  const rootPages = pages.filter(p => !p.parentId);

  const renderTree = (items: PageItem[], depth = 0) => {
    return items.map(item => {
      const children = pages.filter(p => p.parentId === item.id);
      const isExpanded = !!expandedFolders[item.id];
      const isSelected = selectedPageId === item.id;
      const hasChildren = children.length > 0;

      return (
        <div key={item.id} className="w-full flex flex-col">
          <Link
            href={projectId ? `/pages/${item.id}?projectId=${projectId}` : `/pages/${item.id}`}
            className={`group flex items-center justify-between py-2.5 px-2 min-h-[44px] lg:min-h-0 lg:py-1.5 rounded-md text-sm transition-colors ${
              isSelected 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            {/* 16px per depth level gives a clear visual hierarchy; 8px base keeps the first level aligned with the sidebar padding */}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {hasChildren ? (
                <button
                  onClick={(e) => toggleFolder(e, String(item.id))}
                  className="mr-1 p-0.5 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <div className="w-4 mr-1 flex-shrink-0" /> // Spacer for alignment
              )}
              
              {hasChildren ? (
                <Folder size={16} className={`flex-shrink-0 mr-2 ${isSelected ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
              ) : (
                <FileText size={16} className={`flex-shrink-0 mr-2 ${isSelected ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
              )}
              
              <span className="truncate">{item.title}</span>
            </div>
          </Link>

          {/* Render children if expanded */}
          {hasChildren && isExpanded && (
            <div className="flex flex-col">
              {renderTree(children, depth + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col w-full lg:w-[280px] h-full bg-[#f8fafc] border-r border-gray-200 flex-shrink-0 font-sans">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Project Pages</h2>
          <button
            onClick={onCreateClick}
            className="p-2 min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 lg:p-1.5 bg-white border border-gray-200 rounded-md shadow-sm text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
            title="Create new page"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
            <Search size={14} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 transition-shadow"
          />
        </div>
      </div>

      {/* Page List Tree */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {pages.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-6 px-4 bg-white rounded border border-dashed border-gray-200 mt-2 mx-2">
            <p>No documents found.</p>
            <button 
              onClick={onCreateClick}
              className="mt-2 text-blue-600 hover:underline font-medium"
            >
              Create the first page
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[2px]">
            {searchQuery 
              // Flat render during search so matching children inside collapsed parents are still visible
              ? renderTree(pages)
              : renderTree(rootPages)
            }
          </div>
        )}
      </div>
    </div>
  );
}
