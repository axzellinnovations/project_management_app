'use client';

import { useState } from 'react';
import api from '@/lib/axios';

/*
 * Headless Business Logic Hook.
 * This manages the API communication contract between the Spring Boot backend 
 * and the Next.js frontend for the Forgot Password flow.
 */
export function useForgotPasswordForm() {
  // Step 1: Define the strict state required for this specific view.
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Step 2: Form Submission Handler
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Reset state flags before firing the network request.
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      // API CONTRACT: Send the email as a JSON payload to our Spring Boot endpoint.
      // We enforce lowercase here again just as a strict safety measure before it hits the DB.
      const response = await api.post('/api/auth/forgot', {
        email: email.toLowerCase(),
      });

      // On success:
      setSuccess(response.data);
      setSubmitted(true);
      setEmail(''); // Clear the input field for security/cleanliness.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Step 3: API Error Translation.
      // Spring Boot might send us a raw string (e.g., "Email not found") 
      // or a JSON object (e.g., { message: "Rate limit exceeded" }).
      // This block safely normalizes those responses into a string the UI can display.
      let errorMessage = 'Failed to process request. Please try again.';
      const errorData = err.response?.data;

      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData?.message) {
        errorMessage = errorData.message;
      }
      setError(errorMessage);
    } finally {
      // Step 4: Always turn off the loading spinner, even if the network fails.
      setIsLoading(false);
    }
  };

  // Step 5: Expose the state and the action function to the consuming component.
  return {
    email, setEmail,
    isLoading,
    submitted, setSubmitted,
    error,
    success,
    handleSubmit,
  };
}
