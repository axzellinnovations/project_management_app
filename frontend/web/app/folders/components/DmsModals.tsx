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
}

export default function DmsModals({
    selectedVersionsDocId,
    selectedVersionsDoc,
    versions,
    setSelectedVersionsDocId,
    selectedInfoDoc,
    setSelectedInfoDoc,
    getFolderName,
}: DmsModalsProps) {
    if (selectedVersionsDocId === null && selectedInfoDoc === null) {
        return null;
    }

    return (
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
    );
}
