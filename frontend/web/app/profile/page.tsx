'use client';

import Image from 'next/image';
import { useState } from 'react';
import { PhoneInput } from 'react-international-phone';
import { Activity, BadgeCheck, BriefcaseBusiness, Camera, Mail, UserRound, Menu } from 'lucide-react';
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
        <div className="mobile-page-padding max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
            <div className="sticky-section-header glass-panel rounded-2xl border border-[#E4E7EC] bg-gradient-to-r from-white via-[#F8FAFF] to-white px-5 py-5 sm:px-6 sm:py-6 shadow-sm mb-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        {/* Mobile Sidebar Toggle Button */}
                        <button
                            onClick={() => window.dispatchEvent(new CustomEvent('planora:sidebar:toggle'))}
                            className="md:hidden p-2 -ml-2 text-[#4B5563] rounded-xl hover:bg-gray-100 transition-colors shrink-0 active:bg-gray-200"
                            aria-label="Toggle Sidebar"
                        >
                            <Menu strokeWidth={2.5} size={22} className="text-[#4B5563]" />
                        </button>
                        <div>
                            <h1 className="text-[26px] sm:text-[30px] font-bold tracking-tight text-[#101828]">Profile Settings</h1>
                            <p className="text-sm text-[#667085] mt-1">Manage your account, personal info.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1 text-xs font-semibold text-[#344054]">
                            <BadgeCheck size={13} className="text-[#155DFC]" />
                            Verified Account
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#D0D5DD] bg-white px-3 py-1 text-xs font-semibold text-[#344054]">
                            <Activity size={13} className="text-emerald-600" />
                            Active
                        </span>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {errorMessage && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
                    {errorMessage}
                </div>
            )}
            {successMessage && (
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 shadow-sm">
                    {successMessage}
                </div>
            )}

            <form onSubmit={(e) => void onSaveProfile(e)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* ── Left Column ── */}
                    <div className="lg:col-span-1 flex flex-col gap-6 lg:sticky lg:top-6 self-start">

                        {/* Avatar card */}
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 flex flex-col items-center gap-4 shadow-sm">
                            <div className="w-24 h-24 rounded-full bg-[#EEF2F6] border border-[#D0D5DD] overflow-hidden flex items-center justify-center ring-4 ring-[#F2F4F7]">
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
                            <div className="text-center">
                                <p className="text-sm font-semibold text-[#101828]">{fullName || username || 'User'}</p>
                                <p className="text-xs text-[#667085]">{jobTitle || 'No job title set'}</p>
                            </div>
                            <label className="inline-flex items-center justify-center rounded-xl bg-[#155DFC] hover:bg-[#0042A8] text-white text-sm font-semibold px-4 py-2.5 min-h-[44px] cursor-pointer transition-colors w-full text-center shadow-sm">
                                <Camera size={15} className="mr-1.5" />
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
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 space-y-4 shadow-sm">
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
                            <div className="grid grid-cols-1 gap-2 pt-1">
                                <div className="inline-flex items-center gap-2 text-xs text-[#667085] rounded-lg bg-[#F8FAFC] border border-[#EAECF0] px-3 py-2">
                                    <UserRound size={13} />
                                    Username and email are managed by your account provider.
                                </div>
                            </div>
                        </div>

                        {/* Bio card */}
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 space-y-2 shadow-sm">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide">Bio</h2>
                            <textarea
                                value={bio}
                                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                                placeholder="Tell your team a little about yourself…"
                                rows={5}
                                className="w-full rounded-xl border border-[#D0D5DD] bg-white text-[#101828] px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] resize-none"
                            />
                            <p className="text-xs text-[#9CA3AF] text-right">{bio.length}/{BIO_MAX}</p>
                        </div>
                    </div>

                    {/* ── Right Column ── */}
                    <div className="lg:col-span-2 flex flex-col gap-6">

                        {/* Basic Info */}
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 space-y-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide flex items-center gap-2">
                                <UserRound size={15} className="text-[#155DFC]" />
                                Basic Info
                            </h2>
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
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 space-y-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide flex items-center gap-2">
                                <Mail size={15} className="text-[#155DFC]" />
                                Contact
                            </h2>
                            <div>
                                <label className={labelCls}>Phone Number</label>
                                <div className="rounded-xl border border-[#D0D5DD] bg-white shadow-sm focus-within:border-[#155DFC] focus-within:ring-2 focus-within:ring-[#155DFC]/20">
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
                                            height: '2.5rem',
                                            border: 'none',
                                            borderRadius: '0 0.75rem 0.75rem 0',
                                            fontSize: '0.875rem',
                                            padding: '0 0.875rem',
                                            color: '#101828',
                                            backgroundColor: 'transparent',
                                        }}
                                        countrySelectorStyleProps={{
                                            buttonStyle: {
                                                height: '2.5rem',
                                                border: 'none',
                                                borderRadius: '0.75rem 0 0 0.75rem',
                                                borderRight: '1px solid #EAECF0',
                                                padding: '0 0.75rem',
                                                backgroundColor: 'transparent',
                                            },
                                        }}
                                        style={{ width: '100%', display: 'flex' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Professional */}
                        <div className="bg-white border border-[#E4E7EC] rounded-2xl p-6 space-y-4 shadow-sm">
                            <h2 className="text-sm font-semibold text-[#101828] uppercase tracking-wide flex items-center gap-2">
                                <BriefcaseBusiness size={15} className="text-[#155DFC]" />
                                Professional
                            </h2>
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
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={isSavingName}
                                className={`rounded-xl px-6 py-2.5 text-white text-sm font-semibold transition-colors shadow-sm ${
                                    isSavingName ? 'bg-blue-400 cursor-not-allowed' : 'bg-[#155DFC] hover:bg-[#0042A8]'
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
