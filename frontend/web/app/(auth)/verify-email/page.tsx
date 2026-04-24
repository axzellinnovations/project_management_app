import { Suspense } from 'react';
import BrandLogo from '../components/UI/BrandLogo';
import VerifyEmailForm from '../components/VerifyEmailForm';
import PendingVerificationBanner from './PendingVerificationBanner';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">

      <BrandLogo />

      {/* FEATURE-5: Remind the user that their email is pending verification */}
      {/* fallback={null} because the banner is non-critical — silently hiding it during SSR is fine */}
      <Suspense fallback={null}>
        <PendingVerificationBanner />
      </Suspense>

      {/* Suspense is required here because VerifyEmailForm uses useSearchParams(), which suspends on the server */}
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>

    </div>
  );
}