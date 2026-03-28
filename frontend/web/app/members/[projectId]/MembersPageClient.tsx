"use client";

import { useEffect, useState, useMemo } from "react";
import axios from "@/lib/axios";

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

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [membersRes, pendingRes] = await Promise.all([
        axios.get(`/api/projects/${projectId}/members`),
        axios.get(`/api/projects/${projectId}/pending-invites`),
      ]);
      setMembers(membersRes.data);
      setPending(pendingRes.data);
      setLoading(false);
    }
    if (projectId) fetchData();
  }, [projectId]);

  const allMembers = useMemo(() => [
    ...members,
    ...pending.map((p) => ({
      id: p.id,
      role: "MEMBER",
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
    })),
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await axios.post(`/api/projects/${projectId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
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
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-medium flex items-center gap-2 self-start md:self-auto"
          onClick={() => setShowModal(true)}
        >
          <span className="text-lg">👤</span> Invite Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-gray-500 text-xs mb-1">Total Members</div>
          <div className="text-2xl font-bold">{totalMembers}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-gray-500 text-xs mb-1">Active</div>
          <div className="text-2xl font-bold">{activeCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-gray-500 text-xs mb-1">Admins</div>
          <div className="text-2xl font-bold">{adminCount}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 flex flex-col items-center">
          <div className="text-gray-500 text-xs mb-1">Pending</div>
          <div className="text-2xl font-bold">{pendingCount}</div>
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
                  <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-700"}`}>{ROLE_LABELS[m.role] || m.role}</span>
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
