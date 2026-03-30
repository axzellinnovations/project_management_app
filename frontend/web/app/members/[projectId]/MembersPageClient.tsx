"use client";

import { useEffect, useState, useMemo } from "react";
// Heroicons and custom SVGs for UI icons
const ICONS = {
  members: <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 1 1-8 0M12 7a4 4 0 0 1 4-4" /></svg>,
  active: <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  admin: <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 20h14M12 4v16m0-16l4 4m-4-4l-4 4" /></svg>,
  pending: <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  owner: <svg className="w-4 h-4 inline text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  adminRole: <svg className="w-4 h-4 inline text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  member: <svg className="w-4 h-4 inline text-blue-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>,
  viewer: <svg className="w-4 h-4 inline text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M2.05 12a9.94 9.94 0 0 1 19.9 0 9.94 9.94 0 0 1-19.9 0z" /></svg>,
};
import axios from "@/lib/axios";
import { getUserFromToken } from "@/lib/auth";

interface Member {
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

interface PendingInvite {
  id: number;
  email: string;
  invitedAt: string;
  status: string;
  role: string;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-100 text-yellow-700",
  ADMIN: "bg-purple-100 text-purple-700",
  MEMBER: "bg-blue-100 text-blue-700",
  VIEWER: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
};

const ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export default function MembersPageClient({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Role management state
  const [roleChangeError, setRoleChangeError] = useState("");
  const [roleChangeSuccess, setRoleChangeSuccess] = useState("");
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const user = getUserFromToken();
    if (user?.email) {
      setCurrentUserEmail(user.email.toLowerCase());
    }
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [membersRes, pendingRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}/members`),
        axios.get(`/api/projects/${projectId}/pending-invites`),
      ]);
      setMembers(membersRes.data);
      setPending(pendingRes.data);
      // Debug: log pending invites to verify role
      if (pendingRes.data && Array.isArray(pendingRes.data)) {
        console.log('Pending invites:', pendingRes.data.map((p: any) => ({ email: p.email, role: p.role })));
      }
      setLoading(false);
    }
    if (projectId) fetchData();
  }, [projectId]);

  const allMembers = useMemo(() => [
    ...members,
    ...pending.map((p: PendingInvite) => {
      // Use the role from backend directly, fallback only if missing
      const role = (typeof p.role === "string" && p.role.length > 0) ? p.role.toUpperCase() : "MEMBER";
      return {
        id: p.id,
        role,
        user: {
          userId: 0,
          username: "",
          fullName: "",
          email: p.email,
          profilePicUrl: undefined,
        },
        lastActive: undefined,
        taskCount: 0,
        status: "Pending",
        invitedAt: p.invitedAt,
      };
    }),
  ], [members, pending]);

  const filteredMembers = useMemo(() => {
    return allMembers.filter((m) => {
      const matchesSearch =
        m.user.fullName?.toLowerCase().includes(search.toLowerCase()) ||
        m.user.email?.toLowerCase().includes(search.toLowerCase());
      const matchesRole = !roleFilter || m.role === roleFilter;
      const matchesStatus = !statusFilter || m.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [allMembers, search, roleFilter, statusFilter]);

  // Stats
  const totalMembers = allMembers.length;
  const activeCount = allMembers.filter((m) => m.status === "Active").length;
  const adminCount = allMembers.filter((m) => m.role === "ADMIN").length;
  const pendingCount = allMembers.filter((m) => m.status === "Pending").length;

  const currentUserRole = useMemo(() => {
    let found = null;
    const tokenUser = getUserFromToken() as any;
    if (tokenUser?.userId) {
       found = members.find(m => String(m.user.userId) === String(tokenUser.userId));
    }
    if (!found && currentUserEmail) {
       found = members.find(m => m.user.email?.toLowerCase() === currentUserEmail);
    }
    return found?.role || null;
  }, [members, currentUserEmail]);

  const canChangeRole = (targetMember: typeof allMembers[0]) => {
    if (!currentUserRole) return false;
    
    const currentRole = String(currentUserRole).toUpperCase().trim();
    const targetRole = String(targetMember.role).toUpperCase().trim();

    // Cannot edit pending invites
    if (targetMember.status === "Pending") return false;
    
    // Cannot edit self
    if (currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail) return false;

    if (currentRole === "OWNER") return true;
    if (currentRole === "ADMIN") {
      return targetRole === "MEMBER" || targetRole === "VIEWER";
    }
    return false;
  };

  const getAvailableOptions = () => {
    if (currentUserRole?.toUpperCase() === "ADMIN") {
      return ["MEMBER", "VIEWER"];
    }
    return ROLE_OPTIONS;
  };

  const handleRoleChange = async (userId: number, newRole: string) => {
    setRoleChangeError("");
    setRoleChangeSuccess("");
    setChangingRoleId(userId);
    try {
      await axios.patch(`/api/projects/${projectId}/members/${userId}/role`, {
        role: newRole,
        userId: userId
      });
      // Optionally refetch members, or simply update local state
      setMembers(prev => prev.map(m => m.user.userId === userId ? { ...m, role: newRole } : m));
      setRoleChangeSuccess("Role updated successfully!");
      setTimeout(() => setRoleChangeSuccess(""), 3000);
    } catch (err: any) {
      setRoleChangeError(err?.response?.data?.message || err?.response?.data?.error || "Failed to update role");
      setTimeout(() => setRoleChangeError(""), 4000);
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await axios.post(`/api/projects/${projectId}/invitations`, {
        email: inviteEmail,
        role: inviteRole.toUpperCase(),
      });
      setInviteSuccess("Invitation sent!");
      setInviteEmail("");
      setInviteRole("");
      setShowModal(false);
      // Refresh pending invites
      const pendingRes = await axios.get(`/api/projects/${projectId}/pending-invites`);
      setPending(pendingRes.data);
    } catch (err: any) {
      setInviteError(err?.response?.data?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <div className="text-gray-500 mt-1">Manage your team and their permissions</div>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-1.5 rounded-[12px] bg-[#185ADB] text-white font-medium text-base shadow-md hover:bg-[#185ADB] focus:outline-none focus:ring-2 focus:ring-blue-300"
          style={{ boxShadow: '0 2px 8px 0 rgba(24,90,219,0.10)' }}
          onClick={() => setShowModal(true)}
        >
          {/* User Plus Icon (smaller, white, left-aligned) */}
          <svg className="w-5 h-5 mr-1" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="4" stroke="white" strokeWidth="2" />
            <path d="M17 8v6M20 11h-6" stroke="white" strokeWidth="2" strokeLinecap="round" />
            <path d="M3 20v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" stroke="white" strokeWidth="2" />
          </svg>
          Invite Member
        </button>
      </div>

      {roleChangeSuccess && (
         <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm">
           {roleChangeSuccess}
         </div>
      )}
      {roleChangeError && (
         <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md shadow-sm">
           {roleChangeError}
         </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* Total Members */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
          <div>
            <div className="text-gray-500 text-sm mb-1">Total Members</div>
            <div className="text-xl font-semibold text-gray-900">{totalMembers}</div>
          </div>
          <div className="bg-blue-100 rounded-[16px] p-3 flex items-center justify-center">
            {/* Single-person with partial second-person outline, blue, smaller size */}
            <svg className="w-6 h-6 text-[#185ADB]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
              <circle cx="16" cy="14" r="5" />
              <path d="M7 26c0-3 4.5-5 9-5s9 2 9 5" />
              <path d="M23 10c1.5 0 3 1.12 3 3s-1.5 3-3 3" />
            </svg>
          </div>
        </div>
        {/* Active */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
          <div>
            <div className="text-gray-500 text-sm mb-1">Active</div>
            <div className="text-xl font-semibold text-gray-900">{activeCount}</div>
          </div>
          <div className="bg-green-100 rounded-[16px] p-3 flex items-center justify-center">
            {/* Activity icon, smaller size */}
            <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
              <polyline points="4,18 10,18 14,6 18,26 22,14 28,14" />
            </svg>
          </div>
        </div>
        {/* Admins */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
          <div>
            <div className="text-gray-500 text-sm mb-1">Admins</div>
            <div className="text-xl font-semibold text-gray-900">{adminCount}</div>
          </div>
          <div className="bg-[#F3EFFF] rounded-[16px] p-3 flex items-center justify-center">
            {/* Classic crown icon, purple, smaller size */}
            <svg className="w-6 h-6 text-[#A259FF]" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
              <polyline points="8,20 12,12 16,18 20,12 24,20" />
              <line x1="10" y1="24" x2="22" y2="24" />
              <line x1="12" y1="22" x2="20" y2="22" />
            </svg>
          </div>
        </div>
        {/* Pending */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-row items-center justify-between min-w-[180px]">
          <div>
            <div className="text-gray-500 text-sm mb-1">Pending</div>
            <div className="text-xl font-semibold text-gray-900">{pendingCount}</div>
          </div>
          <div className="bg-yellow-100 rounded-[16px] p-3 flex items-center justify-center">
            {/* Clock icon, smaller size */}
            <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" />
              <path d="M16 10v7l5 3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <input
          type="text"
          className="flex-1 border rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="Search members by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="border rounded px-4 py-2 flex items-center gap-2 text-sm bg-white hover:bg-gray-50"
          onClick={() => setShowFilters(f => !f)}
        >
          <span>Filters</span>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 6h16M6 12h12M10 18h4" /></svg>
        </button>
      </div>
      {showFilters && (
        <div className="flex gap-4 mb-4">
          <select
            className="border rounded px-3 py-2 text-sm"
            value={roleFilter || ""}
            onChange={e => setRoleFilter(e.target.value || null)}
          >
            <option value="">All Roles</option>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="MEMBER">Member</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <select
            className="border rounded px-3 py-2 text-sm"
            value={statusFilter || ""}
            onChange={e => setStatusFilter(e.target.value || null)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-6 py-3 text-left font-semibold text-gray-700">Member</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Last Active</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Tasks</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredMembers.map((m, idx) => (
              <tr key={m.id + m.user.email} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3 flex items-center gap-3">
                  {m.user.profilePicUrl ? (
                    <img src={m.user.profilePicUrl} alt={m.user.fullName} className="w-9 h-9 rounded-full" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-base">
                      {m.user.fullName ? m.user.fullName.split(" ").map(n => n[0]).join("") : m.user.email[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{m.user.fullName || m.user.email}</div>
                    <div className="text-xs text-gray-500">{m.user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {canChangeRole(m) && m.user.userId ? (
                    <div className="relative">
                      <select 
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user.userId, e.target.value)}
                        disabled={changingRoleId === m.user.userId}
                        className={`appearance-none outline-none cursor-pointer pl-7 pr-4 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-700"}`}
                      >
                        {getAvailableOptions().map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                        {m.role === "OWNER" && ICONS.owner}
                        {m.role === "ADMIN" && ICONS.adminRole}
                        {m.role === "MEMBER" && ICONS.member}
                        {m.role === "VIEWER" && ICONS.viewer}
                      </div>
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-60">
                         {changingRoleId === m.user.userId ? (
                           <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         ) : (
                           <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                         )}
                      </div>
                    </div>
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-max ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-700"}`}>
                      {m.role === "OWNER" && ICONS.owner}
                      {m.role === "ADMIN" && ICONS.adminRole}
                      {m.role === "MEMBER" && ICONS.member}
                      {m.role === "VIEWER" && ICONS.viewer}
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[m.status] || "bg-gray-100 text-gray-700"}`}>{m.status}</span>
                </td>
                <td className="px-4 py-3">
                  {m.status === "Pending"
                    ? "Never"
                    : m.lastActive
                      ? timeAgo(m.lastActive)
                      : "-"}
                </td>
                <td className="px-4 py-3 font-semibold text-blue-700">{m.taskCount}</td>
                <td className="px-4 py-3 text-right">
                  <button className="p-2 rounded hover:bg-gray-100">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="6" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="18" r="1.5"/></svg>
                  </button>
                </td>
              </tr>
            ))}
            {filteredMembers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-400">No members found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Invite Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => setShowModal(false)}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email Address <span className="text-red-500">*</span></label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role <span className="text-red-500">*</span></label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  required
                >
                  <option value="">Select a role</option>
                  {ROLE_OPTIONS.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>
              {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
              {inviteSuccess && <div className="text-green-600 text-sm">{inviteSuccess}</div>}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="flex-1 py-2 rounded border border-gray-300 bg-gray-100 hover:bg-gray-200"
                  onClick={() => setShowModal(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Sending..." : (<><span className="mr-2">✉️</span>Send Invite</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(dateString?: string) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return `${diff} seconds ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 172800) return `1 day ago`;
  return `${Math.floor(diff / 86400)} days ago`;
}