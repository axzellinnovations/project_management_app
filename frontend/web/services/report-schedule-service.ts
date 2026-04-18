// ══════════════════════════════════════════════════════════════════════════════
//  report-schedule-service.ts  ·  API client for scheduled report management
// ══════════════════════════════════════════════════════════════════════════════

import api from '@/lib/axios';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReportFormat    = 'PDF' | 'EXCEL' | 'BOTH';
export type ScheduleType    = 'ONE_TIME' | 'RECURRING';
export type Frequency       = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
export type EndType         = 'AFTER_N' | 'UNTIL_DATE' | 'MANUAL';
export type ScheduleStatus  = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';

export interface ScheduledReportRequest {
  projectId:          number;
  format:             ReportFormat;
  scheduleType:       ScheduleType;

  // Recurring only
  frequency?:         Frequency;
  customIntervalDays?: number;

  // Time of day: "HH:mm"
  sendTime:           string;

  // Weekly: 0=Sun…6=Sat | Monthly: 1-31
  sendDayOfWeek?:     number;
  sendDayOfMonth?:    number;

  // One-time date: ISO date string "YYYY-MM-DD"
  scheduledDate?:     string;

  // Local Timezone
  timezone?:          string;

  // Recipients
  recipientsTo:       string[];   // required, at least one
  recipientsCc?:      string[];
  recipientsBcc?:     string[];

  // Email content
  subject?:           string;
  bodyMessage?:       string;

  // End condition (recurring)
  endType?:           EndType;
  endAfterCount?:     number;
  endDate?:           string;     // ISO date "YYYY-MM-DD"
}

export interface ScheduledReportResponse {
  id:             number;
  projectId:      number;
  format:         ReportFormat;
  scheduleType:   ScheduleType;
  frequency?:     Frequency;
  customIntervalDays?: number;
  sendTime:       string;
  sendDayOfWeek?: number;
  sendDayOfMonth?: number;
  scheduledDate?: string;
  timezone?:      string;
  recipientsTo:   string[];
  recipientsCc?:  string[];
  recipientsBcc?: string[];
  subject?:       string;
  bodyMessage?:   string;
  endType?:       EndType;
  endAfterCount?: number;
  endDate?:       string;
  sendCount:      number;
  status:         ScheduleStatus;
  nextSendAt?:    string;
  lastSentAt?:    string;
  createdAt:      string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const createScheduledReport = (payload: ScheduledReportRequest): Promise<ScheduledReportResponse> =>
  api.post<ScheduledReportResponse>('/api/scheduled-reports', payload).then(r => r.data);

export const getProjectScheduledReports = (projectId: number): Promise<ScheduledReportResponse[]> =>
  api.get<ScheduledReportResponse[]>(`/api/scheduled-reports/project/${projectId}`).then(r => r.data);

export const deleteScheduledReport = (id: number): Promise<void> =>
  api.delete(`/api/scheduled-reports/${id}`).then(() => undefined);

export const pauseScheduledReport = (id: number): Promise<ScheduledReportResponse> =>
  api.patch<ScheduledReportResponse>(`/api/scheduled-reports/${id}/pause`).then(r => r.data);

export const resumeScheduledReport = (id: number): Promise<ScheduledReportResponse> =>
  api.patch<ScheduledReportResponse>(`/api/scheduled-reports/${id}/resume`).then(r => r.data);
