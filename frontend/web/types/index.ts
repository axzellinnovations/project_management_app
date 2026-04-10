/* ═══════════════════════════════════════════════════
   Planora Types — Barrel Re-export
   Import from '@/types' to access all shared types.
   ═══════════════════════════════════════════════════ */

export * from './task';
export * from './project';
export * from './dms';
export * from './chat';
export * from './user';


export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  IN_REVIEW = 'IN_REVIEW',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export type ProjectType = 'AGILE' | 'KANBAN';

// ── User / Auth ────────────────────────────────────

export interface User {
  email: string;
  username?: string;
  fullName?: string;
  userId?: number;
  profilePicUrl?: string;
}

export interface JwtPayload {
  sub?: string;
  username?: string;
  exp?: number;
  [key: string]: unknown;
}

// ── Tasks ──────────────────────────────────────────

export interface Assignee {
  id: number;
  name: string;
  email?: string;
  avatar?: string;
}

export interface Label {
  id: number;
  name: string;
  color?: string;
}

export interface Subtask {
  id: number;
  title: string;
  status: string;
}

export interface Dependency {
  id: number;
  title: string;
  relation: string;
}

export interface TaskAttachmentSummary {
  id: number;
  fileName: string;
  contentType: string;
  fileSize: number;
  uploadedByName: string;
}

export interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  storyPoint?: number;
  dueDate?: string;
  startDate?: string;
  createdAt?: string;
  completedAt?: string;
  updatedAt?: string;
  assignee?: Assignee;
  assigneeId?: number;
  assigneeName?: string;
  reporter?: Assignee;
  reporterId?: number;
  reporterName?: string;
  projectId?: number;
  sprintId?: number;
  sprintName?: string;
  milestoneId?: number;
  milestoneName?: string;
  labels?: Label[];
  subtasks?: Subtask[];
  dependencies?: Dependency[];
  attachments?: TaskAttachmentSummary[];
  assigneePhotoUrl?: string;
  reporterPhotoUrl?: string;
}

export interface TaskActivity {
  id: number;
  activityType: string;
  actorName: string;
  description: string;
  createdAt: string;
}

export interface TaskData {
  id: number;
  title: string;
  description: string;
  projectName: string;
  projectId: number;
  status: string;
  priority: string;
  storyPoint: number;
  reporterName: string;
  reporterId?: number;
  assigneeName: string;
  assigneeId?: number;
  assigneePhotoUrl?: string;
  sprintName: string;
  sprintId?: number;
  milestoneId?: number;
  milestoneName?: string;
  startDate?: string;
  labels: Label[];
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  subtasks: Subtask[];
  dependencies: Dependency[];
  attachments?: TaskAttachmentSummary[];
}

// ── Kanban ─────────────────────────────────────────

export interface KanbanColumn {
  status: string;
  title: string;
  tasks: Task[];
}

export interface DragItem {
  type: 'task';
  taskId: number;
  columnStatus: string;
}

export interface DateFilter {
  startDate: Date | null;
  endDate: Date | null;
}

// ── Projects ───────────────────────────────────────

export interface Project {
  id: number;
  name: string;
  description?: string;
  projectKey?: string;
  isFavorite?: boolean;
  type?: ProjectType;
  teamId?: number;
}

export interface TeamMemberOption {
  id: number;
  name: string;
  email?: string;
}

export interface TeamMemberInfo {
  id: number;
  user: {
    userId: number;
    fullName: string;
    username: string;
    profilePicUrl?: string | null;
  };
  role?: string;
}

// ── Sprints ────────────────────────────────────────

export interface Sprint {
  id: number;
  name: string;
  startDate?: string | null;
  endDate?: string | null;
  status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED';
}

export interface SprintItem {
  id: number;
  name: string;
  status: string;
  startDate?: string;
  endDate?: string;
  goal?: string;
  tasks: TaskItem[];
}

export interface TaskItem {
  id: number;
  taskNo: number;
  title: string;
  storyPoints: number;
  selected: boolean;
  assigneeName?: string;
  assigneePhotoUrl?: string | null;
  sprintId?: number | null;
  status?: string;
  startDate?: string;
  dueDate?: string;
  priority?: string;
  labels?: Label[];
}

// ── Burndown ───────────────────────────────────────

export interface BurndownPoint {
  date: string;
  remainingPoints: number;
  idealPoints: number;
}

export interface BurndownResponse {
  sprintId: number;
  sprintName: string;
  startDate: string;
  endDate: string;
  totalStoryPoints: number;
  dataPoints: BurndownPoint[];
}

// ── Calendar ───────────────────────────────────────

export type CalendarView = 'month' | 'week' | 'agenda';

export interface CalendarEventItem {
  id: string;
  title: string;
  kind: 'sprint' | 'task';
  type?: string;
  status?: string;
  assignee?: string;
  startDate?: string;
  endDate?: string;
  dueDate?: string;
  creator?: string;
  description?: string;
  environment?: string;
  hasAttachment?: boolean;
  hasComment?: boolean;
}

export interface CalendarFilters {
  search: string;
  assignees: string[];
  types: string[];
  statuses: string[];
  moreFilters: string[];
}

