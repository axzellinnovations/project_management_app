'use client';
// force-dynamic prevents Next.js from statically rendering this page at build time,
// because the content depends entirely on URL params that vary per request
export const dynamic = 'force-dynamic';

import React, { useState } from 'react';
import DocumentSidebar from '../components/DocumentSidebar';
import Editor from '../components/Editor';
import {
  Download, Upload, Trash2, CheckCircle2, Loader2,
  Save, FileEdit, History, X, PanelLeft, MoreHorizontal,
} from 'lucide-react';
import { usePageEditor } from './usePageEditor';
import { useRouter } from 'next/navigation';

export default function PageDetailPage() {
  const router = useRouter();
  const {
    pageId, isDraft, projectId, selectedPage, loadingPage, saveStatus,
    title, setTitle, showHistory, setShowHistory, historyMock,
    showDocSidebar, setShowDocSidebar, fileInputRef,
    filteredPages, error, searchQuery, setSearchQuery,
    handleUpdateContent, handleManualCreate, handleDeletePage,
    handleFileImport, handleExport,
    ydoc, collaborationUser,
  } = usePageEditor();

  // showMobileActions is local state because it's a purely visual toggle with no effect on data
  const [showMobileActions, setShowMobileActions] = useState(false);

  if (!projectId) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="text-center text-gray-500">Loading project information...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-white overflow-hidden">
      {/* Mobile sidebar toggle */}
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
          selectedPageId={isDraft ? null : pageId}
          projectId={projectId}
          onCreateClick={() => router.push(projectId ? `/pages?projectId=${projectId}` : '/pages')}
        />
      </div>

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
              {/* Action buttons – desktop */}
              <div className="hidden md:flex items-center gap-1.5 ml-3 flex-shrink-0">
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

              {/* Action button – mobile (three-dot) */}
              <div className="flex md:hidden ml-2 relative">
                <input
                  type="file" ref={fileInputRef} className="hidden"
                  accept=".md,.html" onChange={handleFileImport}
                />
                <button
                  onClick={() => setShowMobileActions((v) => !v)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                  aria-label="More actions"
                >
                  <MoreHorizontal size={18} />
                </button>
                {showMobileActions && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMobileActions(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                      <button
                        onClick={() => { fileInputRef.current?.click(); setShowMobileActions(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Upload size={16} className="text-gray-400" /> Import
                      </button>
                      <button
                        onClick={() => { handleExport(); setShowMobileActions(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Download size={16} className="text-gray-400" /> Export .md
                      </button>
                      {!isDraft && (
                        <button
                          onClick={() => { setShowHistory(!showHistory); setShowMobileActions(false); }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <History size={16} className="text-gray-400" /> Version History
                        </button>
                      )}
                      <div className="h-px bg-gray-100 my-1" />
                      <button
                        onClick={() => { handleDeletePage(); setShowMobileActions(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} /> {isDraft ? 'Discard Draft' : 'Delete Document'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ─── Editor + History Panel ─── */}
            <div className="flex-1 flex overflow-hidden relative">
              <div className={`flex-1 overflow-hidden transition-all duration-300 ${showHistory ? 'mr-[300px]' : ''}`}>
                <Editor
                  content={selectedPage.content || ''}
                  onUpdate={handleUpdateContent}
                  ydoc={ydoc ?? undefined}
                  collaborationUser={collaborationUser}
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
