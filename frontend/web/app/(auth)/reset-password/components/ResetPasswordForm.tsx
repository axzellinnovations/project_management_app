'use client';

import PasswordInput from './PasswordInput';

interface ResetPasswordFormProps {
  newPassword: string;
  confirmPassword: string;
  error: string;
  isLoading: boolean;
  onPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export default function ResetPasswordForm({
  newPassword,
  confirmPassword,
  error,
  isLoading,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit
}: ResetPasswordFormProps) {
  return (
    <form className='space-y-5' onSubmit={onSubmit}>
      {/* Error Message */}
      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Password Requirements */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs font-semibold text-blue-900 mb-2">Password Requirements:</p>
        <ul className="text-xs text-blue-800 space-y-1">
          <li className="flex items-center">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mr-2"></span>
            At least 8 characters
          </li>
        </ul>
      </div>

      {/* New Password */}
      <PasswordInput
        label="New Password"
        value={newPassword}
        onChange={onPasswordChange}
        placeholder="Enter new password"
        disabled={isLoading}
      />

      {/* Confirm Password */}
      <PasswordInput
        label="Confirm Password"
        value={confirmPassword}
        onChange={onConfirmPasswordChange}
        placeholder="Confirm your password"
        disabled={isLoading}
      />

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        className='w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors'
      >
        {isLoading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}
