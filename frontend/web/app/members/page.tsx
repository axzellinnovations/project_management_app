"use client";
import { useEffect, useState } from "react";
import axios from "@/lib/axios";
import { useParams } from "next/navigation";

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

const ROLE_OPTIONS = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export default function MembersPage() {
  const params = useParams();
  const teamId = Number(params.projectId);
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
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
        axios.get(`/api/teams/${teamId}/members`),
        axios.get(`/api/teams/${teamId}/pending-invites`),
      ]);
      setMembers(membersRes.data);
      setPending(pendingRes.data);
      setLoading(false);
    }
    fetchData();
  }, [teamId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      // You may need to get projectId from context/route; here we assume teamId == projectId for demo
      await axios.post(`/api/projects/${teamId}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteSuccess("Invitation sent!");
      setInviteEmail("");
      setInviteRole("");
      setShowModal(false);
      // Refresh pending invites
      const pendingRes = await axios.get(`/api/teams/${teamId}/pending-invites`);
      setPending(pendingRes.data);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setInviteError(err?.response?.data?.message || "Failed to send invite");
    } finally {
      setInviteLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Team Members</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {members.map((m) => (
          <div key={m.id} className="bg-white rounded-lg shadow p-4 flex flex-col gap-2 border">
            <div className="flex items-center gap-4">
              {m.user.profilePicUrl ? (
                <img src={m.user.profilePicUrl} alt={m.user.fullName} className="w-12 h-12 rounded-full" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg">
                  {m.user.fullName ? m.user.fullName.split(" ").map(n => n[0]).join("") : m.user.email[0]}
                </div>
              )}
              <div>
                <div className="font-semibold">{m.user.fullName || m.user.email}</div>
                <div className="text-xs text-gray-500">{m.user.email}</div>
                <div className="text-xs mt-1">
                  <span className={`px-2 py-1 rounded text-xs ${m.role === "ADMIN" ? "bg-purple-100 text-purple-700" : m.role === "OWNER" ? "bg-yellow-100 text-yellow-700" : m.role === "MEMBER" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>{m.role}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${m.status === "Active" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{m.status}</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-gray-400">Last Active</div>
                <div className="text-xs">{m.lastActive ? new Date(m.lastActive).toLocaleString() : "-"}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <div className="text-xs text-gray-500">Tasks:</div>
              <div className="font-semibold text-blue-700">{m.taskCount}</div>
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={"pending-" + p.id} className="bg-yellow-50 rounded-lg shadow p-4 flex flex-col gap-2 border border-yellow-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-white font-bold text-lg">
                {p.email[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">{p.email}</div>
                <div className="text-xs mt-1">
                  <span className="px-2 py-1 rounded text-xs bg-yellow-100 text-yellow-700">Pending</span>
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-xs text-gray-400">Invited</div>
                <div className="text-xs">{new Date(p.invitedAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <button
        className="mt-8 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={() => setShowModal(true)}
      >
        Invite Member
      </button>

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
