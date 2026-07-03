import { Suspense } from "react";
import { getUserBalance } from "@/app/actions/deposit";
import { WalletContent } from "../WalletContent";
import { Loader2 } from "lucide-react";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-slate-400">Loading wallet...</p>
      </div>
    </div>
  );
}

export default async function WalletPage() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  const balanceResult = await getUserBalance();
  const initialBalance = balanceResult.data?.balance || 0;
  const userPhone = balanceResult.data?.userPhone || "";

  return (
    <Suspense fallback={<LoadingFallback />}>
      <WalletContent initialBalance={initialBalance} userPhone={userPhone} />
    </Suspense>
  );
}
