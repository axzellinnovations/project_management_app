import { Suspense } from 'react';
import BrandLogo from '../components/UI/BrandLogo';
import VerifyEmailForm from '../components/VerifyEmailForm';
import PendingVerificationBanner from './PendingVerificationBanner';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">

      <BrandLogo />

      {/* FEATURE-5: Remind the user that their email is pending verification */}
      <Suspense fallback={null}>
        <PendingVerificationBanner />
      </Suspense>

      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>

    </div>
  );
}