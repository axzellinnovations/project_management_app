import type { FormEvent } from 'react';

interface InviteMemberModalProps {
  isOpen: boolean;
  inviteEmail: string;
  inviteRole: string;
  inviteLoading: boolean;
  inviteError: string;
  inviteSuccess: string;
  roleOptions: string[];
  onClose: () => void;
  onInviteEmailChange: (value: string) => void;
  onInviteRoleChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}

export function InviteMemberModal({
  isOpen,
  inviteEmail,
  inviteRole,
  inviteLoading,
  inviteError,
  inviteSuccess,
  roleOptions,
  onClose,
  onInviteEmailChange,
  onInviteRoleChange,
  onSubmit,
}: InviteMemberModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50 p-4 sm:p-0">
      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8 w-full max-w-sm sm:max-w-md max-h-[90vh] overflow-y-auto relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
        >
          &times;
        </button>
        <h2 className="text-xl font-bold mb-4">Invite Team Member</h2>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">Email Address <span className="text-red-500">*</span></label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2.5 min-h-[44px] text-sm"
              value={inviteEmail}
              onChange={(e) => onInviteEmailChange(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1">Role <span className="text-red-500">*</span></label>
            <select
              className="w-full border rounded px-3 py-2.5 min-h-[44px] text-sm"
              value={inviteRole}
              onChange={(e) => onInviteRoleChange(e.target.value)}
              required
            >
              <option value="">Select a role</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
          {inviteSuccess && <div className="text-green-600 text-sm">{inviteSuccess}</div>}
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button
              type="button"
              className="flex-1 py-2.5 min-h-[44px] rounded border border-gray-300 bg-gray-100 hover:bg-gray-200"
              onClick={onClose}
              disabled={inviteLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 min-h-[44px] rounded bg-cu-primary text-white hover:bg-cu-primary-dark flex items-center justify-center"
              disabled={inviteLoading}
            >
              {inviteLoading ? 'Sending...' : (<><span className="mr-2">✉️</span>Send Invite</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
