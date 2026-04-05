"use client";

import Image from "next/image";
import {
  useMembersData, timeAgo
} from "./useMembersData";

// Heroicons and custom SVGs for UI icons
const ICONS = {
  members: <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87M16 3.13a4 4 0 1 1-8 0M12 7a4 4 0 0 1 4-4" /></svg>,
  active: <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  admin: <svg className="w-6 h-6 text-cu-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M5 20h14M12 4v16m0-16l4 4m-4-4l-4 4" /></svg>,
  pending: <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 8v4l3 3" /></svg>,
  owner: <svg className="w-4 h-4 inline text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  adminRole: <svg className="w-4 h-4 inline text-cu-primary" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33-3.87-3.77 5.34-.78L10 2z" /></svg>,
  member: <svg className="w-4 h-4 inline text-blue-500" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>,
  viewer: <svg className="w-4 h-4 inline text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M2.05 12a9.94 9.94 0 0 1 19.9 0 9.94 9.94 0 0 1-19.9 0z" /></svg>,
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-yellow-100 text-yellow-700",
  ADMIN: "bg-cu-primary/10 text-cu-primary",
  MEMBER: "bg-blue-50 text-blue-700",
  VIEWER: "bg-gray-100 text-gray-700",
};

const STATUS_COLORS: Record<string, string> = {
  Active: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
};

const ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export default function MembersPageClient({ projectId }: { projectId: string }) {
  const {
    loading, filteredMembers, totalMembers, activeCount, adminCount, pendingCount,
    search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    showFilters, setShowFilters,
    showModal, setShowModal, inviteEmail, setInviteEmail, inviteRole, setInviteRole,
    inviteLoading, inviteError, inviteSuccess,
    roleChangeError, roleChangeSuccess, changingRoleId,
    showRemoveModal, setShowRemoveModal, memberToRemove, setMemberToRemove,
    removeLoading, removeError, setRemoveError, removeSuccess,
    brokenProfileImages, setBrokenProfileImages,
    canChangeRole, canRemoveMember, getAvailableOptions,
    resolveProfilePicUrl, getMemberProfilePicCandidates,
    handleRoleChange, handleRemoveMemberConfirm, handleInvite,
  } = useMembersData(projectId);
  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Team Members</h1>
          <div className="text-gray-500 mt-1">Manage your team and their permissions</div>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-1.5 rounded-[12px] bg-cu-primary text-white font-medium text-base shadow-md hover:bg-cu-primary-dark focus:outline-none focus:ring-2 focus:ring-blue-300"
          style={{ boxShadow: '0 2px 8px 0 rgba(21,93,252,0.1)' }}
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
      {removeSuccess && (
         <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm">
           {removeSuccess}
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
          <div className="bg-cu-primary/10 rounded-[16px] p-3 flex items-center justify-center">
            {/* Classic crown icon, blue, smaller size */}
            <svg className="w-6 h-6 text-cu-primary" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 32 32">
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
          className="flex-1 border rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/20"
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

      {/* Members Table - mobile: fully swipeable columns with clear separators */}
      <div className="bg-white rounded-lg shadow">
        <div className="max-md:-mx-4">
          {/* Mobile rail: all columns swipe together with momentum; separators hint more content */}
          <div
            className="relative overflow-x-auto max-md:px-4"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <table className="min-w-full max-md:min-w-[920px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-6 py-3 text-left font-semibold text-gray-700 whitespace-nowrap max-md:min-w-[220px] max-md:border-r max-md:border-gray-100">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap max-md:min-w-[150px] max-md:border-l max-md:border-gray-100">Role</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap max-md:min-w-[130px] max-md:border-l max-md:border-gray-100">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap max-md:min-w-[170px] max-md:border-l max-md:border-gray-100">Last Active</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 whitespace-nowrap max-md:min-w-[130px] max-md:border-l max-md:border-gray-100">Tasks</th>
                  <th className="px-4 py-3 whitespace-nowrap max-md:min-w-[130px] max-md:border-l max-md:border-gray-100"></th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
              const avatarKey = `${m.id}-${m.user.email}`;
              const resolvedCandidates = getMemberProfilePicCandidates(m)
                .map((url) => resolveProfilePicUrl(url))
                .filter(Boolean);
              const resolvedProfilePicUrl = resolvedCandidates.find(
                (url) => !brokenProfileImages[`${avatarKey}:${url}`]
              ) || "";

              return (
              <tr key={m.id + m.user.email} className="border-b hover:bg-gray-50">
                <td className="px-6 py-3 flex items-center gap-3 max-md:min-w-[220px] max-md:border-r max-md:border-gray-100">
                  {resolvedProfilePicUrl && !brokenProfileImages[avatarKey] ? (
                    <Image
                      src={resolvedProfilePicUrl}
                      alt={m.user.fullName || m.user.email}
                      width={36}
                      height={36}
                      unoptimized={true}
                      className="w-9 h-9 rounded-full object-cover"
                      onError={() => setBrokenProfileImages(prev => ({ ...prev, [`${avatarKey}:${resolvedProfilePicUrl}`]: true }))}
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-cu-primary flex items-center justify-center text-white font-bold text-base">
                      {m.user.fullName ? m.user.fullName.split(" ").map(n => n[0]).join("") : m.user.email[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="max-md:max-w-[180px]">
                    <div className="font-medium text-gray-900 truncate">{m.user.fullName || m.user.email}</div>
                    <div className="text-xs text-gray-500 truncate">{m.user.email}</div>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap max-md:min-w-[140px] max-md:border-l max-md:border-gray-100">
                  {canChangeRole(m) && m.user.userId ? (
                    <div className="relative">
                      <select 
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user.userId, e.target.value)}
                        disabled={changingRoleId === m.user.userId}
                        className={`appearance-none outline-none cursor-pointer pl-7 pr-4 py-2 max-md:min-h-[44px] rounded-md text-xs font-semibold uppercase tracking-wider ${ROLE_COLORS[m.role] || "bg-gray-100 text-gray-700"}`}
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
                <td className="px-4 py-3 align-middle whitespace-nowrap max-md:min-w-[120px] max-md:border-l max-md:border-gray-100">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[m.status] || "bg-gray-100 text-gray-700"}`}>{m.status}</span>
                </td>
                <td className="px-4 py-3 align-middle whitespace-nowrap max-md:min-w-[160px] max-md:border-l max-md:border-gray-100">
                  {m.status === "Pending"
                    ? "Never"
                    : m.lastActive
                      ? timeAgo(m.lastActive)
                      : "-"}
                </td>
                <td className="px-4 py-3 font-semibold text-blue-700 align-middle whitespace-nowrap max-md:min-w-[120px] max-md:border-l max-md:border-gray-100">{m.taskCount}</td>
                <td className="px-4 py-3 text-right align-middle whitespace-nowrap max-md:min-w-[120px] max-md:border-l max-md:border-gray-100">
                  {canRemoveMember(m) && (
                    <button 
                      onClick={() => { setMemberToRemove(m); setShowRemoveModal(true); setRemoveError(""); }}
                      className="p-1 px-3 max-md:min-h-[44px] rounded text-red-600 hover:bg-red-50 font-medium text-sm transition-colors border border-transparent hover:border-red-200"
                      title="Remove Member"
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
                {filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">No members found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                  className="flex-1 py-2 rounded bg-cu-primary text-white hover:bg-cu-primary-dark flex items-center justify-center"
                  disabled={inviteLoading}
                >
                  {inviteLoading ? "Sending..." : (<><span className="mr-2">✉️</span>Send Invite</>)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveModal && memberToRemove && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
          <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm relative">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
              onClick={() => { setShowRemoveModal(false); setMemberToRemove(null); }}
            >
              &times;
            </button>
            <h2 className="text-xl font-bold mb-4 text-gray-900">Remove Member</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to remove <strong>{memberToRemove.user.fullName || memberToRemove.user.email}</strong> from this project? This action cannot be undone.
            </p>
            {removeError && <div className="text-red-600 text-sm mb-4">{removeError}</div>}
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 py-2 rounded border border-gray-300 bg-gray-100 hover:bg-gray-200 font-medium"
                onClick={() => { setShowRemoveModal(false); setMemberToRemove(null); setRemoveError(""); }}
                disabled={removeLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-medium flex items-center justify-center"
                onClick={handleRemoveMemberConfirm}
                disabled={removeLoading}
              >
                {removeLoading ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
