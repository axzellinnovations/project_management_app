'use client';

import { Loader2, Search, X } from 'lucide-react';
import DmsHeader from '@/app/folders/components/DmsHeader';
import DmsSidebar from '@/app/folders/components/DmsSidebar';
import DmsDocumentsTable from '@/app/folders/components/DmsDocumentsTable';
import DmsModals from '@/app/folders/components/DmsModals';
import { ViewMode } from '@/app/folders/components/types';
import { useDmsWorkspace } from '@/app/folders/hooks/useDmsWorkspace';

interface DmsWorkspaceProps {
    mode: ViewMode;
}

export default function DmsWorkspace({ mode }: DmsWorkspaceProps) {
    const {
        loading, error, projectId, isTrashMode, title, busy,
        folders, selectedFolderId, setSelectedFolderId,
        newFolderName, setNewFolderName, folderCount,
        filteredDocuments, favoriteIds, projectNameMap,
        searchQuery, setSearchQuery, isDragOver, setIsDragOver,
        sharedProjectsNote, selectedVersionsDocId, setSelectedVersionsDocId,
        selectedVersionsDoc, selectedInfoDoc, setSelectedInfoDoc,
        versions, isUploading, uploadProgress,
        withProjectId, getFolderName,
        onCreateFolder, onDeleteFolder, onUpload, onDrop,
        onToggleFavorite, onView, onDownload, onRename,
        onSoftDelete, onToggleVersions, onOpenInfo, onRestore, onPermanentDelete,
    } = useDmsWorkspace(mode);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full bg-[#F7F8FA]">
                <Loader2 className="h-6 w-6 animate-spin text-[#155DFC]" />
            </div>
        );
    }

    if (error && !projectId) {
        return <div className="p-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>;
    }

    return (
        <>
            <div
                className="w-full max-w-[1400px] mx-auto min-h-[calc(100vh-160px)] rounded-xl border border-[#E6E8EC] bg-[#FCFCFD] shadow-sm overflow-hidden relative"
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={onDrop}
            >
                {isDragOver && (
                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#EEF4FF]/80 border-2 border-dashed border-[#155DFC] rounded-xl pointer-events-none">
                        <p className="text-lg font-semibold text-[#155DFC]">Drop file to upload</p>
                    </div>
                )}

                <DmsHeader title={title} isTrashMode={isTrashMode} onUpload={onUpload} />

                <div className="grid grid-cols-12 min-h-[70vh]">
                    <DmsSidebar
                        mode={mode} isTrashMode={isTrashMode} projectId={projectId}
                        folders={folders} selectedFolderId={selectedFolderId}
                        setSelectedFolderId={setSelectedFolderId}
                        onDeleteFolder={onDeleteFolder} newFolderName={newFolderName}
                        setNewFolderName={setNewFolderName} onCreateFolder={onCreateFolder}
                        busy={busy} folderCount={folderCount}
                        filteredDocumentCount={filteredDocuments.length}
                        withProjectId={withProjectId}
                    />

                    <section className="col-span-12 lg:col-span-9 xl:col-span-10 bg-white">
                        <div className="px-5 py-3 border-b border-[#E6E8EC] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="relative w-full lg:max-w-[420px]">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                                <input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search by name, owner, or type"
                                    className={`w-full pl-9 ${searchQuery ? 'pr-8' : 'pr-3'} py-2 text-sm border border-[#D0D5DD] rounded-md focus:outline-none focus:ring-2 focus:ring-[#B2CCFF]`}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#344054]"
                                        title="Clear search"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                            <div className="inline-flex rounded-md border border-[#D0D5DD] overflow-hidden text-xs">
                                <span className="px-3 py-2 bg-[#F9FAFB] text-[#667085]">Mode</span>
                                <span className="px-3 py-2 text-[#101828] font-semibold">{title}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="mx-5 mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">{error}</div>
                        )}
                        {mode === 'shared' && sharedProjectsNote && (
                            <div className="mx-5 mt-3 p-2 text-xs text-[#667085] bg-[#F9FAFB] border border-[#E6E8EC] rounded-md">{sharedProjectsNote}</div>
                        )}

                        <DmsDocumentsTable
                            filteredDocuments={filteredDocuments} favoriteIds={favoriteIds}
                            isTrashMode={isTrashMode} mode={mode} projectNameMap={projectNameMap}
                            onToggleFavorite={onToggleFavorite} onView={onView} onDownload={onDownload}
                            onRename={onRename} onSoftDelete={onSoftDelete}
                            onToggleVersions={onToggleVersions} onOpenInfo={onOpenInfo}
                            onRestore={onRestore} onPermanentDelete={onPermanentDelete}
                        />
                    </section>
                </div>
            </div>

            <DmsModals
                selectedVersionsDocId={selectedVersionsDocId} selectedVersionsDoc={selectedVersionsDoc}
                versions={versions} setSelectedVersionsDocId={setSelectedVersionsDocId}
                selectedInfoDoc={selectedInfoDoc} setSelectedInfoDoc={setSelectedInfoDoc}
                getFolderName={getFolderName} isUploading={isUploading} uploadProgress={uploadProgress}
            />
        </>
    );
}
