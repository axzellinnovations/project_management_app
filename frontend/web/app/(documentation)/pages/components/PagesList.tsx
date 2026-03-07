'use client';

import React from 'react';
import { Search, Star, Clock, Plus, FileText } from 'lucide-react';
import Link from 'next/link';
import { PageItem } from './usePages';

interface PagesListProps {
  pages: PageItem[];
  activeTab: 'all' | 'starred' | 'recent';
  onTabChange: (tab: 'all' | 'starred' | 'recent') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedPageId?: string | number | null;
  projectId?: string | number | null;
  onCreateClick: () => void;
}

export default function PagesList({
  pages,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  selectedPageId,
  projectId,
  onCreateClick,
}: PagesListProps) {
  return (
    <div className="flex flex-col w-[320px] h-fit bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Pages</h2>
        <button
          onClick={onCreateClick}
          className="p-1 hover:bg-gray-100 rounded-md text-gray-600 transition-colors"
          title="Create new page"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <Search size={16} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search pages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => onTabChange('all')}
          className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'all'
              ? 'bg-[#e5efff] text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onTabChange('starred')}
          className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${
            activeTab === 'starred'
              ? 'bg-[#e5efff] text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Starred pages"
        >
          <Star size={18} />
        </button>
        <button
          onClick={() => onTabChange('recent')}
          className={`flex-1 flex justify-center py-1.5 rounded-md transition-colors ${
            activeTab === 'recent'
              ? 'bg-[#e5efff] text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Recent pages"
        >
          <Clock size={18} />
        </button>
      </div>

      {/* Page List */}
      <div className="flex flex-col gap-1 max-h-[500px] overflow-y-auto">
        {pages.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No pages found</p>
        ) : (
          pages.map((page) => (
            <Link
              key={page.id}
              href={projectId ? `/pages/${page.id}?projectId=${projectId}` : `/pages/${page.id}`}
              className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-md text-sm transition-colors ${
                selectedPageId === page.id
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <FileText size={18} className="text-gray-400 flex-shrink-0" />
              <span className="truncate">{page.title}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
