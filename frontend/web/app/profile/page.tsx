'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getUserFromToken } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { AxiosError } from 'axios';

type ProfileData = {
    username: string;
    fullName: string;
    email: string;
};

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData>({
        username: '',
        fullName: '',
        email: '',
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const getErrorMessage = (err: unknown, fallback: string) => {
        if (err instanceof AxiosError) {
            const responseData = err.response?.data;
            if (typeof responseData === 'string') {
                return responseData;
            }
            if (responseData && typeof responseData === 'object' && 'message' in responseData) {
                const message = (responseData as { message?: unknown }).message;
                if (typeof message === 'string') {
                    return message;
                }
            }
        }
        return fallback;
    };

    useEffect(() => {
        const user = getUserFromToken();
        if (!user) {
            router.push('/login');
            return;
        }

        const fetchProfile = async () => {
            try {
                const response = await api.get('/api/users/me');
                const data = response.data as Partial<ProfileData>;

                setProfile({
                    username: data.username || user.username || '',
                    fullName: data.fullName || '',
                    email: data.email || user.email,
                });
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Failed to load profile data.'));
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, [router]);

    const handleChange = (field: keyof ProfileData, value: string) => {
        setProfile((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (!profile.username.trim()) {
            setError('Username is required.');
            return;
        }

        setIsSaving(true);
        try {
            const response = await api.put('/api/users/me', {
                username: profile.username.trim(),
                fullName: profile.fullName.trim(),
            });

            const updated = response.data as ProfileData;
            setProfile(updated);
            localStorage.setItem(
                'userProfile',
                JSON.stringify({
                    email: updated.email,
                    username: updated.username,
                    fullName: updated.fullName,
                })
            );
            setSuccessMessage('Profile updated successfully.');
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update profile.'));
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-3xl mx-auto py-10">
                <p className="text-sm text-[#6A7282]">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-4">
            <h1 className="text-2xl font-semibold text-[#101828] mb-2">User Profile</h1>
            <p className="text-sm text-[#6A7282] mb-8">View and update your account information.</p>

            <form onSubmit={handleSubmit} className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-5">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                        {error}
                    </div>
                )}

                {successMessage && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                        {successMessage}
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-[#344054] mb-1.5">Full Name</label>
                    <input
                        type="text"
                        value={profile.fullName}
                        onChange={(e) => handleChange('fullName', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#D0D5DD] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Enter your full name"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#344054] mb-1.5">Username</label>
                    <input
                        type="text"
                        value={profile.username}
                        onChange={(e) => handleChange('username', e.target.value)}
                        className="w-full px-4 py-2.5 rounded-lg border border-[#D0D5DD] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        placeholder="Enter your username"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-[#344054] mb-1.5">Email</label>
                    <input
                        type="email"
                        value={profile.email}
                        disabled
                        className="w-full px-4 py-2.5 rounded-lg border border-[#D0D5DD] bg-gray-50 text-[#667085]"
                    />
                </div>

                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className={`px-5 py-2.5 rounded-lg text-white font-medium transition-colors ${
                            isSaving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}
