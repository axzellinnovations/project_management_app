import api from '@/lib/axios';

export async function uploadChatDocument(projectId: string | number, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post(`/api/projects/${projectId}/chat/messages/upload-document`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}
