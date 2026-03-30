'use client';

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
import { Loader2, Search } from 'lucide-react';
import DmsHeader from '@/app/folders/components/DmsHeader';
import DmsSidebar from '@/app/folders/components/DmsSidebar';
import DmsDocumentsTable from '@/app/folders/components/DmsDocumentsTable';
import DmsModals from '@/app/folders/components/DmsModals';
import { ViewMode } from '@/app/folders/components/types';

interface DmsWorkspaceProps {
    mode: ViewMode;
}

const FAVORITES_KEY = 'dmsFavoriteDocumentIds';

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
                <DmsHeader title={title} isTrashMode={isTrashMode} onUpload={onUpload} />

                <div className="grid grid-cols-12 min-h-[70vh]">
                    <DmsSidebar
                        mode={mode}
                        isTrashMode={isTrashMode}
                        projectId={projectId}
                        folders={folders}
                        selectedFolderId={selectedFolderId}
                        setSelectedFolderId={setSelectedFolderId}
                        onDeleteFolder={onDeleteFolder}
                        newFolderName={newFolderName}
                        setNewFolderName={setNewFolderName}
                        onCreateFolder={onCreateFolder}
                        busy={busy}
                        folderCount={folderCount}
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

                        <DmsDocumentsTable
                            filteredDocuments={filteredDocuments}
                            favoriteIds={favoriteIds}
                            isTrashMode={isTrashMode}
                            onToggleFavorite={onToggleFavorite}
                            onView={onView}
                            onDownload={onDownload}
                            onRename={onRename}
                            onSoftDelete={onSoftDelete}
                            onToggleVersions={onToggleVersions}
                            onOpenInfo={onOpenInfo}
                            onRestore={onRestore}
                            onPermanentDelete={onPermanentDelete}
                        />
                    </section>
                </div>
            </div>
            <DmsModals
                selectedVersionsDocId={selectedVersionsDocId}
                selectedVersionsDoc={selectedVersionsDoc}
                versions={versions}
                setSelectedVersionsDocId={setSelectedVersionsDocId}
                selectedInfoDoc={selectedInfoDoc}
                setSelectedInfoDoc={setSelectedInfoDoc}
                getFolderName={getFolderName}
            />
        </>
    );
}
