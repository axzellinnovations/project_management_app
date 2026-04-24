'use client';

import { DocumentItem, DocumentVersionItem } from '@/lib/dms';
import { Info, Users, X } from 'lucide-react';
import { formatBytes, toDateLabel } from '@/app/folders/components/dmsUtils';

interface DmsModalsProps {
    selectedVersionsDocId: number | null;
    selectedVersionsDoc: DocumentItem | null;
    versions: Record<number, DocumentVersionItem[]>;
    setSelectedVersionsDocId: (value: number | null) => void;
    selectedInfoDoc: DocumentItem | null;
    setSelectedInfoDoc: (value: DocumentItem | null) => void;
    getFolderName: (folderId: number | null) => string;
    isUploading?: boolean;
    uploadProgress?: number;
}

export default function DmsModals({
    selectedVersionsDocId,
    selectedVersionsDoc,
    versions,
    setSelectedVersionsDocId,
    selectedInfoDoc,
    setSelectedInfoDoc,
    getFolderName,
    isUploading = false,
    uploadProgress = 0,
}: DmsModalsProps) {
    // Early return avoids mounting any modal DOM when nothing is open,
    // keeping the backdrop and z-index stack clean for the rest of the page.
    if (selectedVersionsDocId === null && selectedInfoDoc === null && !isUploading) {
        return null;
    }

    return (
        <>
            {isUploading && (
                <div className="fixed bottom-8 right-8 z-50 w-72 rounded-xl border border-[#E6E8EC] bg-white p-4 shadow-2xl">
                    <p className="text-sm font-medium text-[#101828] mb-2">Uploading...</p>
                    <div className="w-full bg-[#F2F4F7] rounded-full h-2">
                        <div
                            style={{ width: `${uploadProgress}%` }}
                            className="h-2 rounded-full bg-[#1D56D5] transition-all duration-200"
                        />
                    </div>
                    <p className="text-xs text-[#667085] mt-1">{uploadProgress}%</p>
                </div>
            )}
            {(selectedVersionsDocId !== null || selectedInfoDoc !== null) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-sm p-4">
            {selectedVersionsDocId !== null && selectedVersionsDoc && (
                <div className="w-full max-w-2xl rounded-xl border border-[#E6E8EC] bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
                        <div className="inline-flex items-center gap-2 text-[#101828]">
                            <Users size={16} />
                            <h3 className="text-sm font-semibold">Version history</h3>
                        </div>
                        <button
                            onClick={() => setSelectedVersionsDocId(null)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#D0D5DD] hover:bg-[#F9FAFB]"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-4">
                        <p className="text-sm font-medium text-[#101828] mb-3 truncate">{selectedVersionsDoc.name}</p>
                        <div className="max-h-[360px] overflow-y-auto space-y-2">
                            {(versions[selectedVersionsDocId] || []).map((version) => (
                                <div key={version.id} className="text-xs text-[#475467] flex items-center justify-between rounded-md border border-[#EAECF0] bg-[#FCFCFD] px-3 py-2">
                                    <span>
                                        v{version.versionNumber} • {formatBytes(version.fileSize)} • {version.contentType}
                                    </span>
                                    <span>
                                        {version.uploadedByName} • {toDateLabel(version.uploadedAt)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedInfoDoc !== null && (
                <div className="w-full max-w-md rounded-xl border border-[#E6E8EC] bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-[#EAECF0] px-5 py-4">
                        <div className="inline-flex items-center gap-2 text-[#101828]">
                            <Info size={16} />
                            <h3 className="text-sm font-semibold">Document info</h3>
                        </div>
                        <button
                            onClick={() => setSelectedInfoDoc(null)}
                            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[#D0D5DD] hover:bg-[#F9FAFB]"
                            title="Close"
                        >
                            <X size={14} />
                        </button>
                    </div>
                    <div className="px-5 py-4 space-y-3 text-sm text-[#344054]">
                        <p><span className="font-medium text-[#101828]">Name:</span> {selectedInfoDoc.name}</p>
                        <p><span className="font-medium text-[#101828]">Owner:</span> {selectedInfoDoc.uploadedByName}</p>
                        <p><span className="font-medium text-[#101828]">Folder:</span> {getFolderName(selectedInfoDoc.folderId)}</p>
                        <p><span className="font-medium text-[#101828]">Updated:</span> {toDateLabel(selectedInfoDoc.updatedAt || selectedInfoDoc.createdAt)}</p>
                        <p><span className="font-medium text-[#101828]">Size:</span> {formatBytes(selectedInfoDoc.fileSize)}</p>
                    </div>
                </div>
            )}
        </div>
            )}
        </>
    );
}
