"use client";
import { useEffect, useState } from "react";
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

export default function MembersPage({ teamId }: { teamId: number }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);

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
      <button className="mt-8 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Invite Member</button>
    </div>
  );
}
