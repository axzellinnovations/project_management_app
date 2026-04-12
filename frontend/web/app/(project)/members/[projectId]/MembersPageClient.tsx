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

  if (loading) return <div className="mobile-page-padding max-w-[900px] mx-auto pb-6 text-sm text-gray-500">Loading...</div>;

  return (
    <div className="mobile-page-padding max-w-[900px] mx-auto pb-6">
      <div className="space-y-5 sm:space-y-6">
        <MembersHeader onInviteClick={() => setShowModal(true)} />

        {(roleChangeSuccess || roleChangeError || removeSuccess) && (
          <div className="space-y-3">
            {roleChangeSuccess && (
              <div className="p-3 text-sm sm:text-[15px] bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm">
                {roleChangeSuccess}
              </div>
            )}
            {roleChangeError && (
              <div className="p-3 text-sm sm:text-[15px] bg-red-50 text-red-700 border border-red-200 rounded-md shadow-sm">
                {roleChangeError}
              </div>
            )}
            {removeSuccess && (
              <div className="p-3 text-sm sm:text-[15px] bg-green-50 text-green-700 border border-green-200 rounded-md shadow-sm">
                {removeSuccess}
              </div>
            )}
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
      </div>

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
