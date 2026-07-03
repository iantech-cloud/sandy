import { Suspense } from 'react';
import { AdminSupportContent } from '../AdminSupportContent';
import { Loader2 } from 'lucide-react';
import {
  getAllTickets,
  getTicketStatistics,
  getSupportAgents,
} from '@/app/actions/admin/tickets';

async function getInitialData() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  try {
    const [ticketsResult, statsResult, agentsResult] = await Promise.all([
      getAllTickets({}),
      getTicketStatistics(),
      getSupportAgents(),
    ]);

    return {
      tickets: ticketsResult.tickets || [],
      stats: statsResult.stats || null,
      agents: agentsResult.agents || [],
    };
  } catch (error) {
    console.error('Failed to load support data:', error);
    return {
      tickets: [],
      stats: null,
      agents: [],
    };
  }
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <p className="text-gray-600">Loading support tickets...</p>
      </div>
    </div>
  );
}

export default async function AdminSupportPage() {
  // Server Component: no useState, no useEffect, no client libraries needed
  const { tickets, stats, agents } = await getInitialData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminSupportContent
        initialTickets={tickets}
        initialStats={stats}
        initialAgents={agents}
      />
    </Suspense>
  );
}
