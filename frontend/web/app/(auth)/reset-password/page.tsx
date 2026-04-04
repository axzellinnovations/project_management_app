'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page is no longer used.
 * The forgot-password and reset-password flows have been unified
 * into a single 3-step page at /forgot-password.
 */
export default function ResetPasswordRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/forgot-password');
  }, [router]);
  return null;
}
