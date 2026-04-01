import { Suspense } from 'react';
import BrandLogo from '../components/UI/BrandLogo';
import VerifyEmailForm from '../components/VerifyEmailForm';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans">
      
      <BrandLogo />
      
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmailForm />
      </Suspense>

    </div>
  );
}