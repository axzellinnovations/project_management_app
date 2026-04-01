'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';

type UserResponse = {
    userId: number;
    username: string;
    fullName: string | null;
    email: string;
    verified: boolean;
    profilePicUrl: string | null;
};

type PhotoUploadResponse = {
    success: boolean;
    message: string;
    fileUrl: string | null;
    errorCode: string | null;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

export default function ProfilePage() {
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [profilePicUrl, setProfilePicUrl] = useState('');
    const [imageKey, setImageKey] = useState(Date.now());

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const resolvedProfilePicUrl = useMemo(() => {
        if (!profilePicUrl) return '';
        if (profilePicUrl.startsWith('http://') || profilePicUrl.startsWith('https://')) {
            return profilePicUrl;
        }
        return `${API_BASE_URL}${profilePicUrl}`;
    }, [profilePicUrl]);

    const getApiErrorMessage = (error: unknown, fallback: string) => {
        if (error instanceof AxiosError) {
            const data = error.response?.data;
            if (typeof data === 'string' && data.trim()) {
                return data;
            }
            if (data && typeof data === 'object' && 'message' in data) {
                const message = (data as { message?: unknown }).message;
                if (typeof message === 'string' && message.trim()) {
                    return message;
                }
            }
        }
        return fallback;
    };

    useEffect(() => {
        const tokenUser = getUserFromToken();
        if (!tokenUser) {
            router.push('/login');
            return;
        }

        setUsername(tokenUser.username || '');
        setEmail(tokenUser.email || '');

        const loadProfile = async () => {
            try {
                const response = await api.get<UserResponse[]>('/api/auth/users');
                const currentUser = response.data.find(
                    (user) => user.email.toLowerCase() === tokenUser.email.toLowerCase()
                );

                if (currentUser) {
                    setUsername(currentUser.username || tokenUser.username || '');
                    setFullName(currentUser.fullName || '');
                    setProfilePicUrl(currentUser.profilePicUrl || '');
                }
            } catch (error: unknown) {
                setErrorMessage(getApiErrorMessage(error, 'Failed to load profile details.'));
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, [router]);

    const onSaveFullName = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        if (!fullName.trim()) {
            setErrorMessage('Full name cannot be blank.');
            return;
        }

        try {
            setIsSavingName(true);
            const response = await api.put<UserResponse>('/api/user/profile/update', {
                fullName: fullName.trim(),
            });

            setFullName(response.data.fullName || '');
            setSuccessMessage('Profile updated successfully.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to update profile.'));
        } finally {
            setIsSavingName(false);
        }
    };

    const onUploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setErrorMessage('');
        setSuccessMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            setIsUploadingPhoto(true);
            const response = await api.post<PhotoUploadResponse>('/api/user/profile/photo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (!response.data.success) {
                setErrorMessage(response.data.message || 'Failed to upload profile picture.');
                return;
            }

            setProfilePicUrl(response.data.fileUrl || '');
            setImageKey(Date.now());
            setSuccessMessage('Profile picture updated successfully.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to upload profile picture.'));
        } finally {
            setIsUploadingPhoto(false);
            event.target.value = '';
        }
    };

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
        </div>
    );
}
