import api from '@/lib/axios';

// ── Types ──

export interface TaskAttachment {
    id: number;
    fileName: string;
    contentType: string;
    fileSize: number;
    downloadUrl: string;
    uploadedByName: string;
    createdAt: string;
}

interface UploadInitRequest {
    fileName: string;
    contentType: string;
    fileSize: number;
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
}

// ── Helpers ──

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
    if (file.type && file.type.trim().length > 0) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_MIME_MAP[ext] || 'application/octet-stream';
}

function extractErrorMessage(error: unknown, fallback: string): string {
    const resp = (error as { response?: { data?: { message?: string } | string } })?.response?.data;
    if (typeof resp === 'string' && resp.trim()) return resp;
    if (typeof resp === 'object' && resp !== null) {
        const msg = (resp as { message?: string }).message;
        if (msg && msg.trim()) return msg;
    }
    const msg = (error as { message?: string })?.message;
    if (msg && msg.trim()) return msg;
    return fallback;
}

// ── API functions ──

async function initUpload(taskId: number, request: UploadInitRequest): Promise<UploadInitResponse> {
    try {
        const response = await api.post<UploadInitResponse>(`/api/tasks/${taskId}/attachments/upload/init`, request);
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Failed to initialize upload.'));
    }
}

async function finalizeUpload(taskId: number, request: UploadFinalizeRequest): Promise<TaskAttachment> {
    try {
        const response = await api.post<TaskAttachment>(`/api/tasks/${taskId}/attachments/upload/finalize`, request);
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Upload was sent to storage, but finalize failed.'));
    }
}

async function uploadViaBackend(taskId: number, file: File): Promise<TaskAttachment> {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await api.post<TaskAttachment>(`/api/tasks/${taskId}/attachments/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    } catch (error) {
        throw new Error(extractErrorMessage(error, 'Backend upload fallback failed.'));
    }
}

/** Upload a file to a task using presigned URL with backend fallback. */
export async function uploadTaskAttachment(taskId: number, file: File): Promise<TaskAttachment> {
    const contentType = inferContentType(file);

    const initResponse = await initUpload(taskId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
    });

    let putResponse: Response;
    try {
        putResponse = await fetch(initResponse.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': contentType },
        });
    } catch {
        return uploadViaBackend(taskId, file);
    }

    if (!putResponse.ok) {
        return uploadViaBackend(taskId, file);
    }

    return finalizeUpload(taskId, {
        fileName: file.name,
        contentType,
        fileSize: file.size,
        objectKey: initResponse.objectKey,
    });
}

/** List all attachments for a task. */
export async function listTaskAttachments(taskId: number): Promise<TaskAttachment[]> {
    const response = await api.get<TaskAttachment[]>(`/api/tasks/${taskId}/attachments`);
    return response.data;
}

/** Delete a task attachment. */
export async function deleteTaskAttachment(taskId: number, attachmentId: number): Promise<void> {
    await api.delete(`/api/tasks/${taskId}/attachments/${attachmentId}`);
}
