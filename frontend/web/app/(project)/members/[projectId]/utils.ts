import type { Member, MemberCombined, PendingInvite } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';
const MEMBERS_CACHE_KEY_PREFIX = 'planora:members:';

export function getMembersCacheKey(projectId: string): string {
  return `${MEMBERS_CACHE_KEY_PREFIX}${projectId}`;
}

export function timeAgo(dateString?: string): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return '1 day ago';
  return `${Math.floor(diff / 86400)} days ago`;
}

export function buildCombinedMembers(members: Member[], pending: PendingInvite[]): MemberCombined[] {
  return [
    ...members,
    ...pending.map((invite) => {
      const role = typeof invite.role === 'string' && invite.role.length > 0 ? invite.role.toUpperCase() : 'MEMBER';
      return {
        id: invite.id,
        role,
        user: {
          userId: 0,
          username: '',
          fullName: '',
          email: invite.email,
          profilePicUrl: undefined,
        },
        lastActive: undefined,
        taskCount: 0,
        status: 'Pending',
        invitedAt: invite.invitedAt,
      };
    }),
  ];
}

export function canManageMember(
  currentUserRole: string | null,
  currentUserEmail: string | null,
  targetMember: MemberCombined,
): boolean {
  if (!currentUserRole) return false;

  const currentRole = String(currentUserRole).toUpperCase().trim();
  const targetRole = String(targetMember.role).toUpperCase().trim();

  if (targetMember.status === 'Pending') return false;
  if (currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail) return false;
  if (currentRole === 'OWNER') return true;
  if (currentRole === 'ADMIN') return targetRole === 'MEMBER' || targetRole === 'VIEWER';

  return false;
}

export function resolveProfilePicUrl(profilePicUrl?: string): string {
  if (!profilePicUrl) return '';

  if (
    profilePicUrl.startsWith('http://') ||
    profilePicUrl.startsWith('https://') ||
    profilePicUrl.startsWith('data:') ||
    profilePicUrl.startsWith('blob:')
  ) {
    return profilePicUrl;
  }

  return `${API_BASE_URL}${profilePicUrl.startsWith('/') ? '' : '/'}${profilePicUrl}`;
}
