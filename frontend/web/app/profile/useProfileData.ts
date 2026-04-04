'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { validatePassword } from '@/lib/passwordValidation';
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

export function useProfileData() {
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [profilePicUrl, setProfilePicUrl] = useState('');
    const [imageKey, setImageKey] = useState(Date.now());

    const [isLoading, setIsLoading] = useState(true);
    const [isSavingName, setIsSavingName] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const [pwStep, setPwStep] = useState<'idle' | 'sent' | 'done'>('idle');
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isResettingPw, setIsResettingPw] = useState(false);

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
            if (typeof data === 'string' && data.trim()) return data;
            if (data && typeof data === 'object' && 'message' in data) {
                const message = (data as { message?: unknown }).message;
                if (typeof message === 'string' && message.trim()) return message;
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

    const handleSendOtp = async () => {
        setErrorMessage('');
        setSuccessMessage('');
        if (!email) { setErrorMessage('Email not found.'); return; }
        try {
            setIsSendingOtp(true);
            await api.post('/api/auth/forgot', { email });
            setPwStep('sent');
            setSuccessMessage('Reset code sent to your email.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to send reset code.'));
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        if (!otp.trim()) { setErrorMessage('Please enter the reset code.'); return; }
        const pwResult = validatePassword(newPassword);
        if (!pwResult.valid) { setErrorMessage('Password does not meet the security requirements (min 8 characters, uppercase, lowercase, number, special character).'); return; }
        if (newPassword !== confirmPassword) { setErrorMessage('Passwords do not match.'); return; }
        try {
            setIsResettingPw(true);
            await api.post('/api/auth/reset', { email, otp: otp.trim(), newPassword });
            setPwStep('done');
            setOtp('');
            setNewPassword('');
            setConfirmPassword('');
            setSuccessMessage('Password changed successfully.');
        } catch (error: unknown) {
            setErrorMessage(getApiErrorMessage(error, 'Failed to reset password. Check your reset code.'));
        } finally {
            setIsResettingPw(false);
        }
    };

    const onSaveFullName = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');
        if (!fullName.trim()) { setErrorMessage('Full name cannot be blank.'); return; }
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
                headers: { 'Content-Type': 'multipart/form-data' },
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

    return {
        username,
        email,
        fullName, setFullName,
        resolvedProfilePicUrl,
        imageKey,
        isLoading,
        isSavingName,
        isUploadingPhoto,
        pwStep, setPwStep,
        isSendingOtp,
        otp, setOtp,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        isResettingPw,
        errorMessage,
        successMessage,
        handleSendOtp,
        handleResetPassword,
        onSaveFullName,
        onUploadPhoto,
    };
}
