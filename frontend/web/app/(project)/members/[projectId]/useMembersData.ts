import { useEffect, useState, useMemo, useCallback } from "react";
import { useMembersSync, type MemberPayload } from "./useMembersSync";
import * as membersApi from "@/services/members-service";
import axios from "@/lib/axios";
import { getUserFromToken } from "@/lib/auth";

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

interface AuthUserSummary {
  userId?: number;
  username?: string;
  fullName?: string;
  email?: string;
  profilePicUrl?: string | null;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export function timeAgo(dateString?: string) {
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

export function useMembersData(projectId: string) {
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

    async function fetchData() {
      setLoading(true);
      try {
        const [membersRes, pendingRes, usersRes] = await Promise.allSettled([
          membersApi.fetchMembers(projectId).then(data => ({ data: data as unknown as Member[] })),
          membersApi.fetchPendingInvites(projectId).then(data => ({ data: data as unknown as PendingInvite[] })),
          axios.get("/api/auth/users"),
        ]);

        if (cancelled) return;

        if (membersRes.status === "fulfilled") {
          setMembers(Array.isArray(membersRes.value.data) ? membersRes.value.data : []);
        } else {
          console.error("Failed to fetch members:", membersRes.reason);
          setMembers([]);
        }

        if (pendingRes.status === "fulfilled") {
          setPending(Array.isArray(pendingRes.value.data) ? pendingRes.value.data : []);
          if (Array.isArray(pendingRes.value.data)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            console.log('Pending invites:', pendingRes.value.data.map((p: any) => ({ email: p.email, role: p.role })));
          }
        } else {
          console.error("Failed to fetch pending invites:", pendingRes.reason);
          setPending([]);
        }

        const pics: Record<string, string | null> = {};
        if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data)) {
          usersRes.value.data.forEach((u: AuthUserSummary) => {
            const pic = u.profilePicUrl ?? null;
            if (typeof u.userId === "number") {
              pics[`id:${u.userId}`] = pic;
            }
            if (u.email) {
              pics[`email:${u.email.toLowerCase()}`] = pic;
            }
            if (u.username) {
              pics[`username:${u.username.toLowerCase()}`] = pic;
            }
            if (u.fullName) {
              pics[`fullname:${u.fullName.toLowerCase()}`] = pic;
            }
          });
        } else if (usersRes.status === "rejected") {
          console.warn("Profile picture lookup unavailable:", usersRes.reason);
        }

        setUserProfilePics(pics);
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
  }, [projectId]);

  // Real-time sync via STOMP
  const handleRoleChangedLive = useCallback((userId: number, newRole: string) => {
    setMembers(prev => prev.map(m => m.user.userId === userId ? { ...m, role: newRole } : m));
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
  }, []);

  useMembersSync(projectId, {
    onRoleChanged: handleRoleChangedLive,
    onMemberRemoved: handleMemberRemovedLive,
    onMemberJoined: handleMemberJoinedLive,
  });

  const allMembers = useMemo<MemberCombined[]>(() => [
    ...members,
    ...pending.map((p: PendingInvite) => {
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
    if (!currentUserRole) return false;
    const currentRole = String(currentUserRole).toUpperCase().trim();
    const targetRole = String(targetMember.role).toUpperCase().trim();
    if (targetMember.status === "Pending") return false;
    if (currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail) return false;
    if (currentRole === "OWNER") return true;
    if (currentRole === "ADMIN") return targetRole === "MEMBER" || targetRole === "VIEWER";
    return false;
  }, [currentUserRole, currentUserEmail]);

  const canRemoveMember = useCallback((targetMember: MemberCombined) => {
    if (!currentUserRole) return false;
    const currentRole = String(currentUserRole).toUpperCase().trim();
    const targetRole = String(targetMember.role).toUpperCase().trim();
    if (targetMember.status === "Pending") return false;
    if (currentUserEmail && targetMember.user.email?.toLowerCase() === currentUserEmail) return false;
    if (currentRole === "OWNER") return true;
    if (currentRole === "ADMIN") return targetRole === "MEMBER" || targetRole === "VIEWER";
    return false;
  }, [currentUserRole, currentUserEmail]);

  const getAvailableOptions = useCallback(() => {
    if (currentUserRole?.toUpperCase() === "ADMIN") return ["MEMBER", "VIEWER"];
    return ["OWNER", "ADMIN", "MEMBER", "VIEWER"];
  }, [currentUserRole]);

  const resolveProfilePicUrl = useCallback((profilePicUrl?: string) => {
    if (!profilePicUrl) return "";
    if (
      profilePicUrl.startsWith("http://") ||
      profilePicUrl.startsWith("https://") ||
      profilePicUrl.startsWith("data:") ||
      profilePicUrl.startsWith("blob:")
    ) {
      return profilePicUrl;
    }
    return `${API_BASE_URL}${profilePicUrl.startsWith("/") ? "" : "/"}${profilePicUrl}`;
  }, []);

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
