import { useState, useEffect, useCallback } from 'react';
import {
    TaskAttachment,
    listTaskAttachments,
    uploadTaskAttachment,
    deleteTaskAttachment,
} from '@/services/task-attachments-service';

interface UseTaskAttachmentsReturn {
    attachments: TaskAttachment[];
    isLoading: boolean;
    isUploading: boolean;
    error: string | null;
    uploadFile: (file: File) => Promise<void>;
    removeFile: (attachmentId: number) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useTaskAttachments(taskId: number | undefined): UseTaskAttachmentsReturn {
    const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!taskId) return;
        try {
            setIsLoading(true);
            setError(null);
            const data = await listTaskAttachments(taskId);
            setAttachments(data);
        } catch (err) {
            setError((err as Error).message || 'Failed to load attachments');
        } finally {
            setIsLoading(false);
        }
    }, [taskId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const uploadFile = useCallback(async (file: File) => {
        if (!taskId) return;
        try {
            setIsUploading(true);
            setError(null);
            const newAttachment = await uploadTaskAttachment(taskId, file);
            setAttachments(prev => [newAttachment, ...prev]);
        } catch (err) {
            setError((err as Error).message || 'Upload failed');
        } finally {
            setIsUploading(false);
        }
    }, [taskId]);

    const removeFile = useCallback(async (attachmentId: number) => {
        if (!taskId) return;
        try {
            setError(null);
            await deleteTaskAttachment(taskId, attachmentId);
            setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        } catch (err) {
            setError((err as Error).message || 'Delete failed');
        }
    }, [taskId]);

    return { attachments, isLoading, isUploading, error, uploadFile, removeFile, refresh };
}
