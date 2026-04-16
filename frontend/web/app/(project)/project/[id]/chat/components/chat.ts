export interface ChatMessage {
  id?: number;
  localId?: string;
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

export interface User {
  username: string;
  email?: string;
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

export interface ChatWebhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
}
