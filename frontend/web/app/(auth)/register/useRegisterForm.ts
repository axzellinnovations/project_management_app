'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getValidToken } from '@/lib/auth';

// Exported so the view component can read human-friendly labels and Tailwind colour classes
// without duplicating the mapping or adding a prop-drilling chain.
export const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const;
export const STRENGTH_COLOURS = ['bg-gray-200', 'bg-red-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-600'] as const;

function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score as 0 | 1 | 2 | 3 | 4;
}

export function useRegisterForm() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // replace() instead of push() so the browser's Back button can't navigate back to the register page after login
  useEffect(() => {
    if (getValidToken()) {
      router.replace('/dashboard');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useMemo avoids re-running the regex checks on every keystroke that doesn't touch the password field
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Client-side mismatch check before hitting the API — saves a network round-trip for the most common mistake.
    if (password !== confirmPassword) {
      setError('Passwords do not match!');
      setIsLoading(false);
      return;
    }

    // Enforce a minimum strength requirement to encourage better password hygiene. 
    // The API will still enforce its own rules and return an error if not met, but this gives users faster feedback.
    if (strength < 4) {
    setError('You must choose a Strong password.');
    setIsLoading(false);
    return;
    }

    // This regex is a basic check for the presence of "@" and "." in the right order, 
    // but it doesn't guarantee the email is deliverable or that the user has access to it.
    // This regex checks for text + @ + text + . + text
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/api/auth/register', {
        username, fullName, email: email.toLowerCase(), password,
      });
      // Stored in localStorage so PendingVerificationBanner can show the email even after a page refresh.
      localStorage.setItem('pendingVerificationEmail', email.toLowerCase());
      router.push(`/verify-email?email=${encodeURIComponent(email.toLowerCase())}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      let errorMessage = 'Registration failed. Please try again.';
      const errorData = err.response?.data;

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    username, setUsername,
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    isLoading,
    error,
    strength,
    handleRegister,
  };
}
