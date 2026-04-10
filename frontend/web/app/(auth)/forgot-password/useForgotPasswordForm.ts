'use client';

import { useState } from 'react';
import api from '@/lib/axios';

export function useForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/api/auth/forgot', {
        email: email.toLowerCase(),
      });
      setSuccess(response.data);
      setSubmitted(true);
      setEmail('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      let errorMessage = 'Failed to process request. Please try again.';
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
    email, setEmail,
    isLoading,
    submitted, setSubmitted,
    error,
    success,
    handleSubmit,
  };
}
