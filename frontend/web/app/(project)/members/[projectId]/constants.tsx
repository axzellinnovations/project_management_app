export const ICONS = {
  members: <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 1 1-8 0M12 7a4 4 0 0 1 4-4" /></svg>,
  active: <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  admin: <svg className="w-6 h-6 text-cu-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 20h14M12 4v16m0-16l4 4m-4-4l-4 4" /></svg>,
  pending: <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  owner: <svg className="w-4 h-4 inline text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  adminRole: <svg className="w-4 h-4 inline text-cu-primary" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  member: <svg className="w-4 h-4 inline text-blue-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>,
  viewer: <svg className="w-4 h-4 inline text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M2.05 12a9.94 9.94 0 0 1 19.9 0 9.94 9.94 0 0 1-19.9 0z" /></svg>,
};

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
};

export const ROLE_COLORS: Record<string, string> = {
  OWNER: 'bg-yellow-100 text-yellow-700',
  ADMIN: 'bg-cu-primary/10 text-cu-primary',
  MEMBER: 'bg-blue-50 text-blue-700',
  VIEWER: 'bg-gray-100 text-gray-700',
};

export const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-100 text-green-700',
  Pending: 'bg-yellow-100 text-yellow-700',
};

export const ROLE_OPTIONS = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
