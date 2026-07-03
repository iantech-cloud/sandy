import { Suspense } from 'react';
import { ProfileContent } from '../ProfileContent';
import { Loader2 } from 'lucide-react';

async function getProfile() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/dashboard/profile`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch profile');
    const data = await response.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading your profile...</p>
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const profile = await getProfile();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfileContent initialProfile={profile} />
    </Suspense>
  );
}
