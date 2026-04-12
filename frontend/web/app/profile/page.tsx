'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import { useProfile } from './hooks/useProfile';
import { useChangePassword } from './hooks/useChangePassword';
import ChangePasswordCard from './components/ChangePasswordCard';
import { BIO_MAX, formatRelativeTime, inputCls, disabledCls, labelCls } from './lib/profile-utils';

export default function ProfilePage() {
    const [showNewPw, setShowNewPw] = useState(false);
    const [showConfirmPw, setShowConfirmPw] = useState(false);

    const {
        username, email,
        fullName, setFullName,
        firstName, setFirstName,
        lastName, setLastName,
        contactNumber, setContactNumber,
        countryCode, setCountryCode,
        jobTitle, setJobTitle,
        company, setCompany,
        position, setPosition,
        bio, setBio,
        resolvedProfilePicUrl, imageKey,
        lastActive,
        isLoading, isSavingName, isUploadingPhoto,
        errorMessage, successMessage,
        onSaveProfile, onUploadPhoto,
    } = useProfile();

    const changePassword = useChangePassword({ email });

    if (isLoading) {
        return <p className="text-sm text-[#6A7282] p-8">Loading profile...</p>;
    }

    return (
        <div className="mobile-page-padding max-w-5xl mx-auto pb-28 sm:pb-8">
            <h1 className="text-[28px] font-semibold text-[#101828]">User Profile</h1>
            <p className="text-sm text-[#6A7282] mt-1 mb-8">Manage your personal details and preferences.</p>

            {/* Alerts */}
            {errorMessage && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                </div>
            )}

            <form onSubmit={(e) => void onSaveProfile(e)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-1 flex flex-col gap-6">

                        {/* Avatar card */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col items-center gap-4">
                            <div className="w-24 h-24 rounded-full bg-[#EEF2F6] border border-[#D0D5DD] overflow-hidden flex items-center justify-center">
                                {resolvedProfilePicUrl ? (
                                    <Image
                                        key={imageKey}
                                        src={resolvedProfilePicUrl}
                                        alt="Profile"
                                        width={96}
                                        height={96}
                                        className="w-full h-full object-cover"
                                        unoptimized
                                        priority
                                    />
                                ) : (
                                    <span className="text-[#475467] font-semibold text-2xl">
                                        {(username || email || 'U').charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <label className="inline-flex items-center justify-center rounded-lg bg-[#175CD3] hover:bg-[#1849A9] text-white text-sm font-medium px-4 py-2 min-h-[44px] cursor-pointer transition-colors w-full text-center">
                                {isUploadingPhoto ? 'Uploading...' : 'Upload photo'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="user"
                                    className="hidden"
                                    onChange={onUploadPhoto}
                                    disabled={isUploadingPhoto}
                                />
                            </label>
                            <span className="text-xs text-[#6A7282] text-center">JPG, PNG, GIF, WebP · max 25 MB</span>
                        </div>

                        {/* Account info card */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Account</h2>
                            <div>
                                <label className={labelCls}>Username</label>
                                <input type="text" value={username} disabled className={disabledCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input type="email" value={email} disabled className={disabledCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Last active</label>
                                <p className={disabledCls}>{formatRelativeTime(lastActive)}</p>
                            </div>
                        </div>

                        {/* Bio card */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-2">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Bio</h2>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                                placeholder="Tell your team a little about yourself…"
                                rows={5}
                                className="w-full rounded-lg border border-[#D0D5DD] bg-white text-[#101828] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                            />
                            <p className="text-xs text-[#9CA3AF] text-right">{bio.length}/{BIO_MAX}</p>
                        </div>
                    </div>

                    {/* ── Right Column ── */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* Basic Info */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Basic Info</h2>
                            <div>
                                <label className={labelCls}>Full Name</label>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Your display name"
                                    className={inputCls}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>First Name</label>
                                    <input
                                        type="text"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First name"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Last Name</label>
                                    <input
                                        type="text"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last name"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Contact</h2>
                            <div>
                                <label className={labelCls}>Phone Number</label>
                                <PhoneInput
                                    defaultCountry="us"
                                    value={`${countryCode}${contactNumber}`}
                                    onChange={(phone, meta) => {
                                        const dialCode = meta?.country?.dialCode ? `+${meta.country.dialCode}` : '';
                                        if (dialCode) {
                                            setCountryCode(dialCode);
                                            setContactNumber(phone.startsWith(dialCode) ? phone.slice(dialCode.length) : phone);
                                        } else {
                                            setContactNumber(phone);
                                        }
                                    }}
                                    inputStyle={{
                                        width: '100%',
                                        border: '1px solid #D0D5DD',
                                        borderRadius: '0 0.5rem 0.5rem 0',
                                        borderLeft: 'none',
                                        fontSize: '0.875rem',
                                        padding: '0.625rem 1rem',
                                        color: '#101828',
                                        backgroundColor: '#fff',
                                    }}
                                    countrySelectorStyleProps={{
                                        buttonStyle: {
                                            border: '1px solid #D0D5DD',
                                            borderRadius: '0.5rem 0 0 0.5rem',
                                            borderRight: 'none',
                                            padding: '0 0.75rem',
                                            backgroundColor: '#fff',
                                        },
                                    }}
                                    style={{ width: '100%', display: 'flex' }}
                                />
                            </div>
                        </div>

                        {/* Professional */}
                        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Professional</h2>
                            <div>
                                <label className={labelCls}>Job Title</label>
                                <input
                                    type="text"
                                    value={jobTitle}
                                    onChange={(e) => setJobTitle(e.target.value)}
                                    placeholder="e.g. Senior Engineer"
                                    className={inputCls}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Company</label>
                                    <input
                                        type="text"
                                        value={company}
                                        onChange={(e) => setCompany(e.target.value)}
                                        placeholder="Company name"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Department / Position</label>
                                    <input
                                        type="text"
                                        value={position}
                                        onChange={(e) => setPosition(e.target.value)}
                                        placeholder="e.g. Engineering"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingName}
                                className={`rounded-lg px-6 py-2.5 text-white text-sm font-medium transition-colors ${
                                    isSavingName ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                                }`}
                            >
                                {isSavingName ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            <ChangePasswordCard
                {...changePassword}
                showNewPw={showNewPw}
                setShowNewPw={setShowNewPw}
                showConfirmPw={showConfirmPw}
                setShowConfirmPw={setShowConfirmPw}
            />
        </div>
    );
}
