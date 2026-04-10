// ── User / Auth Domain Types ───────────────────────

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

// ── Notifications ──────────────────────────────────

export interface Notification {
  id: number;
  message: string;
  link: string;
  isRead: boolean;
  createdAt: string;
  type?: string;
}
