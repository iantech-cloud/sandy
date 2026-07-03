import { Suspense } from 'react';
import { AdminTransactionsContent } from '../AdminTransactionsContent';
import { Loader2 } from 'lucide-react';

async function getTransactions() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/transactions`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Failed to fetch transactions');
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
        <p className="text-gray-600">Loading transactions...</p>
      </div>
    </div>
  );
}

export default async function AdminTransactionsPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const transactions = await getTransactions();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminTransactionsContent initialTransactions={transactions} />
    </Suspense>
  );
}
