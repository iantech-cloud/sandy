"use client";

import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  RotateCcw,
  Eye,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  getWithdrawals,
  getWithdrawalStats,
  approveWithdrawal,
  rejectWithdrawal,
  completeWithdrawal,
  reverseWithdrawal,
  bulkApproveWithdrawals,
} from "@/app/actions/withdrawals";

interface Withdrawal {
  _id: string;
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
    phone: string;
    balance: number;
  };
  amount: number;
  amountCents: number;
  status: "pending" | "approved" | "rejected" | "completed";
  mpesaNumber: string;
  transactionCode?: string;
  mpesaReceiptNumber?: string;
  approvedBy?: {
    id: string;
    username: string;
    email: string;
  };
  approvedAt?: string;
  processedAt?: string;
  processingNotes?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface WithdrawalStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  totalAmountCents: number;
  averageAmountCents: number;
}

interface WithdrawalsResponse {
  success: boolean;
  data: Withdrawal[];
  totalPages: number;
  currentPage: number;
  totalCount: number;
}

interface StatsResponse {
  success: boolean;
  data: WithdrawalStats;
}

export function AdminWithdrawalsContent({
  initialWithdrawals,
  initialStats,
}: {
  initialWithdrawals: WithdrawalsResponse;
  initialStats: StatsResponse;
}) {
  // URL state: filters and pagination (rule 4 & 5)
  const [statusFilter, setStatusFilter] = useQueryState("status", {
    defaultValue: "all",
  });
  const [searchQuery, setSearchQuery] = useQueryState("search", {
    defaultValue: "",
  });
  const [dateFilter, setDateFilter] = useQueryState("date", {
    defaultValue: "all",
  });
  const [currentPage, setCurrentPage] = useQueryState("page", {
    defaultValue: "1",
    parse: (value) => parseInt(value, 10),
    serialize: (value) => value.toString(),
  });

  // Ephemeral UI state: modals and selections (rule 6)
  const [selectedWithdrawals, setSelectedWithdrawals] = useState<string[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showReverseModal, setShowReverseModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(
    null
  );
  const [modalInput, setModalInput] = useState("");

  const queryClient = useQueryClient();

  // React Query for withdrawals data (rule 2 & 3)
  const { data: withdrawalsData, isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: ["withdrawals", currentPage, statusFilter, searchQuery, dateFilter],
    queryFn: async () => {
      const result = await getWithdrawals({
        page: currentPage,
        status: statusFilter !== "all" ? statusFilter : undefined,
        search: searchQuery || undefined,
        dateRange: dateFilter !== "all" ? dateFilter : undefined,
      } as any);
      return result;
    },
    initialData: initialWithdrawals,
    staleTime: 30 * 1000,
  });

  // React Query for stats (rule 2 & 3)
  const { data: statsData } = useQuery({
    queryKey: ["withdrawal-stats"],
    queryFn: async () => {
      const result = await getWithdrawalStats();
      return result;
    },
    initialData: initialStats,
    staleTime: 60 * 1000,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await approveWithdrawal(id);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Withdrawal approved");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-stats"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const result = await rejectWithdrawal(id, reason);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Withdrawal rejected");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-stats"] });
      setShowRejectModal(false);
      setModalInput("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Complete mutation
  const completeMutation = useMutation({
    mutationFn: async ({
      id,
      mpesaReceipt,
    }: {
      id: string;
      mpesaReceipt: string;
    }) => {
      const result = await completeWithdrawal(id, mpesaReceipt);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Withdrawal completed");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-stats"] });
      setShowCompleteModal(false);
      setModalInput("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const result = await bulkApproveWithdrawals(ids);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      toast.success("Withdrawals approved");
      queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["withdrawal-stats"] });
      setSelectedWithdrawals([]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const stats = statsData?.data || initialStats.data;
  const withdrawals = withdrawalsData?.data || [];
  const totalPages = withdrawalsData?.totalPages || 1;

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      pending: {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        icon: <Clock className="w-4 h-4" />,
      },
      approved: {
        bg: "bg-blue-100",
        text: "text-blue-800",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      completed: {
        bg: "bg-green-100",
        text: "text-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      rejected: {
        bg: "bg-red-100",
        text: "text-red-800",
        icon: <XCircle className="w-4 h-4" />,
      },
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Withdrawals Management</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Withdrawals</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Approved</p>
            <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm">Total Amount</p>
            <p className="text-2xl font-bold text-gray-900">
              KSh {(stats.totalAmountCents / 100).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search withdrawals..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>

            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>

            {selectedWithdrawals.length > 0 && (
              <button
                onClick={() =>
                  bulkApproveMutation.mutate(selectedWithdrawals)
                }
                disabled={bulkApproveMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {bulkApproveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Approve (${selectedWithdrawals.length})`
                )}
              </button>
            )}
          </div>
        </div>

        {/* Withdrawals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoadingWithdrawals ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No withdrawals found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        selectedWithdrawals.length === withdrawals.length &&
                        withdrawals.length > 0
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedWithdrawals(
                            withdrawals.map((w) => w._id)
                          );
                        } else {
                          setSelectedWithdrawals([]);
                        }
                      }}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    User
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    M-Pesa Number
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {withdrawals.map((withdrawal) => {
                  const badge = getStatusBadge(withdrawal.status);
                  const isSelected = selectedWithdrawals.includes(
                    withdrawal._id
                  );

                  return (
                    <tr key={withdrawal._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWithdrawals([
                                ...selectedWithdrawals,
                                withdrawal._id,
                              ]);
                            } else {
                              setSelectedWithdrawals(
                                selectedWithdrawals.filter(
                                  (id) => id !== withdrawal._id
                                )
                              );
                            }
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{withdrawal.user.username}</p>
                          <p className="text-sm text-gray-600">
                            {withdrawal.user.email}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium">
                        KSh {withdrawal.amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {withdrawal.mpesaNumber}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}
                        >
                          {badge.icon}
                          {withdrawal.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(withdrawal.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(withdrawal);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 hover:bg-gray-100 rounded"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>

                          {withdrawal.status === "pending" && (
                            <>
                              <button
                                onClick={() => approveMutation.mutate(withdrawal._id)}
                                disabled={approveMutation.isPending}
                                className="p-2 hover:bg-green-100 rounded disabled:opacity-50"
                              >
                                <Check className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedWithdrawal(withdrawal);
                                  setShowRejectModal(true);
                                }}
                                className="p-2 hover:bg-red-100 rounded"
                              >
                                <X className="w-4 h-4 text-red-600" />
                              </button>
                            </>
                          )}

                          {withdrawal.status === "approved" && (
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(withdrawal);
                                setShowCompleteModal(true);
                              }}
                              className="p-2 hover:bg-blue-100 rounded"
                            >
                              <CheckCircle className="w-4 h-4 text-blue-600" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <p className="text-gray-600 text-sm">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Details Modal */}
        {showDetailsModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-lg font-bold mb-4">Withdrawal Details</h2>
              <div className="space-y-3 text-sm mb-6">
                <p>
                  <span className="text-gray-600">User:</span>{" "}
                  {selectedWithdrawal.user.username}
                </p>
                <p>
                  <span className="text-gray-600">Amount:</span> KSh{" "}
                  {selectedWithdrawal.amount.toLocaleString()}
                </p>
                <p>
                  <span className="text-gray-600">M-Pesa:</span>{" "}
                  {selectedWithdrawal.mpesaNumber}
                </p>
                <p>
                  <span className="text-gray-600">Status:</span>{" "}
                  {selectedWithdrawal.status}
                </p>
                {selectedWithdrawal.processingNotes && (
                  <p>
                    <span className="text-gray-600">Notes:</span>{" "}
                    {selectedWithdrawal.processingNotes}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="w-full px-4 py-2 bg-gray-200 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-lg font-bold mb-4">Reject Withdrawal</h2>
              <textarea
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedWithdrawal._id,
                      reason: modalInput,
                    })
                  }
                  disabled={rejectMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50"
                >
                  {rejectMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Reject"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Modal */}
        {showCompleteModal && selectedWithdrawal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-lg font-bold mb-4">Complete Withdrawal</h2>
              <input
                type="text"
                value={modalInput}
                onChange={(e) => setModalInput(e.target.value)}
                placeholder="M-Pesa Receipt Number..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    completeMutation.mutate({
                      id: selectedWithdrawal._id,
                      mpesaReceipt: modalInput,
                    })
                  }
                  disabled={completeMutation.isPending}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
                >
                  {completeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Complete"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
