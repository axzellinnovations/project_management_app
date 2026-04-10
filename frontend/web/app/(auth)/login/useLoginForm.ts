'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getValidToken, saveToken, saveRefreshToken, setRememberMe } from '@/lib/auth';

export function useLoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Skip login page if already authenticated
  useEffect(() => {
    if (getValidToken()) {
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await api.post('/api/auth/login', {
        email: email.toLowerCase(),
        password,
      });

      if (response.data.success) {
        setRememberMe(remember);
        saveToken(response.data.token);
        if (response.data.refreshToken) {
          saveRefreshToken(response.data.refreshToken);
        }
        router.push('/dashboard');
      } else {
        setError(response.data.message || 'Login failed. Please try again.');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      let errorMessage = 'Login failed. Please try again.';
      const errorData = err.response?.data;

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      if (err.response?.status === 403) {
        setError(errorMessage || 'Email is not verified. Please check your email.');
      } else if (err.response?.status === 401) {
        setError(errorMessage || 'Incorrect username or password');
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    showPassword, setShowPassword,
    isLoading,
    error,
    handleLogin,
  };
}
