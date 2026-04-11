import type { MemberCombined } from '../types';

interface RemoveMemberModalProps {
  isOpen: boolean;
  memberToRemove: MemberCombined | null;
  removeLoading: boolean;
  removeError: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveMemberModal({
  isOpen,
  memberToRemove,
  removeLoading,
  removeError,
  onClose,
  onConfirm,
}: RemoveMemberModalProps) {
  if (!isOpen || !memberToRemove) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-30 z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
          onClick={onClose}
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
            onClick={onClose}
            disabled={removeLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex-1 py-2 rounded bg-red-600 text-white hover:bg-red-700 font-medium flex items-center justify-center"
            onClick={onConfirm}
            disabled={removeLoading}
          >
            {removeLoading ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}
