"use client";

import { useMembersData } from "./useMembersData";
import { ROLE_OPTIONS } from "./constants";
import { InviteMemberModal } from "./components/InviteMemberModal";
import { MembersFilters } from "./components/MembersFilters";
import { MembersHeader } from "./components/MembersHeader";
import { MembersStatsCards } from "./components/MembersStatsCards";
import { MembersTable } from "./components/MembersTable";
import { RemoveMemberModal } from "./components/RemoveMemberModal";

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
      <MembersHeader onInviteClick={() => setShowModal(true)} />

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

      <MembersStatsCards
        totalMembers={totalMembers}
        activeCount={activeCount}
        adminCount={adminCount}
        pendingCount={pendingCount}
      />

      <MembersFilters
        search={search}
        roleFilter={roleFilter}
        statusFilter={statusFilter}
        showFilters={showFilters}
        onSearchChange={setSearch}
        onToggleFilters={() => setShowFilters((current) => !current)}
        onRoleFilterChange={setRoleFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <MembersTable
        filteredMembers={filteredMembers}
        brokenProfileImages={brokenProfileImages}
        changingRoleId={changingRoleId}
        canChangeRole={canChangeRole}
        canRemoveMember={canRemoveMember}
        getAvailableOptions={getAvailableOptions}
        resolveProfilePicUrl={resolveProfilePicUrl}
        getMemberProfilePicCandidates={getMemberProfilePicCandidates}
        setBrokenProfileImages={setBrokenProfileImages}
        onRoleChange={(userId, newRole) => {
          void handleRoleChange(userId, newRole);
        }}
        onRequestRemove={(member) => {
          setMemberToRemove(member);
          setShowRemoveModal(true);
          setRemoveError("");
        }}
      />

      <InviteMemberModal
        isOpen={showModal}
        inviteEmail={inviteEmail}
        inviteRole={inviteRole}
        inviteLoading={inviteLoading}
        inviteError={inviteError}
        inviteSuccess={inviteSuccess}
        roleOptions={ROLE_OPTIONS}
        onClose={() => setShowModal(false)}
        onInviteEmailChange={setInviteEmail}
        onInviteRoleChange={setInviteRole}
        onSubmit={handleInvite}
      />

      <RemoveMemberModal
        isOpen={showRemoveModal}
        memberToRemove={memberToRemove}
        removeLoading={removeLoading}
        removeError={removeError}
        onClose={() => {
          setShowRemoveModal(false);
          setMemberToRemove(null);
          setRemoveError("");
        }}
        onConfirm={() => {
          void handleRemoveMemberConfirm();
        }}
      />
    </div>
  );
}
