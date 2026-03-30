'use client';

import Link from 'next/link';
import { DocumentFolder } from '@/lib/dms';
import { Clock, Folder, Plus, Share2, Star, Trash2 } from 'lucide-react';
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
    const navLinkClass = (active: boolean, danger = false) =>
        `w-full block text-left px-3 py-2 rounded-md text-sm transition-colors ${
            active
                ? danger
                    ? 'bg-[#FEE4E2] text-[#B42318]'
                    : 'bg-[#EEF4FF] text-[#004EEB]'
                : danger
                ? 'text-[#475467] hover:bg-[#FEF3F2] hover:text-[#B42318]'
                : 'text-[#475467] hover:bg-[#F2F4F7]'
        }`;

    return (
        <aside className="col-span-12 lg:col-span-3 xl:col-span-2 border-r border-[#E6E8EC] bg-[#FAFBFC] p-4 flex flex-col gap-4">
            {/* ---- View Nav ---- */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085] mb-2">Views</h2>
                <nav className="space-y-1">
                    <Link
                        href={withProjectId('/folders/view-all')}
                        className={navLinkClass(mode === 'view-all')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Folder size={14} />
                            All documents
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/recent')}
                        className={navLinkClass(mode === 'recent')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Clock size={14} />
                            Recent
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/favorites')}
                        className={navLinkClass(mode === 'favorites')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Star size={14} />
                            Favorites
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/shared')}
                        className={navLinkClass(mode === 'shared')}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Share2 size={14} />
                            Shared with me
                        </span>
                    </Link>
                    <Link
                        href={withProjectId('/folders/trash')}
                        className={navLinkClass(isTrashMode, true)}
                    >
                        <span className="inline-flex items-center gap-2">
                            <Trash2 size={14} />
                            Trash
                        </span>
                    </Link>
                </nav>
            </div>

            {/* ---- Folder list ---- */}
            <div>
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#667085] mb-2">Folders</h2>
                <div className="space-y-1">
                    {folders.length === 0 && (
                        <p className="text-xs text-[#98A2B3] px-3 py-2 italic">No folders yet</p>
                    )}
                    {folders.map((folder) => (
                        <div key={folder.id} className="group flex items-center gap-1">
                            <button
                                onClick={() => setSelectedFolderId(folder.id)}
                                disabled={isTrashMode}
                                className={`flex-1 text-left px-3 py-2 rounded-md text-sm inline-flex items-center gap-2 ${
                                    selectedFolderId === folder.id ? 'bg-[#EEF4FF] text-[#004EEB]' : 'text-[#475467] hover:bg-[#F2F4F7]'
                                } disabled:opacity-50`}
                            >
                                <Folder size={14} />
                                <span className="truncate">{folder.name}</span>
                            </button>
                            {!isTrashMode && (
                                <button
                                    onClick={() => onDeleteFolder(folder)}
                                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent text-[#98A2B3] hover:text-[#B42318] hover:border-[#FECACA] hover:bg-[#FEF3F2] opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Delete folder"
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ---- Create folder ---- */}
            {!isTrashMode && (
                <div className="rounded-lg border border-[#D0D5DD] bg-white p-3">
                    <div className="flex items-center rounded-md border border-[#D0D5DD] bg-white overflow-hidden">
                        <input
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            placeholder="New folder name…"
                            className="flex-1 h-[36px] px-3 text-sm border-0 focus:outline-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    void onCreateFolder();
                                }
                            }}
                        />
                        <button
                            onClick={() => void onCreateFolder()}
                            disabled={busy}
                            className="h-8 w-8 inline-flex items-center justify-center border-l border-[#D0D5DD] hover:bg-[#F9FAFB] disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Add folder"
                        >
                            <Plus size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* ---- Stats ---- */}
            <div className="mt-auto rounded-md border border-[#E6E8EC] bg-white p-3 text-xs text-[#667085]">
                <p className="font-medium text-[#344054] mb-1">Project #{projectId}</p>
                <p>Folders: <span className="font-semibold text-[#101828]">{folderCount}</span></p>
                <p className="mt-0.5">Documents: <span className="font-semibold text-[#101828]">{filteredDocumentCount}</span></p>
            </div>
        </aside>
    );
}
