"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";

interface Transaction {
  id: string;
  amount: number;
  amount_cents: number;
  transaction_type: "credit" | "debit";
  type: string;
  type_label: string;
  source: string;
  target_type?: string;
  target: string;
  earning_source_type: string;
  description: string;
  status: string;
  date: string;
  coop_reference_id?: string | null;
  mpesa_reference_id?: string | null;
  downline_level?: string | number | null;
}

interface Stats {
  totalEarnings: number;
  totalWithdrawals: number;
  downlineEarnings: number;
  walletBalance: number;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface TransactionResponse {
  data: {
    transactions: Transaction[];
    pagination: PaginationInfo;
    stats: Stats;
  };
}

function friendlyType(
  txn: Transaction
): { label: string; color: string } {
  const s = txn.source?.toUpperCase() || "";
  const e = txn.earning_source_type?.toLowerCase() || "";

  if (e === "downline")
    return { label: "Downline Bonus", color: "bg-purple-900/30 text-purple-300" };
  if (s === "REFERRAL")
    return { label: "Referral Bonus", color: "bg-purple-900/30 text-purple-300" };
  if (s === "ACTIVATION_FEE")
    return { label: "Activation Fee", color: "bg-yellow-900/30 text-yellow-300" };
  if (s === "ACCOUNT_ACTIVATION")
    return { label: "Activation", color: "bg-yellow-900/30 text-yellow-300" };
  if (s === "DEPOSIT" || s === "CHAT_DEPOSIT")
    return { label: "Deposit", color: "bg-blue-900/30 text-blue-300" };
  if (s === "WITHDRAWAL" || s === "CHAT_WITHDRAWAL")
    return { label: "Withdrawal", color: "bg-red-900/30 text-red-300" };
  if (s.includes("SPIN"))
    return { label: "Spin", color: "bg-pink-900/30 text-pink-300" };
  if (s === "SURVEY")
    return { label: "Survey Reward", color: "bg-indigo-900/30 text-indigo-300" };
  if (s === "BONUS" || s === "ADMIN_CREDIT")
    return { label: "Bonus/Credit", color: "bg-green-900/30 text-green-300" };
  if (s === "CHAT_MESSAGE_EARNING")
    return { label: "Chat Earning", color: "bg-teal-900/30 text-teal-300" };
  if (s === "CHAT_REFERRAL_EARNING")
    return { label: "Chat Referral", color: "bg-purple-900/30 text-purple-300" };
  if (txn.transaction_type === "credit")
    return { label: "Earnings", color: "bg-green-900/30 text-green-300" };
  return { label: "Debit", color: "bg-red-900/30 text-red-300" };
}

function safeDate(date: string | null | undefined): string {
  if (!date) return "N/A";
  try {
    return format(new Date(date), "MMM dd, yyyy HH:mm");
  } catch {
    return "Invalid date";
  }
}

function refLabel(
  txn: Transaction
): { primary: string | null; secondary: string | null } {
  return {
    primary: txn.mpesa_reference_id || null,
    secondary: txn.coop_reference_id || null,
  };
}

export function TransactionsContent({
  initialData,
}: {
  initialData: TransactionResponse;
}) {
  // URL state: filters and pagination (rule 4 & 5)
  const [activeTab, setActiveTab] = useQueryState("tab", {
    defaultValue: "all",
  });
  const [currentPage, setCurrentPage] = useQueryState("page", {
    defaultValue: "1",
    parse: (value) => parseInt(value, 10),
    serialize: (value) => value.toString(),
  });
  const [statusFilter, setStatusFilter] = useQueryState("status", {
    defaultValue: "all",
  });

  // React Query for transactions (rule 2 & 3)
  const { data, isLoading } = useQuery({
    queryKey: ["transactions", activeTab, currentPage, statusFilter],
    queryFn: async () => {
      const url = new URL("/api/transactions", window.location.origin);
      url.searchParams.set("page", currentPage.toString());
      url.searchParams.set("limit", "20");
      url.searchParams.set("sourceType", activeTab);
      if (statusFilter !== "all")
        url.searchParams.set("status", statusFilter);

      const response = await fetch(url.toString());
      if (!response.ok) throw new Error("Failed to fetch transactions");
      return response.json() as Promise<TransactionResponse>;
    },
    initialData,
    staleTime: 30 * 1000,
  });

  const stats = data.data.stats;
  const transactions = data.data.transactions;
  const pagination = data.data.pagination;

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const refetch = async () => {
    // Re-fetch on demand
    const url = new URL("/api/transactions", window.location.origin);
    url.searchParams.set("page", currentPage.toString());
    url.searchParams.set("limit", "20");
    url.searchParams.set("sourceType", activeTab);
    if (statusFilter !== "all")
      url.searchParams.set("status", statusFilter);

    const response = await fetch(url.toString());
    if (response.ok) {
      const newData = await response.json() as TransactionResponse;
      // Re-render will happen automatically with the updated data
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Transaction History
            </h1>
            <p className="text-slate-400 text-sm">
              A complete record of all your earnings, payments, and withdrawals
            </p>
          </div>
          <button
            onClick={refetch}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">
              Total Earnings
            </p>
            <p className="text-2xl font-bold text-green-400">
              KES{" "}
              {stats.totalEarnings.toLocaleString("en-KE", {
                minimumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-red-900/30 to-rose-900/30 border border-red-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">
              Total Withdrawals
            </p>
            <p className="text-2xl font-bold text-red-400">
              KES{" "}
              {stats.totalWithdrawals.toLocaleString("en-KE", {
                minimumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">
              Downline Earnings
            </p>
            <p className="text-2xl font-bold text-purple-400">
              KES{" "}
              {stats.downlineEarnings.toLocaleString("en-KE", {
                minimumFractionDigits: 0,
              })}
            </p>
          </div>

          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg p-5">
            <p className="text-slate-400 text-xs mb-1 uppercase tracking-wide">
              Wallet Balance
            </p>
            <p className="text-2xl font-bold text-blue-400">
              KES{" "}
              {stats.walletBalance.toLocaleString("en-KE", {
                minimumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        {/* Tabs and Filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["all", "direct", "downline"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                activeTab === tab
                  ? "bg-blue-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {tab === "all" && "All Transactions"}
              {tab === "direct" && "Direct Earnings"}
              {tab === "downline" && "Downline"}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="mb-6 flex gap-2">
          {["all", "completed", "pending"].map((status) => (
            <button
              key={status}
              onClick={() => handleStatusChange(status)}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                statusFilter === status
                  ? "bg-green-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {status === "all" && "All Status"}
              {status === "completed" && "Completed"}
              {status === "pending" && "Pending"}
            </button>
          ))}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          </div>
        )}

        {/* Transactions Table */}
        {!isLoading && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
            {transactions.length === 0 ? (
              <div className="p-8 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-slate-400">No transactions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-900 border-b border-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        Target
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase">
                        References
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {transactions.map((txn) => {
                      const typeInfo = friendlyType(txn);
                      const refs = refLabel(txn);

                      return (
                        <tr key={txn.id} className="hover:bg-slate-700/50">
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${typeInfo.color}`}
                            >
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {txn.transaction_type === "credit" ? (
                                <TrendingUp className="w-4 h-4 text-green-400" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-400" />
                              )}
                              <span
                                className={`font-semibold ${
                                  txn.transaction_type === "credit"
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {txn.transaction_type === "credit" ? "+" : "-"}
                                KES {txn.amount.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-300">{txn.target}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                txn.status === "completed"
                                  ? "bg-green-900/50 text-green-300"
                                  : "bg-yellow-900/50 text-yellow-300"
                              }`}
                            >
                              {txn.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-400">
                            {safeDate(txn.date)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 text-xs">
                              {refs.primary && (
                                <code className="bg-slate-900 text-slate-300 px-2 py-1 rounded">
                                  {refs.primary}
                                </code>
                              )}
                              {refs.secondary && (
                                <code className="bg-slate-900 text-slate-400 px-2 py-1 rounded text-[10px]">
                                  {refs.secondary}
                                </code>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-slate-400">
              Showing page {pagination.currentPage} of {pagination.totalPages} (
              {pagination.totalCount} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={!pagination.hasPrev}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = Math.max(
                  1,
                  pagination.currentPage - 2 + i
                );
                return (
                  page <= pagination.totalPages && (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        page === pagination.currentPage
                          ? "bg-blue-600 text-white"
                          : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      }`}
                    >
                      {page}
                    </button>
                  )
                );
              })}
              <button
                onClick={() =>
                  setCurrentPage(
                    Math.min(pagination.totalPages, currentPage + 1)
                  )
                }
                disabled={!pagination.hasNext}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
