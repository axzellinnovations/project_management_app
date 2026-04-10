import api from '@/lib/axios';
import type {
  ChatFeatureFlags,
  ChatMessage,
  ChatReactionSummary,
  ChatRoom,
  ChatSearchResult,
  DirectChatSummary,
  PresenceResponse,
  RoomChatSummary,
  TeamChatSummary,
  UnreadBadgeSummary,
} from '@/app/(project)/project/[id]/chat/components/chat';

// â”€â”€ Types â”€â”€

export interface ChatSummaries {
  directSummaries: DirectChatSummary[];
  roomSummaries: RoomChatSummary[];
  teamSummary: TeamChatSummary | null;
}

export interface AuthUserSummary {
  email?: string;
  username?: string;
}

// â”€â”€ Team / General â”€â”€

export async function markTeamAsRead(projectId: string): Promise<void> {
  await api.post(`/api/projects/${projectId}/chat/mark-read`);
}

export async function fetchPresence(projectId: string): Promise<PresenceResponse> {
  const { data } = await api.get<PresenceResponse>(`/api/projects/${projectId}/chat/presence`);
  return data;
}

export async function postTelemetry(
  projectId: string,
  action: string,
  target: string,
  details?: string,
): Promise<void> {
  await api.post(`/api/projects/${projectId}/chat/telemetry`, { action, target, details });
}

export async function fetchFeatureFlags(projectId: string): Promise<ChatFeatureFlags> {
  const { data } = await api.get<ChatFeatureFlags>(`/api/projects/${projectId}/chat/features`);
  return data;
}

export async function fetchUnreadBadge(projectId: string): Promise<UnreadBadgeSummary> {
  const { data } = await api.get<UnreadBadgeSummary>(`/api/projects/${projectId}/chat/unread-badge`);
  return data;
}

// â”€â”€ Search â”€â”€

export async function searchChatMessages(
  projectId: string,
  query: string,
): Promise<ChatSearchResult[]> {
  const { data } = await api.get<ChatSearchResult[]>(
    `/api/projects/${projectId}/chat/search`,
    { params: { q: query } },
  );
  return data;
}

// â”€â”€ Members / Users â”€â”€

export async function fetchChatMembers(projectId: string): Promise<string[]> {
  const { data } = await api.get<string[]>(`/api/projects/${projectId}/chat/members`);
  return data;
}

export async function fetchAllUserProfiles(): Promise<AuthUserSummary[]> {
  const { data } = await api.get<AuthUserSummary[]>('/api/auth/users');
  return data;
}

export async function fetchCurrentUser(): Promise<{ username: string }> {
  const { data } = await api.get<{ username: string }>('/api/user/me');
  return data;
}

// â”€â”€ Summaries â”€â”€

export async function fetchChatSummaries(projectId: string): Promise<ChatSummaries> {
  const { data } = await api.get(`/api/projects/${projectId}/chat/summaries`);
  const directSummaries: DirectChatSummary[] = data.directSummaries || [];
  const roomSummaries: RoomChatSummary[] = data.roomSummaries || [];
  const teamSummary: TeamChatSummary | null = data.teamSummary || null;
  return { directSummaries, roomSummaries, teamSummary };
}

// â”€â”€ Messages â”€â”€

export async function fetchTeamMessages(projectId: string): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(`/api/projects/${projectId}/chat/messages`);
  return data;
}

export async function fetchRoomMessages(
  projectId: string,
  roomId: number,
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(
    `/api/projects/${projectId}/chat/messages`,
    { params: { roomId } },
  );
  return data;
}

export async function fetchPrivateMessages(
  projectId: string,
  currentUser: string,
  withUser: string,
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(
    `/api/projects/${projectId}/chat/messages`,
    { params: { recipient: currentUser, with: withUser } },
  );
  return data;
}

export async function editMessageRest(
  projectId: string,
  messageId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await api.patch<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${messageId}`,
    { content, formatType: 'PLAIN' },
  );
  return data;
}

export async function deleteMessageRest(
  projectId: string,
  messageId: number,
): Promise<ChatMessage> {
  const { data } = await api.delete<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${messageId}`,
  );
  return data;
}

// â”€â”€ Threads â”€â”€

export async function fetchThreadMessages(
  projectId: string,
  parentMessageId: number,
): Promise<ChatMessage[]> {
  const { data } = await api.get<ChatMessage[]>(
    `/api/projects/${projectId}/chat/messages/${parentMessageId}/thread`,
  );
  return data;
}

export async function postThreadReply(
  projectId: string,
  parentMessageId: number,
  content: string,
): Promise<ChatMessage> {
  const { data } = await api.post<ChatMessage>(
    `/api/projects/${projectId}/chat/messages/${parentMessageId}/thread/replies`,
    { content, formatType: 'PLAIN' },
  );
  return data;
}

// â”€â”€ Reactions â”€â”€

export async function fetchMessageReactions(
  projectId: string,
  messageId: number,
): Promise<ChatReactionSummary[]> {
  const { data } = await api.get<ChatReactionSummary[]>(
    `/api/projects/${projectId}/chat/messages/${messageId}/reactions`,
  );
  return data;
}

export async function toggleReactionRest(
  projectId: string,
  messageId: number,
  emoji: string,
): Promise<ChatReactionSummary[]> {
  const { data } = await api.post<ChatReactionSummary[]>(
    `/api/projects/${projectId}/chat/messages/${messageId}/reactions/toggle`,
    { emoji },
  );
  return data;
}

// â”€â”€ Rooms â”€â”€

export async function fetchRooms(projectId: string): Promise<ChatRoom[]> {
  const { data } = await api.get<ChatRoom[]>(`/api/projects/${projectId}/chat/rooms`);
  return data;
}

export async function createRoomRest(
  projectId: string,
  name: string,
  members: string[],
): Promise<ChatRoom> {
  const { data } = await api.post<ChatRoom>(
    `/api/projects/${projectId}/chat/rooms`,
    { name, members },
  );
  return data;
}

export async function deleteRoomRest(
  projectId: string,
  roomId: number,
): Promise<void> {
  await api.delete(`/api/projects/${projectId}/chat/rooms/${roomId}`);
}

export async function updateRoomMetaRest(
  projectId: string,
  roomId: number,
  updates: { name?: string; topic?: string; description?: string },
): Promise<ChatRoom> {
  const { data } = await api.patch<ChatRoom>(
    `/api/projects/${projectId}/chat/rooms/${roomId}/meta`,
    updates,
  );
  return data;
}

export async function pinRoomMessageRest(
  projectId: string,
  roomId: number,
  messageId: number | null,
): Promise<ChatRoom> {
  const { data } = await api.patch<ChatRoom>(
    `/api/projects/${projectId}/chat/rooms/${roomId}/pin`,
    { messageId },
  );
  return data;
}

