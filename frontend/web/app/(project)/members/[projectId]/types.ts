export interface Member {
  id: number;
  role: string;
  user: {
    userId: number;
    username: string;
    fullName: string;
    email: string;
    profilePicUrl?: string;
  };
  lastActive?: string;
  taskCount: number;
  status: string;
}

export interface PendingInvite {
  id: number;
  email: string;
  invitedAt: string;
  status: string;
  role: string;
}

export type MemberCombined = Member & { invitedAt?: string };

export interface MembersCachePayload {
  members: Member[];
  pending: PendingInvite[];
  timestamp: number;
}
