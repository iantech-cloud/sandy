import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { getWithdrawals, getWithdrawalStats } from "@/app/actions/withdrawals";
import { AdminWithdrawalsContent } from "./AdminWithdrawalsContent";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Loading withdrawals...</p>
      </div>
    </div>
  );
}

export default async function WithdrawalsPage() {
  // Server-side fetches: no useState, no useEffect (rule 2)
  const [withdrawalsData, statsData] = await Promise.all([
    getWithdrawals({ page: 1 }),
    getWithdrawalStats(),
  ]);

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminWithdrawalsContent
        initialWithdrawals={withdrawalsData}
        initialStats={statsData}
      />
    </Suspense>
  );
}
