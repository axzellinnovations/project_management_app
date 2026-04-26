import { useEffect, useState, useMemo, useCallback } from "react";
import { useMembersSync, type MemberPayload } from "./useMembersSync";
import * as membersApi from "@/services/members-service";
import { getUserFromToken } from "@/lib/auth";
import { getOrFetchUserMap, upsertUserMapEntry } from "@/app/taskcard/sidebar/userMapCache";
import { buildSessionCacheKey, getSessionCache, setSessionCache } from '@/lib/session-cache';
import type { Member, MemberCombined, MembersCachePayload, PendingInvite } from "./types";
import {
  buildCombinedMembers,
  canManageMember,
  resolveProfilePicUrl as resolveProfilePicUrlValue,
  timeAgo,
} from "./utils";

export { timeAgo };

export function useMembersData(projectId: string) {
  const membersCacheKey = buildSessionCacheKey('members', [projectId]);
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [brokenProfileImages, setBrokenProfileImages] = useState<Record<string, boolean>>({});
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Invite modal state
  const [showModal, setShowModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Role change state
  const [roleChangeError, setRoleChangeError] = useState("");
  const [roleChangeSuccess, setRoleChangeSuccess] = useState("");
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null);

  // Remove modal state
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MemberCombined | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState("");
  const [removeSuccess, setRemoveSuccess] = useState("");

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const user = getUserFromToken();
    if (user?.email) {
      setCurrentUserEmail(user.email.toLowerCase());
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hasHydratedFromCache = false;
    let cachedMembers: Member[] = [];
    let cachedPending: PendingInvite[] = [];

    if (membersCacheKey) {
      const cached = getSessionCache<MembersCachePayload>(membersCacheKey, { allowStale: true });
      if (cached.data) {
        if (Array.isArray(cached.data.members)) {
          cachedMembers = cached.data.members;
          setMembers(cached.data.members);
          hasHydratedFromCache = true;
        }
        if (Array.isArray(cached.data.pending)) {
          cachedPending = cached.data.pending;
          setPending(cached.data.pending);
          hasHydratedFromCache = true;
        }
        if (hasHydratedFromCache) {
          setLoading(false);
        }
      }
    }

    async function fetchData() {
      if (!hasHydratedFromCache) {
        setLoading(true);
      }

      try {
        const [membersRes, pendingRes, usersMapRes] = await Promise.allSettled([
          membersApi.fetchMembers(projectId).then(data => ({ data: data as unknown as Member[] })),
          membersApi.fetchPendingInvites(projectId).then(data => ({ data: data as unknown as PendingInvite[] })),
          getOrFetchUserMap(),
        ]);

        if (cancelled) return;

        let nextMembers = cachedMembers;
        let nextPending = cachedPending;

        if (membersRes.status === "fulfilled") {
          nextMembers = Array.isArray(membersRes.value.data) ? membersRes.value.data : [];
          setMembers(nextMembers);
        } else {
          console.error("Failed to fetch members:", membersRes.reason);
        }

        if (pendingRes.status === "fulfilled") {
          nextPending = Array.isArray(pendingRes.value.data) ? pendingRes.value.data : [];
          setPending(nextPending);
        } else {
          console.error("Failed to fetch pending invites:", pendingRes.reason);
        }

        if (usersMapRes.status === "fulfilled") {
          setUserProfilePics(usersMapRes.value);
        } else {
          console.warn("Profile picture lookup unavailable:", usersMapRes.reason);
        }

        if (membersCacheKey) {
          const payload: MembersCachePayload = {
            members: nextMembers,
            pending: nextPending,
            timestamp: Date.now(),
          };
          setSessionCache(membersCacheKey, payload, 120_000);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (projectId) {
      void fetchData();
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [projectId, membersCacheKey]);

  useEffect(() => {
    if (!projectId || loading || !membersCacheKey) return;

    const payload: MembersCachePayload = {
      members,
      pending,
      timestamp: Date.now(),
    };
    setSessionCache(membersCacheKey, payload, 120_000);
  }, [projectId, members, pending, loading, membersCacheKey]);

  // Real-time sync via STOMP
  const handleRoleChangedLive = useCallback((userId: number, newRole: string) => {
    setMembers(prev => {
      let changed = false;
      const next = prev.map(member => {
        if (member.user.userId !== userId || member.role === newRole) {
          return member;
        }
        changed = true;
        return { ...member, role: newRole };
      });
      return changed ? next : prev;
    });
  }, []);

  const handleMemberRemovedLive = useCallback((userId: number) => {
    setMembers(prev => prev.filter(m => m.user.userId !== userId));
  }, []);

  const handleMemberJoinedLive = useCallback((payload: MemberPayload) => {
    setMembers(prev => {
      if (prev.some(m => m.user.userId === payload.userId)) return prev;
      return [
        ...prev,
        {
          id: payload.userId,
          role: payload.role,
          user: {
            userId: payload.userId,
            username: payload.username,
            fullName: payload.fullName,
            email: payload.email,
            profilePicUrl: payload.profilePicUrl,
          },
          taskCount: payload.taskCount,
          status: payload.status,
        },
      ];
    });

    upsertUserMapEntry({
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
      fullName: payload.fullName,
      profilePicUrl: payload.profilePicUrl,
    });
    setUserProfilePics(prev => ({
      ...prev,
      ...(typeof payload.userId === "number" ? { [`id:${payload.userId}`]: payload.profilePicUrl || null } : {}),
      ...(payload.email ? { [`email:${payload.email.toLowerCase()}`]: payload.profilePicUrl || null } : {}),
      ...(payload.username ? { [`username:${payload.username.toLowerCase()}`]: payload.profilePicUrl || null } : {}),
      ...(payload.fullName ? { [`fullname:${payload.fullName.toLowerCase()}`]: payload.profilePicUrl || null } : {}),
    }));

    if (payload.email) {
      setPending(prev => prev.filter(p => p.email.toLowerCase() !== payload.email.toLowerCase()));
    }
  }, []);

  useMembersSync(projectId, {
    onRoleChanged: handleRoleChangedLive,
    onMemberRemoved: handleMemberRemovedLive,
    onMemberJoined: handleMemberJoinedLive,
  });

  const allMembers = useMemo<MemberCombined[]>(
    () => buildCombinedMembers(members, pending),
    [members, pending],
  );

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

  const totalMembers = allMembers.length;
  const activeCount = allMembers.filter((m) => m.status === "Active").length;
  const adminCount = allMembers.filter((m) => m.role === "ADMIN").length;
  const pendingCount = allMembers.filter((m) => m.status === "Pending").length;

  const currentUserRole = useMemo(() => {
    let found = null;
    const tokenUser = getUserFromToken() as { userId?: number; email?: string } | null;
    if (tokenUser?.userId) {
      found = members.find(m => String(m.user.userId) === String(tokenUser.userId));
    }
    if (!found && currentUserEmail) {
      found = members.find(m => m.user.email?.toLowerCase() === currentUserEmail);
    }
    return found?.role || null;
  }, [members, currentUserEmail]);

  const canChangeRole = useCallback((targetMember: MemberCombined) => {
    return canManageMember(currentUserRole, currentUserEmail, targetMember);
  }, [currentUserRole, currentUserEmail]);

  const canRemoveMember = useCallback((targetMember: MemberCombined) => {
    return canManageMember(currentUserRole, currentUserEmail, targetMember);
  }, [currentUserRole, currentUserEmail]);

  const getAvailableOptions = useCallback(() => {
    if (currentUserRole?.toUpperCase() === "ADMIN") return ["MEMBER", "VIEWER"];
    return ["ADMIN", "MEMBER", "VIEWER"];
  }, [currentUserRole]);

  const resolveProfilePicUrl = useCallback(
    (profilePicUrl?: string) => resolveProfilePicUrlValue(profilePicUrl),
    [],
  );

  const getMemberProfilePicCandidates = useCallback((member: Member) => {
    const candidates: string[] = [];
    const add = (value?: string | null) => {
      if (value && !candidates.includes(value)) candidates.push(value);
    };
    if (typeof member.user.userId === "number") add(userProfilePics[`id:${member.user.userId}`]);
    if (member.user.email) add(userProfilePics[`email:${member.user.email.toLowerCase()}`]);
    if (member.user.username) add(userProfilePics[`username:${member.user.username.toLowerCase()}`]);
    if (member.user.fullName) add(userProfilePics[`fullname:${member.user.fullName.toLowerCase()}`]);
    add(member.user.profilePicUrl);
    return candidates;
  }, [userProfilePics]);

  const handleRoleChange = async (userId: number, newRole: string) => {
    setRoleChangeError("");
    setRoleChangeSuccess("");
    setChangingRoleId(userId);
    try {
      await membersApi.changeRole(projectId, userId, newRole);
      setMembers(prev => prev.map(m => m.user.userId === userId ? { ...m, role: newRole } : m));
      setRoleChangeSuccess("Role updated successfully!");
      setTimeout(() => setRoleChangeSuccess(""), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string } } };
      setRoleChangeError(error?.response?.data?.message || error?.response?.data?.error || "Failed to update role");
      setTimeout(() => setRoleChangeError(""), 4000);
    } finally {
      setChangingRoleId(null);
    }
  };

  const handleRemoveMemberConfirm = async () => {
    if (!memberToRemove || !memberToRemove.user.userId) return;
    setRemoveLoading(true);
    setRemoveError("");
    try {
      await membersApi.removeMember(projectId, memberToRemove.user.userId);
      setMembers(prev => prev.filter(m => m.user.userId !== memberToRemove.user.userId));
      setRemoveSuccess("Member removed successfully!");
      setShowRemoveModal(false);
      setMemberToRemove(null);
      setTimeout(() => setRemoveSuccess(""), 3000);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string; error?: string } } };
      setRemoveError(error?.response?.data?.message || error?.response?.data?.error || "Failed to remove member");
    } finally {
      setRemoveLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      await membersApi.sendInvite(projectId, inviteEmail, inviteRole.toUpperCase());
      setInviteSuccess("Invitation sent!");
      setInviteEmail("");
      setInviteRole("");
      setShowModal(false);
      const pendingData = await membersApi.fetchPendingInvites(projectId);
      setPending(pendingData as unknown as PendingInvite[]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setInviteError(err?.response?.data?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  return {
    loading,
    filteredMembers,
    allMembers,
    totalMembers,
    activeCount,
    adminCount,
    pendingCount,
    search, setSearch,
    roleFilter, setRoleFilter,
    statusFilter, setStatusFilter,
    showFilters, setShowFilters,
    showModal, setShowModal,
    inviteEmail, setInviteEmail,
    inviteRole, setInviteRole,
    inviteLoading,
    inviteError,
    inviteSuccess,
    roleChangeError,
    roleChangeSuccess,
    changingRoleId,
    showRemoveModal, setShowRemoveModal,
    memberToRemove, setMemberToRemove,
    removeLoading,
    removeError, setRemoveError,
    removeSuccess,
    brokenProfileImages, setBrokenProfileImages,
    currentUserRole,
    canChangeRole,
    canRemoveMember,
    getAvailableOptions,
    resolveProfilePicUrl,
    getMemberProfilePicCandidates,
    handleRoleChange,
    handleRemoveMemberConfirm,
    handleInvite,
  };
}
