import api from '@/lib/axios';
import axios from 'axios';

export type DocumentStatus = 'ACTIVE' | 'SOFT_DELETED';

export interface DocumentFolder {
    id: number;
    name: string;
    projectId: number;
    parentFolderId: number | null;
    createdById: number;
    createdAt: string;
    updatedAt: string;
}

export interface DocumentItem {
    id: number;
    name: string;
    contentType: string;
    fileSize: number;
    status: DocumentStatus;
    projectId: number;
    folderId: number | null;
    latestVersionNumber: number;
    downloadUrl: string | null;
    uploadedById: number;
    uploadedByName: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
}

export interface DocumentVersionItem {
    id: number;
    versionNumber: number;
    contentType: string;
    fileSize: number;
    uploadedById: number;
    uploadedByName: string;
    uploadedAt: string;
    downloadUrl: string;
}

interface UploadInitRequest {
    fileName: string;
    contentType: string;
    fileSize: number;
    folderId?: number;
}

interface UploadInitResponse {
    uploadUrl: string;
    objectKey: string;
    expiresInSeconds: number;
}

interface UploadFinalizeRequest {
    fileName: string;
    contentType: string;
    fileSize: number;
    objectKey: string;
    folderId?: number;
}

const EXTENSION_MIME_MAP: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
};

function inferContentType(file: File): string {
    if (file.type && file.type.trim().length > 0) {
        return file.type;
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_MIME_MAP[extension] || 'application/octet-stream';
}

function extractErrorMessage(error: unknown, fallback: string): string {
    const messageFromResponse = (error as { response?: { data?: { message?: string } | string } })?.response?.data;
    if (typeof messageFromResponse === 'string' && messageFromResponse.trim()) {
        return messageFromResponse;
    }

    if (typeof messageFromResponse === 'object' && messageFromResponse !== null) {
        const message = (messageFromResponse as { message?: string }).message;
        if (message && message.trim()) {
            return message;
        }
    }

    const message = (error as { message?: string })?.message;
    if (message && message.trim()) {
        return message;
    }

    return fallback;
}

export async function listFolders(projectId: number): Promise<DocumentFolder[]> {
    const response = await api.get<DocumentFolder[]>(`/api/projects/${projectId}/folders`);
    return response.data;
}

export async function createFolder(projectId: number, name: string, parentFolderId?: number): Promise<DocumentFolder> {
    const response = await api.post<DocumentFolder>(`/api/projects/${projectId}/folders`, {
        name,
        parentFolderId,
    });
    return response.data;
}

export async function deleteFolder(projectId: number, folderId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/folders/${folderId}`);
}

export async function listDocuments(projectId: number, folderId?: number, includeDeleted = false): Promise<DocumentItem[]> {
    const params = new URLSearchParams();
    params.set('includeDeleted', String(includeDeleted));
    if (folderId) params.set('folderId', String(folderId));

    const response = await api.get<DocumentItem[]>(`/api/projects/${projectId}/documents?${params.toString()}`);
    return response.data;
}

export async function getDocumentVersions(projectId: number, documentId: number): Promise<DocumentVersionItem[]> {
    const response = await api.get<DocumentVersionItem[]>(`/api/projects/${projectId}/documents/${documentId}/versions`);
    return response.data;
}

export async function updateDocumentMetadata(projectId: number, documentId: number, payload: { name?: string; folderId?: number }): Promise<DocumentItem> {
    const response = await api.patch<DocumentItem>(`/api/projects/${projectId}/documents/${documentId}`, payload);
    return response.data;
}

export async function softDeleteDocument(projectId: number, documentId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/documents/${documentId}`);
}

export async function restoreDocument(projectId: number, documentId: number): Promise<DocumentItem> {
    const response = await api.patch<DocumentItem>(`/api/projects/${projectId}/documents/${documentId}/restore`);
    return response.data;
}

export async function permanentDeleteDocument(projectId: number, documentId: number): Promise<void> {
    await api.delete(`/api/projects/${projectId}/documents/${documentId}/permanent`);
}

export async function getDocumentDownloadUrl(projectId: number, documentId: number): Promise<string> {
    const response = await api.get<{ downloadUrl: string }>(`/api/projects/${projectId}/documents/${documentId}/download-url`);
    return response.data.downloadUrl;
}

export interface UserProject {
    id: number;
    name: string;
}

export async function listUserProjects(): Promise<UserProject[]> {
    const response = await api.get<UserProject[]>('/api/projects');
    return response.data;
}

async function initUpload(projectId: number, request: UploadInitRequest): Promise<UploadInitResponse> {
    try {
        const response = await api.post<UploadInitResponse>(`/api/projects/${projectId}/documents/upload/init`, request);
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Failed to initialize upload.'));
    }
}

async function finalizeUpload(projectId: number, request: UploadFinalizeRequest): Promise<DocumentItem> {
    try {
        const response = await api.post<DocumentItem>(`/api/projects/${projectId}/documents/upload/finalize`, request);
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Upload was sent to storage, but finalize failed.'));
    }
}

async function uploadViaBackend(projectId: number, file: File, folderId?: number): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append('file', file);
    if (typeof folderId === 'number') {
        formData.append('folderId', String(folderId));
    }

    try {
        const response = await api.post<DocumentItem>(`/api/projects/${projectId}/documents/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Backend upload fallback failed.'));
    }
}

export async function uploadDocument(
    projectId: number,
    file: File,
    folderId?: number,
    onProgress?: (percent: number) => void
): Promise<DocumentItem> {
    const contentType = inferContentType(file);

    const initResponse = await initUpload(projectId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        folderId,
    });

    try {
        await axios.put(initResponse.uploadUrl, file, {
            headers: { 'Content-Type': contentType },
            onUploadProgress: (progressEvent) => {
                if (onProgress && progressEvent.total) {
                    onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
                }
            },
        });
    } catch {
        return uploadViaBackend(projectId, file, folderId);
    }

    return finalizeUpload(projectId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        objectKey: initResponse.objectKey,
        folderId,
    });
}