// ── Chat ───────────────────────────────────────────

export interface ChatMessage {
  id?: number;
  sender: string;
  content: string;
  timestamp?: string;
  recipient?: string;
  type?: 'CHAT' | 'JOIN' | 'LEAVE';
  roomId?: number;
  parentMessageId?: number;
  formatType?: 'PLAIN' | 'MARKDOWN';
  deleted?: boolean;
  deletedAt?: string;
  editedAt?: string;
}

export interface ChatReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface ChatRoom {
  id: number;
  name: string;
  projectId: number;
  createdBy: string;
  topic?: string;
  description?: string;
  archived?: boolean;
  pinnedMessageId?: number | null;
  updatedAt?: string;
}

export interface DirectChatSummary {
  username: string;
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageTimestamp: string | null;
  unseenCount: number;
}

export interface RoomChatSummary {
  roomId: number;
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageTimestamp: string | null;
  unseenCount: number;
}

export interface TeamChatSummary {
  lastMessage: string | null;
  lastMessageSender: string | null;
  lastMessageTimestamp: string | null;
  unseenCount: number;
}

export interface PresenceResponse {
  onlineUsers: string[];
  onlineCount: number;
}

export interface UnreadBadgeSummary {
  teamUnread: number;
  roomsUnread: number;
  directsUnread: number;
  totalUnread: number;
}

export interface ChatFeatureFlags {
  phaseDEnabled: boolean;
  phaseEEnabled: boolean;
  webhooksEnabled: boolean;
  telemetryEnabled: boolean;
}

export interface ChatSearchResult {
  messageId: number;
  sender: string;
  content: string;
  context: 'TEAM' | 'ROOM' | 'PRIVATE' | string;
  roomId?: number | null;
  recipient?: string | null;
  timestamp?: string | null;
}

// ── Documents / DMS ────────────────────────────────

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

// ── Documentation/Pages ────────────────────────────

export interface PageItem {
  id: string | number;
  title: string;
  content?: string;
  parentId?: string | number | null;
  createdAt?: string;
  updatedAt?: string;
  isStarred?: boolean;
}

export interface PageHistoryItem {
  id: string;
  pageId: string | number;
  editedBy: string;
  editedAt: string;
  action: 'created' | 'edited' | 'restored';
}

// ── Notifications ──────────────────────────────────

export interface Notification {
  id: number;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
}

// ── Sidebar ────────────────────────────────────────

export interface ChatRoomSummary {
  roomId: number;
  roomName?: string;
  lastMessage?: string;
  lastMessageSender?: string;
  unseenCount?: number;
}

export interface DirectMessageSummary {
  username: string;
  lastMessage?: string;
  lastMessageSender?: string;
  unseenCount?: number;
}

export interface ChatSummaries {
  rooms: ChatRoomSummary[];
  directMessages: DirectMessageSummary[];
}

// ── View types ─────────────────────────────────────

export type WorkspaceView = 'list' | 'board' | 'calendar' | 'gantt' | 'timeline' | 'table';

export type ViewMode = 'view-all' | 'recent' | 'favorites' | 'shared' | 'trash';

// ── Status / Priority color maps ───────────────────

export const STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-status-todo',
  IN_PROGRESS: 'bg-status-in-progress',
  IN_REVIEW: 'bg-status-in-review',
  DONE: 'bg-status-done',
};

export const STATUS_TEXT_COLORS: Record<string, string> = {
  TODO: 'text-cu-text-secondary',
  IN_PROGRESS: 'text-cu-purple',
  IN_REVIEW: 'text-cu-warning',
  DONE: 'text-cu-success',
};

export const STATUS_LABELS: Record<string, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
};

export const PRIORITY_COLORS: Record<string, string> = {
  URGENT: 'text-priority-urgent',
  HIGH: 'text-priority-high',
  MEDIUM: 'text-priority-normal',
  NORMAL: 'text-priority-normal',
  LOW: 'text-priority-low',
};

export const PRIORITY_BG_COLORS: Record<string, string> = {
  URGENT: 'bg-priority-urgent',
  HIGH: 'bg-priority-high',
  MEDIUM: 'bg-priority-normal',
  NORMAL: 'bg-priority-normal',
  LOW: 'bg-priority-low',
};

// ── Milestones ─────────────────────────────────────

export interface MilestoneResponse {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  dueDate?: string;
  status: 'OPEN' | 'COMPLETED' | 'ARCHIVED';
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneRequest {
  name: string;
  description?: string;
  dueDate?: string;
  status?: 'OPEN' | 'COMPLETED' | 'ARCHIVED';
}

// ── Extended User Profile ──────────────────────────

export interface UserProfile {
  userId: number;
  username: string;
  email: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  contactNumber?: string;
  countryCode?: string;
  jobTitle?: string;
  company?: string;
  position?: string;
  bio?: string;
  profilePicUrl?: string;
  lastActive?: string;
}
=======
export * from './task';
export * from './project';
export * from './dms';
export * from './chat';
export * from './user';
>>>>>>> origin/responsive-pages
