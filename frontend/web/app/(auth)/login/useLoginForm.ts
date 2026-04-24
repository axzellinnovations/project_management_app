'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getValidToken, saveToken, saveRefreshToken, setRememberMe } from '@/lib/auth';

/*
 * Headless Business Logic Hook for Login.
 * Manages the API contract between the Next.js frontend and the Spring Boot backend.
 */
export function useLoginForm() {
  const router = useRouter();

  // ── Form State ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Network State ──
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /*
   * UX Optimization: Silent Auth Bypass.
   * On component mount, check if we already have a valid JWT. 
   * If so, instantly kick the user to the dashboard so they don't have to look at a login screen.
   */
  useEffect(() => {
    if (getValidToken()) {
      // Use replace() instead of push() so the user can't hit the "Back" button 
      // and end up stuck on the login page again.
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Core Login Execution
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // API CONTRACT: Send credentials to Spring Boot.
      const response = await api.post('/api/auth/login', {
        email: email.toLowerCase(),
        password,
      });

      if (response.data.success) {
        // Step 1: Tell our local auth utility how long to keep these tokens alive based on user preference.
        setRememberMe(remember);

        // Step 2: Persist the Access JWT.
        saveToken(response.data.token);

        // Step 3: Persist the Refresh Token (if the backend issues them).
        if (response.data.refreshToken) {
          saveRefreshToken(response.data.refreshToken);
        }

        // Step 4: Route to the authenticated app.
        router.push('/dashboard');
      } else {
        setError(response.data.message || 'Login failed. Please try again.');
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // ── API Error Translation ──
      // This block bridges the gap between raw HTTP protocol errors and user-friendly UI text.
      let errorMessage = 'Login failed. Please try again.';
      const errorData = err.response?.data;

      // Parse the Spring Boot payload formats
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }

      // Map strict HTTP Status Codes to contextual help.
      if (err.response?.status === 403) {
        // 403 Forbidden is typically thrown by our JpaUserDetailedService if user.isVerified() is false.
        setError(errorMessage || 'Email is not verified. Please check your email.');
      } else if (err.response?.status === 401) {
        // 401 Unauthorized is standard for bad credentials.
        setError(errorMessage || 'Incorrect username or password');
      } else {
        // 500s or unknown errors.
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Expose the internal state and actions to the View Component.
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
