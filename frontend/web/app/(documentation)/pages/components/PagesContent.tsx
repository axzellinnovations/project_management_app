'use client';

import React from 'react';
import { File, Plus, Edit2, Trash2, Star } from 'lucide-react';
import { PageItem } from './usePages';

interface PagesContentProps {
  selectedPage?: PageItem | null;
  loading?: boolean;
  onCreateClick: () => void;
  onEditClick: () => void;
  onDeleteClick: () => void;
  onStarClick?: () => void;
}

export default function PagesContent({
  selectedPage,
  loading = false,
  onCreateClick,
  onEditClick,
  onDeleteClick,
  onStarClick,
}: PagesContentProps) {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="text-center">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full" />
          </div>
          <p className="mt-4 text-gray-600">Loading page...</p>
        </div>
      </div>
    );
  }

  if (!selectedPage) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-lg border border-gray-200 shadow-sm p-12 min-h-[500px]">
        <div className="flex flex-col items-center text-center max-w-sm">
          {/* Large faded icon */}
          <div className="mb-6 p-4 bg-gray-50 rounded-2xl">
            <File className="w-16 h-16 text-gray-300" strokeWidth={1.5} />
          </div>

          <h3 className="text-xl font-bold text-gray-800 mb-2">
            No page selected
          </h3>

          <p className="text-gray-500 text-sm mb-8">
            Select a page from the sidebar or create a new one
          </p>

          <button
            onClick={onCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
          >
            <Plus size={18} />
            Create New Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-gray-200">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {selectedPage.title}
          </h1>
          {selectedPage.updatedAt && (
            <p className="text-sm text-gray-500">
              Last updated: {new Date(selectedPage.updatedAt).toLocaleDateString()} at{' '}
              {new Date(selectedPage.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onStarClick}
            className={`p-2 rounded-md transition-colors ${
              selectedPage.isStarred
                ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={selectedPage.isStarred ? 'Unstar' : 'Star'}
          >
            <Star size={20} fill={selectedPage.isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onEditClick}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
            title="Edit page"
          >
            <Edit2 size={20} />
          </button>
          <button
            onClick={onDeleteClick}
            className="p-2 rounded-md text-red-600 hover:bg-red-50 transition-colors"
            title="Delete page"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedPage.content ? (
          <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
            {selectedPage.content}
          </div>
        ) : (
          <p className="text-gray-500 italic">No content yet. Click Edit to add content.</p>
        )}
      </div>
    </div>
  );
}
