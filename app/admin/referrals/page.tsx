import { Suspense } from 'react';
import { AdminReferralsContent } from '../AdminReferralsContent';
import { Loader2 } from 'lucide-react';

async function getReferrals() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/referrals`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch referrals');
    return response.json();
  } catch {
    return [];
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading referrals...</p>
      </div>
    </div>
  );
}

export default async function AdminReferralsPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const referrals = await getReferrals();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminReferralsContent initialReferrals={referrals} />
    </Suspense>
  );
}
