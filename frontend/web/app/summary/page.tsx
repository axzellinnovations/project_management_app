import { redirect } from 'next/navigation';

// /summary without a projectId is no longer valid — redirect to dashboard
export default function SummaryRootPage() {
    redirect('/dashboard');
}
