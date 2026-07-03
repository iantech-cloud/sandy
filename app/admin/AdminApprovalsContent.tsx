"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  RotateCw,
  DollarSign,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { toast } from "sonner";

interface ContentSubmission {
  _id: string;
  title: string;
  content_type: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  payment_status: "pending" | "paid" | "rejected";
  payment_amount: number;
  submission_date: string;
  task_category: string;
  word_count?: number;
  user: {
    _id: string;
    username?: string;
    name?: string;
    email?: string;
  };
}

interface ApprovalsResponse {
  success: boolean;
  data: ContentSubmission[];
}

async function fetchSubmissions(
  filters: Record<string, any>
): Promise<ApprovalsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v && v !== "all") params.append(k, v);
  });

  const response = await fetch(`/api/admin/submissions?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch submissions");
  return response.json();
}

async function approveSubmission(id: string): Promise<void> {
  const response = await fetch(`/api/admin/submissions/${id}/approve`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to approve");
}

async function rejectSubmission(id: string, reason: string): Promise<void> {
  const response = await fetch(`/api/admin/submissions/${id}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error("Failed to reject");
}

export function AdminApprovalsContent({
  initialData,
}: {
  initialData: ApprovalsResponse;
}) {
  // URL state: filters (rule 4 & 5)
  const [searchTerm, setSearchTerm] = useQueryState("search", {
    defaultValue: "",
  });
  const [statusFilter, setStatusFilter] = useQueryState("status", {
    defaultValue: "all",
  });
  const [typeFilter, setTypeFilter] = useQueryState("type", {
    defaultValue: "all",
  });

  // Ephemeral UI state: modals (rule 6)
  const [selectedSubmission, setSelectedSubmission] = useState<ContentSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const queryClient = useQueryClient();

  // React Query for submissions (rule 2 & 3)
  const { data, isLoading } = useQuery({
    queryKey: ["approvals", statusFilter, typeFilter, searchTerm],
    queryFn: async () => {
      return fetchSubmissions({
        status: statusFilter,
        content_type: typeFilter,
        search: searchTerm,
      });
    },
    initialData,
    staleTime: 30 * 1000,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: approveSubmission,
    onSuccess: () => {
      toast.success("Submission approved");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
    },
    onError: () => {
      toast.error("Failed to approve submission");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectSubmission(id, reason),
    onSuccess: () => {
      toast.success("Submission rejected");
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      setShowRejectModal(false);
      setRejectReason("");
    },
    onError: () => {
      toast.error("Failed to reject submission");
    },
  });

  const submissions = data?.data || [];

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { color: string; icon: React.ReactNode }> = {
      pending: {
        color: "bg-yellow-100 text-yellow-800",
        icon: <Clock className="w-4 h-4" />,
      },
      approved: {
        color: "bg-green-100 text-green-800",
        icon: <CheckCircle className="w-4 h-4" />,
      },
      rejected: {
        color: "bg-red-100 text-red-800",
        icon: <XCircle className="w-4 h-4" />,
      },
      revision_requested: {
        color: "bg-orange-100 text-orange-800",
        icon: <RotateCw className="w-4 h-4" />,
      },
    };
    return badges[status] || badges.pending;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Content Approvals
        </h1>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search submissions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="revision_requested">Revision Requested</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Types</option>
              <option value="article">Article</option>
              <option value="blog">Blog</option>
              <option value="news">News</option>
            </select>
          </div>
        </div>

        {/* Submissions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No submissions found
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-700">
                    Payment
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
                {submissions.map((submission) => {
                  const statusBadge = getStatusBadge(submission.status);

                  return (
                    <tr key={submission._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {submission.title}
                        </p>
                        {submission.word_count && (
                          <p className="text-sm text-gray-500">
                            {submission.word_count} words
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium">{submission.user.name}</p>
                        <p className="text-sm text-gray-500">
                          {submission.user.email}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                          {submission.content_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${statusBadge.color}`}
                        >
                          {statusBadge.icon}
                          {submission.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-600" />
                          <span className="font-medium">
                            KSh {submission.payment_amount.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">
                          {submission.payment_status}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {new Date(
                          submission.submission_date
                        ).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedSubmission(submission);
                              setShowDetailsModal(true);
                            }}
                            className="p-2 hover:bg-blue-100 rounded"
                          >
                            <Eye className="w-4 h-4 text-blue-600" />
                          </button>

                          {submission.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  approveMutation.mutate(submission._id)
                                }
                                disabled={approveMutation.isPending}
                                className="p-2 hover:bg-green-100 rounded disabled:opacity-50"
                              >
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setShowRejectModal(true);
                                }}
                                className="p-2 hover:bg-red-100 rounded"
                              >
                                <XCircle className="w-4 h-4 text-red-600" />
                              </button>
                            </>
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

        {/* Details Modal */}
        {showDetailsModal && selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-2xl max-h-96 overflow-y-auto">
              <h2 className="text-lg font-bold mb-4">{selectedSubmission.title}</h2>
              <div className="space-y-3 text-sm mb-6">
                <p>
                  <span className="text-gray-600">Author:</span>{" "}
                  {selectedSubmission.user.name} ({selectedSubmission.user.email})
                </p>
                <p>
                  <span className="text-gray-600">Type:</span>{" "}
                  {selectedSubmission.content_type}
                </p>
                <p>
                  <span className="text-gray-600">Status:</span>{" "}
                  {selectedSubmission.status}
                </p>
                <p>
                  <span className="text-gray-600">Payment:</span> KSh{" "}
                  {selectedSubmission.payment_amount.toLocaleString()}
                </p>
                {selectedSubmission.word_count && (
                  <p>
                    <span className="text-gray-600">Words:</span>{" "}
                    {selectedSubmission.word_count}
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
        {showRejectModal && selectedSubmission && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md">
              <h2 className="text-lg font-bold mb-4">Reject Submission</h2>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
                rows={4}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectReason("");
                  }}
                  className="flex-1 px-4 py-2 border rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    rejectMutation.mutate({
                      id: selectedSubmission._id,
                      reason: rejectReason,
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
      </div>
    </div>
  );
}
