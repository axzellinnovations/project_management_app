"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import axios from "@/lib/axios";
import { useParams } from "next/navigation";
import { getUserFromToken } from "@/lib/auth";
import { UserPlus, Search, ChevronDown, ChevronRight, Mail, Clock, CheckSquare, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import BottomSheet from "@/components/shared/BottomSheet";
import EmptyState from "@/components/shared/EmptyState";

function getInitials(name: string, email: string) {
  if (name) return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  return email[0]?.toUpperCase() || "?";
}


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

interface AuthUserSummary {
  userId?: number;
  username?: string;
  fullName?: string;
  email?: string;
  profilePicUrl?: string | null;
}

const ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];


export default function MembersPage() {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

  // Track which member images failed to load
  const [imgError, setImgError] = useState<Record<string, boolean>>({});

  const resolveProfilePicUrl = (profilePicUrl?: string) => {
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
  };

  const params = useParams();
  const projectId = Number((params as { projectId?: string, id?: string }).projectId ?? (params as { projectId?: string, id?: string }).id ?? "0");
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [userProfilePics, setUserProfilePics] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [roleChangeLoading, setRoleChangeLoading] = useState<number | null>(null);
  const [roleChangeError, setRoleChangeError] = useState<string>("");

  // Get current user info
  const currentUser = getUserFromToken();
  // Robustly determine current member and role
  let currentMember: Member | undefined = undefined;
  let currentUserRole: string | undefined = undefined;
  if (currentUser) {
    // Try userId match
    if (currentUser.userId) {
      currentMember = members.find(m => m.user.userId === currentUser.userId);
    }
    // Fallback to email match
    if (!currentMember && currentUser.email) {
      currentMember = members.find(m => m.user.email?.toLowerCase() === currentUser.email.toLowerCase());
    }
    // If still not found, but there is only one OWNER or ADMIN and email matches, assume that's the user
    if (!currentMember && currentUser.email) {
      const privileged = members.filter(m => m.role === 'OWNER' || m.role === 'ADMIN');
      if (privileged.length === 1 && privileged[0].user.email?.toLowerCase() === currentUser.email.toLowerCase()) {
        currentMember = privileged[0];
      }
    }
    // If still not found, but JWT email matches any OWNER/ADMIN email, allow dropdown for all users
    if (!currentMember && currentUser.email) {
      const privileged = members.find(m => (m.role === 'OWNER' || m.role === 'ADMIN') && m.user.email?.toLowerCase() === currentUser.email.toLowerCase());
      if (privileged) {
        currentMember = privileged;
      }
    }
    currentUserRole = currentMember?.role;
  }



  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      try {
        const [membersRes, pendingRes, usersRes] = await Promise.allSettled([
          axios.get(`/api/projects/${projectId}/members`),
          axios.get(`/api/projects/${projectId}/pending-invites`),
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
          // /api/auth/users may be forbidden for some roles; keep page usable.
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

  const getMemberProfilePicCandidates = (member: Member) => {
    const candidates: string[] = [];
    const add = (value?: string | null) => {
      if (value && !candidates.includes(value)) {
        candidates.push(value);
      }
    };

    if (typeof member.user.userId === "number") {
      add(userProfilePics[`id:${member.user.userId}`]);
    }
    if (member.user.email) {
      add(userProfilePics[`email:${member.user.email.toLowerCase()}`]);
    }
    if (member.user.username) {
      add(userProfilePics[`username:${member.user.username.toLowerCase()}`]);
    }
    if (member.user.fullName) {
      add(userProfilePics[`fullname:${member.user.fullName.toLowerCase()}`]);
    }

    add(member.user.profilePicUrl);
    return candidates;
  };
  // Permission logic for showing role dropdown
  function canChangeRole(target: Member): boolean {
    // If current user is detected as OWNER or ADMIN by email or userId, allow dropdown for all except self
    if (!currentUser) return false;
    // Don't allow changing own role
    if (currentUser.userId && target.user.userId === currentUser.userId) return false;
    if (!currentUser.userId && currentUser.email && target.user.email?.toLowerCase() === currentUser.email.toLowerCase()) return false;
    // If current user is OWNER or ADMIN by email or userId, allow dropdown for all others
    const isPrivileged = members.some(m => (m.role === 'OWNER' || m.role === 'ADMIN') && (
      (currentUser.userId && m.user.userId === currentUser.userId) ||
      (currentUser.email && m.user.email?.toLowerCase() === currentUser.email.toLowerCase())
    ));
    return isPrivileged;
  }

  // Allowed roles to set for a target, based on current user's role
  function allowedRoleOptions(target: Member): string[] {
    if (currentUserRole === "OWNER") {
      return ROLE_OPTIONS.filter(r => r !== "OWNER" || target.role === "OWNER"); // Owner can't demote self
    }
    if (currentUserRole === "ADMIN") {
      return ["MEMBER", "VIEWER"];
    }
    return [];
  }

  async function handleRoleChange(target: Member, newRole: string) {
    setRoleChangeLoading(target.id);
    setRoleChangeError("");
    try {
      await axios.patch(`/api/projects/${projectId}/members/${target.user.userId}/role`, {
        role: newRole,
        userId: target.user.userId,
      });
      // Refresh members
      const membersRes = await axios.get(`/api/projects/${projectId}/members`);
      setMembers(membersRes.data);
    } catch (err) {
      const error = err as {response?: {data?: {message?: string}}};
      setRoleChangeError(error?.response?.data?.message || "Failed to change role");
      console.log('MembersPage loaded');
      console.log('Rendering MembersPage');
    } finally {
      setRoleChangeLoading(null);
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    // Check if email is already a member or pending
    const emailLower = inviteEmail.trim().toLowerCase();
    const alreadyMember = members.some(m => m.user.email?.toLowerCase() === emailLower);
    const alreadyPending = pending.some(p => p.email?.toLowerCase() === emailLower);
    if (alreadyMember) {
      setInviteError("This user is already a member of the project.");
      setInviteLoading(false);
      return;
    }
    if (alreadyPending) {
      setInviteError("An invitation has already been sent to this email.");
      setInviteLoading(false);
      return;
    }
    try {
      await axios.post(`/api/projects/${projectId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteSuccess("Invitation sent!");
      setInviteEmail("");
      setInviteRole("");
      setInviteSheetOpen(false);
      // Refresh pending invites
      const pendingRes = await axios.get(`/api/projects/${projectId}/pending-invites`);
      setPending(pendingRes.data);
    } catch (err) {
      const error = err as {response?: {data?: {message?: string}}};
      setInviteError(error?.response?.data?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── local UI state ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [pendingOpen, setPendingOpen] = useState(true);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [roleSheetMember, setRoleSheetMember] = useState<Member | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const FILTERS = ["ALL", "OWNER", "ADMIN", "MEMBER", "VIEWER", "PENDING"];

  const ROLE_COLOR: Record<string, string> = {
    OWNER: "bg-amber-100 text-amber-700 border-amber-200",
    ADMIN: "bg-cu-primary/10 text-cu-primary border-cu-primary/20",
    MEMBER: "bg-blue-50 text-blue-600 border-blue-100",
    VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
    PENDING: "bg-amber-50 text-amber-600 border-amber-100",
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.user.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === "ALL" || m.role === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredPending = pending.filter(
    (p) =>
      (!searchQuery || p.email.toLowerCase().includes(searchQuery.toLowerCase())) &&
      (activeFilter === "ALL" || activeFilter === "PENDING")
  );

  // ── skeleton ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mobile-page-padding max-w-5xl mx-auto pb-[clamp(96px,12vh,128px)] sm:pb-10">
        <div className="flex items-center justify-between mb-4">
          <div className="skeleton h-7 w-48 rounded-lg" />
          <div className="skeleton h-9 w-28 rounded-xl" />
        </div>
        <div className="skeleton h-10 w-full rounded-xl mb-4" />
        <div className="skeleton h-9 w-full rounded-xl mb-5" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-gray-100">
            <div className="skeleton w-11 h-11 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-36 rounded" />
              <div className="skeleton h-3 w-48 rounded" />
            </div>
            <div className="skeleton h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mobile-page-padding max-w-5xl mx-auto pb-[clamp(96px,12vh,128px)] sm:pb-10">

      {/* ── Sticky Header ──────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#F7F8FA]/95 backdrop-blur-md pb-3 pt-2 -mx-4 sm:-mx-6 px-4 sm:px-6 mb-1">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">
            Team{" "}
            <span className="text-gray-400 font-normal text-base">
              ({members.length})
            </span>
          </h1>
          <button
            onClick={() => setInviteSheetOpen(true)}
            className="flex items-center gap-1.5 px-3.5 h-11 min-h-[44px] rounded-xl bg-cu-primary text-white text-sm font-semibold shadow-sm active:scale-95 transition-transform"
          >
            <UserPlus size={15} />
            <span>Invite</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search members…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-12 py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-cu-primary/30 shadow-[0_4px_10px_rgba(0,0,0,0.03)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 h-9 w-9 flex items-center justify-center"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => {
            const count =
              f === "ALL"
                ? members.length + pending.length
                : f === "PENDING"
                ? pending.length
                : members.filter((m) => m.role === f).length;
            return (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`flex-shrink-0 h-10 min-w-[44px] px-3.5 rounded-full text-xs font-semibold border transition-colors shadow-[0_1px_3px_rgba(0,0,0,0.04)] ${
                  activeFilter === f
                    ? "bg-cu-primary text-white border-[#155DFC]"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}{" "}
                <span className={activeFilter === f ? "opacity-75" : "text-gray-400"}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Role change error ───────────────────────────────────────────────── */}
      {roleChangeError && (
        <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {roleChangeError}
        </div>
      )}

      {/* ── Member list ─────────────────────────────────────────────────────── */}
      {filteredMembers.length === 0 && filteredPending.length === 0 && (
        <EmptyState
          icon={<UserPlus size={36} className="text-gray-400" />}
          title="No members found"
          subtitle={searchQuery ? "Try a different search term" : "Invite your first team member to get started"}
          action={
            <button
              onClick={() => setInviteSheetOpen(true)}
              className="px-4 py-2 rounded-xl bg-cu-primary text-white text-sm font-semibold"
            >
              Invite Member
            </button>
          }
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <AnimatePresence initial={false}>
          {filteredMembers.map((m) => {
            const avatarKey = `${m.id}-${m.user.email}`;
            const resolvedCandidates = getMemberProfilePicCandidates(m)
              .map((url) => resolveProfilePicUrl(url))
              .filter(Boolean);
            const resolvedProfilePicUrl =
              resolvedCandidates.find((url) => !imgError[`${avatarKey}:${url}`]) || "";

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="rounded-2xl border border-gray-100 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.04)] p-3 sm:p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    {resolvedProfilePicUrl ? (
                      <Image
                        src={resolvedProfilePicUrl}
                        alt={m.user.fullName || m.user.email}
                        width={48}
                        height={48}
                        unoptimized
                        className="w-12 h-12 rounded-2xl object-cover"
                        onError={() =>
                          setImgError((errs) => ({
                            ...errs,
                            [`${avatarKey}:${resolvedProfilePicUrl}`]: true,
                          }))
                        }
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cu-primary to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(m.user.fullName, m.user.email)}
                      </div>
                    )}
                    <span
                      className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                        m.status === "Active" ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                          {m.user.fullName || m.user.username || m.user.email}
                        </div>
                        <div className="text-xs text-gray-500 truncate">{m.user.email}</div>
                      </div>
                      {canChangeRole(m) ? (
                        <button
                          onClick={() => setRoleSheetMember(m)}
                          disabled={roleChangeLoading === m.id}
                          className={`h-9 min-h-[36px] px-3 rounded-full text-xs font-semibold border whitespace-nowrap flex items-center gap-1 ${ROLE_COLOR[m.role] || ROLE_COLOR.VIEWER}`}
                        >
                          {roleChangeLoading === m.id ? (
                            <span className="animate-pulse">…</span>
                          ) : (
                            <>
                              {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                              <ChevronDown size={11} />
                            </>
                          )}
                        </button>
                      ) : (
                        <span
                          className={`h-9 min-h-[36px] px-3 inline-flex items-center rounded-full text-xs font-semibold border whitespace-nowrap ${ROLE_COLOR[m.role] || ROLE_COLOR.VIEWER}`}
                        >
                          {m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full min-h-[28px]">
                        <CheckSquare size={11} className="text-gray-400" />
                        {m.taskCount} tasks
                      </span>
                      {m.lastActive && (
                        <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-full min-h-[28px]">
                          <Clock size={11} className="text-gray-400" />
                          {new Date(m.lastActive).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* ── Pending Invites Section ─────────────────────────────────────────── */}
      {filteredPending.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setPendingOpen((v) => !v)}
            className="sticky-section-header w-full flex items-center gap-2 py-2 -mx-4 px-4 text-sm font-semibold text-gray-700"
          >
            {pendingOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            Pending Invites
            <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
              {filteredPending.length}
            </span>
          </button>

          <AnimatePresence>
            {pendingOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden divide-y divide-gray-100"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 px-0 pb-2 pt-1">
                  {filteredPending.map((p) => (
                    <div
                      key={"pending-" + p.id}
                      className="rounded-2xl border border-gray-100 bg-white shadow-[0_6px_18px_rgba(0,0,0,0.04)] p-3 sm:p-4 flex items-start gap-3"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-sm flex-shrink-0">
                        {p.email[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-sm font-semibold text-gray-800 truncate">{p.email}</div>
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Mail size={10} />
                          Invited {new Date(p.invitedAt).toLocaleDateString()}
                        </div>
                        <span className={`inline-flex w-fit px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLOR.PENDING}`}>
                          Pending
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── FAB (mobile only) ────────────────────────────────────────────────── */}
      <button
        onClick={() => setInviteSheetOpen(true)}
        className="fab md:hidden"
        aria-label="Invite member"
      >
        <UserPlus size={22} />
      </button>

      {/* ── Role Change BottomSheet ─────────────────────────────────────────── */}
      <BottomSheet
        isOpen={!!roleSheetMember}
        onClose={() => setRoleSheetMember(null)}
        title={`Change role for ${roleSheetMember?.user.fullName || roleSheetMember?.user.email || ""}`}
        snapPoint="auto"
      >
        {roleSheetMember && (
          <div className="px-4 pb-6 pt-2 space-y-2">
            {allowedRoleOptions(roleSheetMember).map((role) => (
              <button
                key={role}
                onClick={async () => {
                  await handleRoleChange(roleSheetMember, role);
                  setRoleSheetMember(null);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                  roleSheetMember.role === role
                    ? "border-cu-primary bg-blue-50 text-cu-primary"
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                }`}
              >
                {role.charAt(0) + role.slice(1).toLowerCase()}
                {roleSheetMember.role === role && (
                  <span className="text-cu-primary text-lg">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* ── Invite BottomSheet / Modal ─────────────────────────────────────── */}
      {/* Mobile: BottomSheet */}
      <BottomSheet
        isOpen={inviteSheetOpen}
        onClose={() => {
          setInviteSheetOpen(false);
          setInviteError("");
          setInviteSuccess("");
        }}
        title="Invite Team Member"
        snapPoint="auto"
      >
        <InviteForm
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          inviteLoading={inviteLoading}
          inviteError={inviteError}
          inviteSuccess={inviteSuccess}
          onSubmit={handleInvite}
          onCancel={() => {
            setInviteSheetOpen(false);
            setInviteError("");
            setInviteSuccess("");
          }}
        />
      </BottomSheet>

      {/* Desktop: modal (shown when inviteSheetOpen but on ≥md screen) */}
      <AnimatePresence>
        {inviteSheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden md:flex fixed inset-0 items-center justify-center bg-black/40 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setInviteSheetOpen(false);
                setInviteError("");
                setInviteSuccess("");
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-gray-900">Invite Team Member</h2>
                <button
                  onClick={() => {
                    setInviteSheetOpen(false);
                    setInviteError("");
                    setInviteSuccess("");
                  }}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X size={18} />
                </button>
              </div>
              <InviteForm
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                inviteRole={inviteRole}
                setInviteRole={setInviteRole}
                inviteLoading={inviteLoading}
                inviteError={inviteError}
                inviteSuccess={inviteSuccess}
                onSubmit={handleInvite}
                onCancel={() => {
                  setInviteSheetOpen(false);
                  setInviteError("");
                  setInviteSuccess("");
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Invite form (shared between mobile sheet + desktop modal) ──────────────────
interface InviteFormProps {
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: string;
  setInviteRole: (v: string) => void;
  inviteLoading: boolean;
  inviteError: string;
  inviteSuccess: string;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

function InviteForm({
  inviteEmail, setInviteEmail,
  inviteRole, setInviteRole,
  inviteLoading, inviteError, inviteSuccess,
  onSubmit, onCancel,
}: InviteFormProps) {
  return (
    <form onSubmit={onSubmit} className="px-4 pb-6 pt-2 flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Address <span className="text-red-500">*</span>
        </label>
        <input
          type="email"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/30"
          placeholder="colleague@company.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Role <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cu-primary/30 bg-white"
          value={inviteRole}
          onChange={(e) => setInviteRole(e.target.value)}
          required
        >
          <option value="">Select a role</option>
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0) + role.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      {inviteError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          {inviteError}
        </div>
      )}
      {inviteSuccess && (
        <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-600">
          {inviteSuccess}
        </div>
      )}

      <div className="flex gap-2 mt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={inviteLoading}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={inviteLoading}
          className="flex-1 py-2.5 rounded-xl bg-[#155DFC] text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-blue-700 transition-colors"
        >
          {inviteLoading ? (
            <span className="animate-pulse">Sending…</span>
          ) : (
            <>
              <Mail size={15} />
              Send Invite
            </>
          )}
        </button>
      </div>
    </form>
  );
}
