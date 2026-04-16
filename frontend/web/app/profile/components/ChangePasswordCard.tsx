'use client';

import { Dispatch, FormEvent, SetStateAction } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { inputCls, labelCls } from '../lib/profile-utils';

type PwStep = 'idle' | 'sent' | 'done';

type ChangePasswordCardProps = {
    pwStep: PwStep;
    setPwStep: Dispatch<SetStateAction<PwStep>>;
    isSendingOtp: boolean;
    isResettingPw: boolean;
    otp: string;
    setOtp: Dispatch<SetStateAction<string>>;
    newPassword: string;
    setNewPassword: Dispatch<SetStateAction<string>>;
    confirmPassword: string;
    setConfirmPassword: Dispatch<SetStateAction<string>>;
    error: string;
    success: string;
    handleSendOtp: () => Promise<void>;
    handleResetPassword: () => Promise<void>;
    showNewPw: boolean;
    setShowNewPw: Dispatch<SetStateAction<boolean>>;
    showConfirmPw: boolean;
    setShowConfirmPw: Dispatch<SetStateAction<boolean>>;
};

function handleReset(
    setPwStep: Dispatch<SetStateAction<PwStep>>,
    setOtp: Dispatch<SetStateAction<string>>,
    setNewPassword: Dispatch<SetStateAction<string>>,
    setConfirmPassword: Dispatch<SetStateAction<string>>,
) {
    setPwStep('idle');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
}

export default function ChangePasswordCard({
    pwStep, setPwStep,
    isSendingOtp, isResettingPw,
    otp, setOtp,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    error, success,
    handleSendOtp, handleResetPassword,
    showNewPw, setShowNewPw,
    showConfirmPw, setShowConfirmPw,
}: ChangePasswordCardProps) {
    const onSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void handleResetPassword();
    };

    return (
        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 sm:p-7 space-y-4 mt-6 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#EEF4FF] border border-[#DCE7FE] text-[#155DFC] flex items-center justify-center shrink-0">
                    <LockKeyhole size={16} />
                </div>
                <div>
                    <h2 className="text-[17px] font-semibold text-[#101828]">Security & Password</h2>
                    <p className="text-sm text-[#667085] mt-0.5">A reset code will be sent to your email address.</p>
                </div>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                    {error}
                </div>
            )}
            {success && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm">
                    {success}
                </div>
            )}

            {pwStep === 'idle' && (
                <button
                    onClick={() => void handleSendOtp()}
                    disabled={isSendingOtp}
                    className={`rounded-xl px-5 py-2.5 text-white text-sm font-semibold transition-colors shadow-sm ${
                        isSendingOtp ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#155DFC] hover:bg-[#0042A8]'
                    }`}
                >
                    {isSendingOtp ? 'Sending…' : 'Send Reset Code'}
                </button>
            )}

            {pwStep === 'sent' && (
                <form className="space-y-4" onSubmit={onSubmit}>
                    <div>
                        <label className={labelCls}>Reset Code</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="Enter the code from your email"
                            className={inputCls}
                        />
                    </div>
                    <div>
                        <label className={labelCls}>New Password</label>
                        <div className="relative">
                            <input
                                type={showNewPw ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                className={inputCls + ' pr-11'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPw((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                                tabIndex={-1}
                                aria-label={showNewPw ? 'Hide password' : 'Show password'}
                            >
                                {showNewPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Confirm Password</label>
                        <div className="relative">
                            <input
                                type={showConfirmPw ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repeat new password"
                                className={inputCls + ' pr-11'}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPw((v) => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151] transition-colors"
                                tabIndex={-1}
                                aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                            >
                                {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button
                            type="submit"
                            disabled={isResettingPw}
                            className={`rounded-xl px-5 py-2.5 text-white text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto ${
                                isResettingPw ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#155DFC] hover:bg-[#0042A8]'
                            }`}
                        >
                            {isResettingPw ? 'Resetting…' : 'Reset Password'}
                        </button>
                        <button
                            type="button"
                            onClick={() => handleReset(setPwStep, setOtp, setNewPassword, setConfirmPassword)}
                            className="rounded-xl px-5 py-2.5 text-[#344054] text-sm font-semibold border border-[#D0D5DD] bg-white hover:bg-[#F9FAFB] transition-colors w-full sm:w-auto"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            )}

            {pwStep === 'done' && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm shadow-sm">
                    <ShieldCheck size={16} className="shrink-0" />
                    Password changed successfully.
                    <button
                        onClick={() => setPwStep('idle')}
                        className="ml-auto text-green-700 hover:underline text-xs font-semibold"
                    >
                        Reset again
                    </button>
                </div>
            )}
        </div>
    );
}
