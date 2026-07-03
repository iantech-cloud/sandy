import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TransactionsContent } from "../TransactionsContent";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        <p className="text-slate-400">Loading transactions...</p>
      </div>
    </div>
  );
}

async function getTransactionsData() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/transactions?page=1&limit=20&sourceType=all`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch transactions");
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return {
      data: {
        transactions: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalCount: 0,
          hasNext: false,
          hasPrev: false,
        },
        stats: {
          totalEarnings: 0,
          totalWithdrawals: 0,
          downlineEarnings: 0,
          walletBalance: 0,
        },
      },
    };
  }
}

export default async function TransactionsPage() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  const initialData = await getTransactionsData();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <TransactionsContent initialData={initialData} />
    </Suspense>
  );
}
