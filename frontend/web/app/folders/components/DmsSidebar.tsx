'use client';

import Link from 'next/link';
import { DocumentFolder } from '@/lib/dms';
import { Folder, Plus, Trash2 } from 'lucide-react';
import { ViewMode } from '@/app/folders/components/types';

interface DmsSidebarProps {
    mode: ViewMode;
    isTrashMode: boolean;
    projectId: number | null;
    folders: DocumentFolder[];
    selectedFolderId?: number;
    setSelectedFolderId: (id: number | undefined) => void;
    onDeleteFolder: (folder: DocumentFolder) => void;
    newFolderName: string;
    setNewFolderName: (value: string) => void;
    onCreateFolder: () => Promise<void>;
    busy: boolean;
    folderCount: number;
    filteredDocumentCount: number;
    withProjectId: (basePath: string) => string;
}

export default function DmsSidebar({
    mode,
    isTrashMode,
    projectId,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    onDeleteFolder,
    newFolderName,
    setNewFolderName,
    onCreateFolder,
    busy,
    folderCount,
    filteredDocumentCount,
    withProjectId,
}: DmsSidebarProps) {
    return (
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 border-r border-[#E6E8EC] bg-[#FAFBFC] p-4">
            <div className="mb-4">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085] mb-2">Folders</h2>
                <Link
                    href={withProjectId('/folders/view-all')}
                    className={`w-full block text-left px-3 py-2 rounded-md text-sm ${
                        mode === 'view-all' ? 'bg-[#EEF4FF] text-[#004EEB]' : 'text-[#475467] hover:bg-[#F2F4F7]'
                    }`}
                >
                    All documents
                </Link>
                <Link
                    href={withProjectId('/folders/trash')}
                    className={`w-full mt-1 block text-left px-3 py-2 rounded-md text-sm ${
                        isTrashMode ? 'bg-[#FEE4E2] text-[#B42318]' : 'text-[#475467] hover:bg-[#F2F4F7]'
                    }`}
                >
                    Trash
                </Link>
                <div className="mt-1 space-y-1">
                    {folders.map((folder) => (
                        <div key={folder.id} className="group flex items-center gap-1">
                            <button
                                onClick={() => setSelectedFolderId(folder.id)}
                                disabled={isTrashMode}
                                className={`flex-1 text-left px-3 py-2 rounded-md text-sm inline-flex items-center gap-2 ${
                                    selectedFolderId === folder.id ? 'bg-[#EEF4FF] text-[#004EEB]' : 'text-[#475467] hover:bg-[#F2F4F7]'
                                }`}
                            >
                                <Folder size={14} />
                                <span className="truncate">{folder.name}</span>
                            </button>
                            {!isTrashMode && (
                                <button
                                    onClick={() => onDeleteFolder(folder)}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent text-[#98A2B3] hover:text-[#B42318] hover:border-[#FECACA] hover:bg-[#FEF3F2]"
                                    title="Delete folder"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-lg border border-[#D0D5DD] bg-white p-3">
                <div className="flex items-center rounded-md border border-[#D0D5DD] bg-white overflow-hidden">
                    <input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="New folder"
                        className="flex-1 h-[36px] px-3 text-sm border-0 focus:outline-none"
                        disabled={isTrashMode}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                void onCreateFolder();
                            }
                        }}
                    />
                    <button
                        onClick={() => void onCreateFolder()}
                        disabled={busy || isTrashMode}
                        className="relative -left-[13px] h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB] disabled:opacity-60 disabled:cursor-not-allowed"
                        title="Add folder"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            <div className="mt-5 rounded-md border border-[#E6E8EC] bg-white p-3 text-xs text-[#667085]">
                <p>Project ID: {projectId}</p>
                <p className="mt-1">Folders: {folderCount}</p>
                <p className="mt-1">Documents: {filteredDocumentCount}</p>
            </div>
        </aside>
    );
}
