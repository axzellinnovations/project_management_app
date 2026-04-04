'use client';

import Image from 'next/image';
import { useProfileData } from './useProfileData';

export default function ProfilePage() {
    const {
        username, email, fullName, setFullName,
        resolvedProfilePicUrl, imageKey,
        isLoading, isSavingName, isUploadingPhoto,
        pwStep, setPwStep, isSendingOtp,
        otp, setOtp, newPassword, setNewPassword,
        confirmPassword, setConfirmPassword, isResettingPw,
        errorMessage, successMessage,
        handleSendOtp, handleResetPassword, onSaveFullName, onUploadPhoto,
    } = useProfileData();

    if (isLoading) {
        return <p className="text-sm text-[#6A7282]">Loading profile...</p>;
    }

    return (
        <div className="mobile-page-padding max-w-3xl mx-auto pb-28 sm:pb-8">
            <h1 className="text-[28px] font-semibold text-[#101828]">User Profile</h1>
            <p className="text-sm text-[#6A7282] mt-1 mb-8">See and edit your profile details.</p>

            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-6">
                {errorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        {successMessage}
                    </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="w-20 h-20 rounded-full bg-[#EEF2F6] border border-[#D0D5DD] overflow-hidden flex items-center justify-center">
                        {resolvedProfilePicUrl ? (
                            <Image
                                key={imageKey}
                                src={resolvedProfilePicUrl}
                                alt="Profile"
                                width={80}
                                height={80}
                                className="w-full h-full object-cover"
                                unoptimized
                            />
                        ) : (
                            <span className="text-[#475467] font-semibold text-xl">
                                {(username || email || 'U').charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="inline-flex items-center justify-center rounded-lg bg-[#175CD3] hover:bg-[#1849A9] text-white text-sm font-medium px-4 py-2 cursor-pointer transition-colors">
                            {isUploadingPhoto ? 'Uploading...' : 'Upload photo'}
                            <input
                                type="file"
                                accept="image/jpeg,image/png,image/gif,image/webp"
                                className="hidden"
                                onChange={onUploadPhoto}
                                disabled={isUploadingPhoto}
                            />
                        </label>
                        <span className="text-xs text-[#6A7282]">Accepted: JPG, PNG, GIF, WebP (max 5MB)</span>
                    </div>
                </div>

                <form className="space-y-4" onSubmit={onSaveFullName}>
                    <div>
                        <label className="block text-sm font-medium text-[#344054] mb-1.5">Username</label>
                        <input
                            type="text"
                            value={username}
                            disabled
                            className="w-full rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] text-[#667085] px-4 py-2.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#344054] mb-1.5">Email</label>
                        <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] text-[#667085] px-4 py-2.5"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-[#344054] mb-1.5">Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            placeholder="Enter your full name"
                            className="w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>

                    <div className="pt-1">
                        <button
                            type="submit"
                            disabled={isSavingName}
                            className={`rounded-lg px-5 py-2.5 text-white text-sm font-medium transition-colors ${
                                isSavingName ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {isSavingName ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Change Password ── */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4 mt-6">
                <div>
                    <h2 className="text-[16px] font-semibold text-[#101828]">Change Password</h2>
                    <p className="text-sm text-[#6A7282] mt-0.5">A reset code will be sent to your email address.</p>
                </div>

                {pwStep === 'idle' && (
                    <button
                        onClick={() => void handleSendOtp()}
                        disabled={isSendingOtp}
                        className={`rounded-lg px-5 py-2.5 text-white text-sm font-medium transition-colors ${
                            isSendingOtp ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isSendingOtp ? 'Sending...' : 'Send Reset Code'}
                    </button>
                )}

                {pwStep === 'sent' && (
                    <form className="space-y-4" onSubmit={(e) => void handleResetPassword(e)}>
                        <div>
                            <label className="block text-sm font-medium text-[#344054] mb-1.5">Reset Code</label>
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter the code from your email"
                                className="w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#344054] mb-1.5">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className="w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#344054] mb-1.5">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                className="w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                disabled={isResettingPw}
                                className={`rounded-lg px-5 py-2.5 text-white text-sm font-medium transition-colors ${
                                    isResettingPw ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isResettingPw ? 'Resetting...' : 'Reset Password'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setPwStep('idle'); setOtp(''); setNewPassword(''); setConfirmPassword(''); }}
                                className="rounded-lg px-5 py-2.5 text-[#374151] text-sm font-medium border border-[#D0D5DD] hover:bg-[#F9FAFB] transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                {pwStep === 'done' && (
                    <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                        Password changed successfully.
                        <button onClick={() => setPwStep('idle')} className="ml-auto text-green-600 hover:underline text-xs">Reset again</button>
                    </div>
                )}
            </div>
        </div>
    );
}
