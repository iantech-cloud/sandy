import { Suspense } from 'react';
import { getAdminUsers } from '@/app/actions/user-management';
import AdminUsersContent from './AdminUsersContent';

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading users...</p>
      </div>
    </div>
  );
}

async function AdminUsersDataLoader() {
  // Server-side initial fetch: moved from useState + useEffect (rule 2)
  const result = await getAdminUsers({ tab: 'all', search: '' });

  if (!result.success) {
    throw new Error(result.message);
  }

  return (
    <AdminUsersContent initialUsers={result.data || []} initialStats={result.stats} />
  );
}

export default async function AdminUsersPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <AdminUsersDataLoader />
    </Suspense>
  );
}
