import api from '@/lib/axios';

export type ReportDownloadFormat = 'pdf' | 'excel';

const CONTENT_TYPE_BY_FORMAT: Record<ReportDownloadFormat, string> = {
  pdf: 'application/pdf',
  excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

function resolveFormatParam(format: ReportDownloadFormat): 'PDF' | 'EXCEL' {
  return format === 'pdf' ? 'PDF' : 'EXCEL';
}

function fallbackFileName(format: ReportDownloadFormat): string {
  return format === 'pdf' ? 'project_report.pdf' : 'project_report.xlsx';
}

function extractFileName(contentDisposition?: string): string | null {
  if (!contentDisposition) return null;

  const utf8FileName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8FileName) {
    try {
      return decodeURIComponent(utf8FileName);
    } catch {
      return utf8FileName;
    }
  }

  const basicFileName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
  return basicFileName || null;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function downloadProjectReport(projectId: number, format: ReportDownloadFormat): Promise<void> {
  const response = await api.get<ArrayBuffer>(`/api/projects/${projectId}/reports/download`, {
    params: { format: resolveFormatParam(format) },
    responseType: 'arraybuffer',
  });

  const contentType = response.headers['content-type'] || CONTENT_TYPE_BY_FORMAT[format];
  const fileName = extractFileName(response.headers['content-disposition']) || fallbackFileName(format);

  const blob = new Blob([response.data], { type: contentType });
  triggerBrowserDownload(blob, fileName);
}
