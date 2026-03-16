'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getUserFromToken } from '@/lib/auth';
import {
    createFolder,
    deleteFolder,
    DocumentFolder,
    DocumentItem,
    DocumentVersionItem,
    getDocumentDownloadUrl,
    getDocumentVersions,
    listDocuments,
    listFolders,
    permanentDeleteDocument,
    restoreDocument,
    softDeleteDocument,
    updateDocumentMetadata,
    uploadDocument,
} from '@/lib/dms';
import {
    Download,
    Eye,
    FileClock,
    FileText,
    Folder,
    Info,
    Loader2,
    Pencil,
    Plus,
    RotateCcw,
    Search,
    Star,
    Trash2,
    Upload,
    Users,
    X,
} from 'lucide-react';

type ViewMode = 'view-all' | 'recent' | 'favorites' | 'shared' | 'trash';

interface DmsWorkspaceProps {
    mode: ViewMode;
}

const FAVORITES_KEY = 'dmsFavoriteDocumentIds';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function toDateLabel(iso: string): string {
    return new Date(iso).toLocaleString();
}

export default function DmsWorkspace({ mode }: DmsWorkspaceProps) {
    const [projectId, setProjectId] = useState<number | null>(null);
    const [folders, setFolders] = useState<DocumentFolder[]>([]);
    const [documents, setDocuments] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedFolderId, setSelectedFolderId] = useState<number | undefined>(undefined);
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedVersionsDocId, setSelectedVersionsDocId] = useState<number | null>(null);
    const [selectedInfoDoc, setSelectedInfoDoc] = useState<DocumentItem | null>(null);
    const [versions, setVersions] = useState<Record<number, DocumentVersionItem[]>>({});
    const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    const isTrashMode = mode === 'trash';

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const query = new URLSearchParams(window.location.search);
        const queryProjectId = query.get('projectId');
        const storedProjectId = localStorage.getItem('currentProjectId');
        const resolved = queryProjectId || storedProjectId;

        if (!resolved) {
            setError('No project selected. Open a project first from Dashboard and then return to Folders.');
            setLoading(false);
            return;
        }

        const parsed = Number(resolved);
        if (!Number.isFinite(parsed)) {
            setError('Invalid project ID.');
            setLoading(false);
            return;
        }

        setProjectId(parsed);
        localStorage.setItem('currentProjectId', String(parsed));
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const raw = localStorage.getItem(FAVORITES_KEY);
        if (!raw) {
            setFavoriteIds([]);
            return;
        }

        try {
            const parsed = JSON.parse(raw) as number[];
            setFavoriteIds(Array.isArray(parsed) ? parsed : []);
        } catch {
            setFavoriteIds([]);
        }
    }, []);

    useEffect(() => {
        if (!projectId) return;

        const load = async () => {
            try {
                setLoading(true);
                setError(null);
                const [folderData, documentData] = await Promise.all([
                    listFolders(projectId),
                    listDocuments(projectId, undefined, isTrashMode),
                ]);
                setFolders(folderData);
                setDocuments(documentData);
            } catch {
                setError('Failed to load folder and document data.');
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [projectId, isTrashMode]);

    const filteredDocuments = useMemo(() => {
        const currentUser = getUserFromToken();
        const now = Date.now();
        const recentThresholdMs = 14 * 24 * 60 * 60 * 1000;

        return documents.filter((doc) => {
            if (isTrashMode && doc.status !== 'SOFT_DELETED') {
                return false;
            }

            if (!isTrashMode && doc.status !== 'ACTIVE') {
                return false;
            }

            if (selectedFolderId && doc.folderId !== selectedFolderId) {
                return false;
            }

            if (mode === 'recent' && now - new Date(doc.createdAt).getTime() > recentThresholdMs) {
                return false;
            }

            if (mode === 'favorites' && !favoriteIds.includes(doc.id)) {
                return false;
            }

            if (mode === 'shared' && (!currentUser?.username || doc.uploadedByName === currentUser.username)) {
                return false;
            }

            if (searchQuery.trim().length > 0) {
                const needle = searchQuery.toLowerCase();
                const inName = doc.name.toLowerCase().includes(needle);
                const inOwner = doc.uploadedByName.toLowerCase().includes(needle);
                const inType = doc.contentType.toLowerCase().includes(needle);
                if (!inName && !inOwner && !inType) {
                    return false;
                }
            }

            return true;
        });
    }, [documents, favoriteIds, isTrashMode, mode, selectedFolderId, searchQuery]);

    const title = useMemo(() => {
        if (mode === 'recent') return 'Recent';
        if (mode === 'favorites') return 'Favorites';
        if (mode === 'shared') return 'Shared';
        if (mode === 'trash') return 'Trash';
        return 'All Documents';
    }, [mode]);

    const refresh = async () => {
        if (!projectId) return;
        const data = await listDocuments(projectId, undefined, isTrashMode);
        setDocuments(data);
    };

    const withProjectId = (basePath: string) => {
        if (!projectId) return basePath;
        return `${basePath}?projectId=${projectId}`;
    };

    const onCreateFolder = async () => {
        if (!projectId) return;
        if (!newFolderName.trim()) return;

        try {
            setBusy(true);
            const created = await createFolder(projectId, newFolderName.trim());
            setFolders((prev) => [...prev, created]);
            setNewFolderName('');
        } catch {
            setError('Failed to create folder.');
        } finally {
            setBusy(false);
        }
    };

    const onDeleteFolder = async (folder: DocumentFolder) => {
        if (!projectId || isTrashMode) return;

        const ok = window.confirm(`Delete folder "${folder.name}"? Folder must be empty.`);
        if (!ok) return;

        try {
            setBusy(true);
            await deleteFolder(projectId, folder.id);
            setFolders((prev) => prev.filter((f) => f.id !== folder.id));
            if (selectedFolderId === folder.id) {
                setSelectedFolderId(undefined);
            }
            await refresh();
        } catch {
            setError('Failed to delete folder. Ensure it has no documents or child folders.');
        } finally {
            setBusy(false);
        }
    };

    const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!projectId) return;
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setBusy(true);
            await uploadDocument(projectId, file, selectedFolderId);
            await refresh();
            event.target.value = '';
        } catch (err) {
            const message = (err as { message?: string })?.message;
            setError(message && message.trim().length > 0 ? message : 'Upload failed.');
        } finally {
            setBusy(false);
        }
    };

    const onDownload = async (documentId: number) => {
        if (!projectId) return;

        try {
            const url = await getDocumentDownloadUrl(projectId, documentId);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            setError('Failed to generate download URL.');
        }
    };

    const onView = async (documentId: number) => {
        if (!projectId) return;

        try {
            const url = await getDocumentDownloadUrl(projectId, documentId);
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            setError('Failed to open document in browser.');
        }
    };

    const onRename = async (document: DocumentItem) => {
        if (!projectId) return;
        const nextName = window.prompt('Rename document', document.name);
        if (!nextName || nextName.trim() === document.name) return;

        try {
            setBusy(true);
            await updateDocumentMetadata(projectId, document.id, { name: nextName.trim() });
            await refresh();
        } catch {
            setError('Failed to rename document.');
        } finally {
            setBusy(false);
        }
    };

    const onSoftDelete = async (documentId: number) => {
        if (!projectId) return;

        try {
            setBusy(true);
            await softDeleteDocument(projectId, documentId);
            await refresh();
        } catch {
            setError('Failed to delete document. You may need Owner/Admin permission.');
        } finally {
            setBusy(false);
        }
    };

    const onRestore = async (documentId: number) => {
        if (!projectId) return;

        try {
            setBusy(true);
            await restoreDocument(projectId, documentId);
            await refresh();
        } catch {
            setError('Failed to restore document.');
        } finally {
            setBusy(false);
        }
    };

    const onPermanentDelete = async (documentId: number) => {
        if (!projectId) return;
        const ok = window.confirm('Permanently delete this document and all versions?');
        if (!ok) return;

        try {
            setBusy(true);
            await permanentDeleteDocument(projectId, documentId);
            await refresh();
        } catch {
            setError('Failed to permanently delete document.');
        } finally {
            setBusy(false);
        }
    };

    const onToggleFavorite = (documentId: number) => {
        const next = favoriteIds.includes(documentId)
            ? favoriteIds.filter((id) => id !== documentId)
            : [...favoriteIds, documentId];

        setFavoriteIds(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
        }
    };

    const onToggleVersions = async (documentId: number) => {
        if (!projectId) return;

        if (selectedVersionsDocId === documentId) {
            setSelectedVersionsDocId(null);
            return;
        }

        setSelectedVersionsDocId(documentId);
        if (versions[documentId]) return;

        try {
            const data = await getDocumentVersions(projectId, documentId);
            setVersions((prev) => ({ ...prev, [documentId]: data }));
        } catch {
            setError('Failed to load version history.');
        }
    };

    const onOpenInfo = (document: DocumentItem) => {
        setSelectedInfoDoc(document);
    };

    const selectedVersionsDoc = selectedVersionsDocId
        ? filteredDocuments.find((doc) => doc.id === selectedVersionsDocId) || documents.find((doc) => doc.id === selectedVersionsDocId) || null
        : null;

    const getFolderName = (folderId: number | null): string => {
        if (!folderId) return 'Root';
        return folders.find((folder) => folder.id === folderId)?.name || 'Root';
    };

    const folderCount = folders.length;

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
        <div className="w-full max-w-[1400px] mx-auto min-h-[calc(100vh-160px)] rounded-xl border border-[#E6E8EC] bg-[#FCFCFD] shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E6E8EC] bg-white">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.08em] text-[#667085]">Knowledge</p>
                    <h1 className="text-[20px] font-semibold text-[#101828]">{title}</h1>
                </div>
                <div className="flex items-center gap-2">
                    {!isTrashMode && (
                        <label className="inline-flex items-center gap-2 bg-[#155DFC] hover:bg-[#004EEB] text-white px-4 py-2 rounded-md cursor-pointer text-sm font-medium">
                            <Upload size={16} />
                            Upload
                            <input type="file" className="hidden" onChange={onUpload} />
                        </label>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-12 min-h-[70vh]">
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
                                onClick={onCreateFolder}
                                disabled={busy || isTrashMode}
                                className="relative -left-[20px] h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB] disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Add folder"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 rounded-md border border-[#E6E8EC] bg-white p-3 text-xs text-[#667085]">
                        <p>Project ID: {projectId}</p>
                        <p className="mt-1">Folders: {folderCount}</p>
                        <p className="mt-1">Documents: {filteredDocuments.length}</p>
                    </div>
                </aside>

                <section className="col-span-12 lg:col-span-9 xl:col-span-10 bg-white">
                    <div className="px-5 py-3 border-b border-[#E6E8EC] flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="relative w-full lg:max-w-[420px]">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by name, owner, or type"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-[#D0D5DD] rounded-md focus:outline-none focus:ring-2 focus:ring-[#B2CCFF]"
                            />
                        </div>
                        <div className="inline-flex rounded-md border border-[#D0D5DD] overflow-hidden text-xs">
                            <span className="px-3 py-2 bg-[#F9FAFB] text-[#667085]">Mode</span>
                            <span className="px-3 py-2 text-[#101828] font-semibold">{title}</span>
                        </div>
                    </div>

                    {error && (
                        <div className="mx-5 mt-4 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
                            {error}
                        </div>
                    )}

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                            <thead>
                                <tr className="text-left text-xs uppercase tracking-[0.08em] text-[#667085] border-b border-[#EAECF0] bg-[#FCFCFD]">
                                    <th className="px-5 py-3 font-semibold">Name</th>
                                    <th className="px-5 py-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDocuments.length === 0 && (
                                    <tr>
                                        <td className="px-5 py-8 text-sm text-[#667085]" colSpan={2}>
                                            No documents found.
                                        </td>
                                    </tr>
                                )}

                                {filteredDocuments.map((doc) => {
                                    const isFavorite = favoriteIds.includes(doc.id);

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
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    {!isTrashMode && (
                                                        <>
                                                            <button
                                                                onClick={() => onView(doc.id)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]"
                                                                title="View"
                                                            >
                                                                <Eye size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onDownload(doc.id)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]"
                                                                title="Download"
                                                            >
                                                                <Download size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onRename(doc)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]"
                                                                title="Rename"
                                                            >
                                                                <Pencil size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onSoftDelete(doc.id)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#FECACA] text-[#B42318] rounded-md hover:bg-[#FEF3F2]"
                                                                title="Soft delete"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onToggleVersions(doc.id)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]"
                                                                title="Version history"
                                                            >
                                                                <FileClock size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => onOpenInfo(doc)}
                                                                className="h-8 w-8 inline-flex items-center justify-center border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB]"
                                                                title="Info"
                                                            >
                                                                <Info size={14} />
                                                            </button>
                                                        </>
                                                    )}

                                                    {isTrashMode && (
                                                        <>
                                                            <button
                                                                onClick={() => onRestore(doc.id)}
                                                                className="px-2.5 py-1.5 text-xs border border-[#D0D5DD] rounded-md hover:bg-[#F9FAFB] inline-flex items-center gap-1"
                                                                title="Restore"
                                                            >
                                                                <RotateCcw size={12} />
                                                                Restore
                                                            </button>
                                                            <button
                                                                onClick={() => onPermanentDelete(doc.id)}
                                                                className="px-2.5 py-1.5 text-xs border border-[#FDA29B] text-[#912018] rounded-md hover:bg-[#FEF3F2] inline-flex items-center gap-1"
                                                                title="Permanent delete"
                                                            >
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
                </section>
            </div>
        </div>
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
