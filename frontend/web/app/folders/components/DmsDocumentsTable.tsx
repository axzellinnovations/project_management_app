'use client';

import { DocumentItem } from '@/lib/dms';
import { Download, Eye, FileClock, FileText, Info, Pencil, RotateCcw, Star, Trash2 } from 'lucide-react';
import { timeAgo } from '@/app/folders/components/dmsUtils';
import { ViewMode } from '@/app/folders/components/types';

interface DmsDocumentsTableProps {
    filteredDocuments: DocumentItem[];
    favoriteIds: number[];
    isTrashMode: boolean;
    mode: ViewMode;
    projectNameMap: Record<number, string>;
    onToggleFavorite: (documentId: number) => void;
    onView: (documentId: number) => void;
    onDownload: (documentId: number) => void;
    onRename: (document: DocumentItem) => void;
    onSoftDelete: (documentId: number) => void;
    onToggleVersions: (documentId: number) => void;
    onOpenInfo: (document: DocumentItem) => void;
    onRestore: (documentId: number) => void;
    onPermanentDelete: (documentId: number) => void;
}

export default function DmsDocumentsTable({
    filteredDocuments,
    favoriteIds,
    isTrashMode,
    mode,
    projectNameMap,
    onToggleFavorite,
    onView,
    onDownload,
    onRename,
    onSoftDelete,
    onToggleVersions,
    onOpenInfo,
    onRestore,
    onPermanentDelete,
}: DmsDocumentsTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
                <thead>
                    <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#667085] border-b border-[#EAECF0] bg-[#FCFCFD]">
                        <th className="px-5 py-3 font-semibold">Name</th>
                        {mode === 'recent' && <th className="px-5 py-3 font-semibold">Last Modified</th>}
                        <th className="px-5 py-3 font-semibold">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredDocuments.length === 0 && (
                        <tr>
                            <td className="px-5 py-8 text-sm text-[#667085]" colSpan={mode === 'recent' ? 3 : 2}>
                                No documents found.
                            </td>
                        </tr>
                    )}

                    {filteredDocuments.map((doc) => {
                        const isFavorite = favoriteIds.includes(doc.id);
                        const projectName = projectNameMap[doc.projectId];

                        return (
                            <tr key={doc.id} className="border-b border-[#F2F4F7] hover:bg-[#FAFBFC] align-top">
                                <td className="px-5 py-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 text-[#667085]"><FileText size={16} /></div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-medium text-[#101828]">{doc.name}</p>
                                                <button
                                                    onClick={() => onToggleFavorite(doc.id)}
                                                    className="text-[#98A2B3] hover:text-[#F79009]"
                                                    title="Toggle favorite"
                                                >
                                                    <Star size={14} fill={isFavorite ? '#F79009' : 'none'} color={isFavorite ? '#F79009' : 'currentColor'} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-[#667085] mt-1">{doc.contentType} • v{doc.latestVersionNumber}</p>
                                            {/* FEATURE-3: project name in shared mode */}
                                            {mode === 'shared' && projectName && (
                                                <p className="text-xs text-[#98A2B3] mt-0.5">{projectName}</p>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                {/* FEATURE-2: last modified column in recent mode */}
                                {mode === 'recent' && (
                                    <td className="px-5 py-4 text-xs text-[#667085] whitespace-nowrap">
                                        {timeAgo(doc.updatedAt)}
                                    </td>
                                )}
                                <td className="px-5 py-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        {!isTrashMode && (
                                            <>
                                                <button onClick={() => onView(doc.id)} className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]" title="View">
                                                    <Eye size={14} />
                                                </button>
                                                <button onClick={() => onDownload(doc.id)} className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]" title="Download">
                                                    <Download size={14} />
                                                </button>
                                                <button onClick={() => onRename(doc)} className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]" title="Rename">
                                                    <Pencil size={14} />
                                                </button>
                                                <button onClick={() => onSoftDelete(doc.id)} className="h-8 w-8 inline-flex items-center justify-center border border-[#FECACA] text-[#B42318] rounded-md hover:bg-[#FEF3F2]" title="Soft delete">
                                                    <Trash2 size={14} />
                                                </button>
                                                <button onClick={() => onToggleVersions(doc.id)} className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]" title="Version history">
                                                    <FileClock size={14} />
                                                </button>
                                                <button onClick={() => onOpenInfo(doc)} className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]" title="Info">
                                                    <Info size={14} />
                                                </button>
                                            </>
                                        )}

                                        {isTrashMode && (
                                            <>
                                                <button onClick={() => onRestore(doc.id)} className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB] inline-flex items-center gap-1" title="Restore">
                                                    <RotateCcw size={12} />
                                                    Restore
                                                </button>
                                                <button onClick={() => onPermanentDelete(doc.id)} className="px-2.5 py-1.5 text-xs border border-[#FDA29B] text-[#912018] rounded-md hover:bg-[#FEF3F2] inline-flex items-center gap-1" title="Permanent delete">
                                                    <Trash2 size={12} />
                                                    Permanent delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
