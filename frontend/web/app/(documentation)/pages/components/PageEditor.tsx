'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader } from 'lucide-react';
import { PageItem } from './usePages';

interface PageEditorProps {
  isOpen: boolean;
  page?: PageItem | null;
  onClose: () => void;
  onSave: (title: string, content: string) => Promise<void>;
  isLoading?: boolean;
}

export default function PageEditor({
  isOpen,
  page,
  onClose,
  onSave,
  isLoading = false,
}: PageEditorProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (page) {
      setTitle(page.title || '');
      setContent(page.content || '');
    } else {
      setTitle('');
      setContent('');
    }
    setError('');
  }, [page, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (title.length > 200) {
      setError('Title must be at most 200 characters');
      return;
    }

    if (content.length > 50000) {
      setError('Content must be at most 50000 characters');
      return;
    }

    try {
      await onSave(title.trim(), content.trim());
      onClose();
      setTitle('');
      setContent('');
    } catch (err: any) {
      setError(err.message || 'Failed to save page');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
      {/* Modal Background Click */}
      <div className="w-full h-full" onClick={onClose} />

      {/* Modal */}
      <div className="bg-white w-full max-h-[90vh] overflow-y-auto rounded-t-lg shadow-lg fixed bottom-0 left-0 right-0">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-900">
            {page ? 'Edit Page' : 'Create New Page'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-600"
            disabled={isLoading}
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error Message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Title Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Page title..."
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={200}
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {title.length}/200 characters
            </p>
          </div>

          {/* Content Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Page content..."
              className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={12}
              maxLength={50000}
              disabled={isLoading}
            />
            <p className="mt-1 text-xs text-gray-500">
              {content.length}/50000 characters
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 justify-end pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Page'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
