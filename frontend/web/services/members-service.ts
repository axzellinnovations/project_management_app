import api from '@/lib/axios';

// ── Types ──

export interface Member {
  id: number;
  userId: number;
  username: string;
  email: string;
  role: string;
  joinedAt: string;
}

export interface PendingInvite {
  id: number;
  email: string;
  role: string;
  invitedAt: string;
}

// ── API ──

export async function fetchMembers(projectId: string): Promise<Member[]> {
  const { data } = await api.get<Member[]>(`/api/projects/${projectId}/members`);
  return data;
}

export async function fetchPendingInvites(projectId: string): Promise<PendingInvite[]> {
  const { data } = await api.get<PendingInvite[]>(`/api/projects/${projectId}/pending-invites`);
  return data;
}

export async function changeRole(
  projectId: string,
  userId: number,
  role: string,
): Promise<void> {
  await api.patch(`/api/projects/${projectId}/members/${userId}/role`, { role, userId });
}

export async function removeMember(
  projectId: string,
  userId: number,
): Promise<void> {
  await api.delete(`/api/projects/${projectId}/members/${userId}`);
}

export async function sendInvite(
  projectId: string,
  email: string,
  role: string,
): Promise<void> {
  await api.post(`/api/projects/${projectId}/invitations`, { email, role });
}
