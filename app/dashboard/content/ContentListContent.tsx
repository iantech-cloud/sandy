"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  RotateCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  getUserContentSubmissions,
  deleteContentSubmission,
  ContentType,
  ContentStatus,
  PaymentStatus,
} from "@/app/actions/dashboard/content";

interface ContentSubmission {
  _id: string;
  title: string;
  content_type: ContentType;
  content_text: string;
  status: ContentStatus;
  payment_status: PaymentStatus;
  payment_amount: number;
  submission_date: string;
  task_category: string;
  admin_feedback?: string;
  revision_notes?: string;
  word_count?: number;
  tags?: string[];
  attachments?: string[];
  user_id: string;
  approved_at?: string;
  approved_by?: {
    _id: string;
    username?: string;
    name?: string;
    email?: string;
  };
}

interface ContentSubmissionsResponse {
  success: boolean;
  data?: ContentSubmission[];
  message?: string;
  totalPages?: number;
  currentPage?: number;
  totalCount?: number;
}

export function ContentListContent({
  initialData,
}: {
  initialData: ContentSubmissionsResponse;
}) {
  // URL state: search, filters, pagination (rules 4 & 5)
  const [searchTerm, setSearchTerm] = useQueryState("search", { defaultValue: "" });
  const [statusFilter, setStatusFilter] = useQueryState("status", { defaultValue: "all" });
  const [typeFilter, setTypeFilter] = useQueryState("type", { defaultValue: "all" });
  const [currentPage, setCurrentPage] = useQueryState("page", {
    defaultValue: "1",
    parse: (value) => parseInt(value, 10),
    serialize: (value) => value.toString(),
  });

  // Ephemeral UI state: local deletion modal (rule 6)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const queryClient = useQueryClient();

  // React Query for submissions with refetch capability (rule 2 & 3)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["submissions", currentPage, statusFilter, typeFilter],
    queryFn: async () => {
      const filters: Record<string, string | number | boolean> = {
        page: currentPage,
        limit: 10,
      };

      if (statusFilter !== "all") filters.status = statusFilter;
      if (typeFilter !== "all") filters.content_type = typeFilter;
      if (searchTerm) filters.search = searchTerm;

      const result = await getUserContentSubmissions(filters);
      return result;
    },
    initialData,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Delete mutation with automatic cache update
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteContentSubmission(id);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["submissions"] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const getStatusInfo = (status: ContentStatus) => {
    const statusMap: Record<
      ContentStatus,
      { color: string; icon: React.ReactNode; text: string }
    > = {
      approved: {
        color: "bg-green-100 text-green-800 border-green-200",
        icon: <CheckCircle className="w-4 h-4" />,
        text: "Approved",
      },
      pending: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: <Clock className="w-4 h-4" />,
        text: "Pending Review",
      },
      rejected: {
        color: "bg-red-100 text-red-800 border-red-200",
        icon: <XCircle className="w-4 h-4" />,
        text: "Rejected",
      },
      revision_requested: {
        color: "bg-orange-100 text-orange-800 border-orange-200",
        icon: <RotateCw className="w-4 h-4" />,
        text: "Revision Requested",
      },
    };

    return (
      statusMap[status] || {
        color: "bg-gray-100 text-gray-800 border-gray-200",
        icon: <Clock className="w-4 h-4" />,
        text: status,
      }
    );
  };

  const getPaymentStatusInfo = (status: PaymentStatus) => {
    const map: Record<PaymentStatus, { color: string; text: string }> = {
      paid: {
        color: "bg-green-100 text-green-800 border-green-200",
        text: "Paid",
      },
      pending: {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        text: "Pending",
      },
      failed: {
        color: "bg-red-100 text-red-800 border-red-200",
        text: "Failed",
      },
    };
    return map[status] || { color: "bg-gray-100", text: status };
  };

  const submissions = data?.data || [];
  const totalPages = data?.totalPages || 1;
  const totalCount = data?.totalCount || 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Content</h1>
            <p className="text-gray-500 mt-2">
              Manage your submitted content and track approvals
            </p>
          </div>
          <Link
            href="/dashboard/content/create"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            Create Content
          </Link>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by title..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="revision_requested">Revision Requested</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="article">Article</option>
                <option value="blog">Blog</option>
                <option value="news">News</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Filter className="w-4 h-4 inline mr-2" />
              Apply Filters
            </button>
          </form>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Error loading submissions: {error?.message || "Unknown error"}
          </div>
        )}

        {/* Content table */}
        {!isLoading && !isError && (
          <>
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {submissions.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p>No submissions found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Submitted
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {submissions.map((submission) => {
                      const statusInfo = getStatusInfo(submission.status);
                      const paymentInfo = getPaymentStatusInfo(
                        submission.payment_status
                      );

                      return (
                        <tr key={submission._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-gray-900">
                              {submission.title}
                            </p>
                            <p className="text-sm text-gray-500">
                              {submission.word_count} words
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-block px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800 rounded-full">
                              {submission.content_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-2 px-3 py-1 text-sm font-medium rounded-full border ${statusInfo.color}`}
                            >
                              {statusInfo.icon}
                              {statusInfo.text}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-3 py-1 text-sm font-medium rounded-full border ${paymentInfo.color}`}
                            >
                              {paymentInfo.text}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(submission.submission_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/dashboard/content/${submission._id}`}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                              >
                                <Eye className="w-4 h-4" />
                              </Link>
                              <Link
                                href={`/dashboard/content/${submission._id}/edit`}
                                className="p-2 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Edit className="w-4 h-4" />
                              </Link>
                              <button
                                onClick={() => setDeleteConfirm(submission._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  Showing page {currentPage} of {totalPages} ({totalCount} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setCurrentPage(Math.max(1, currentPage - 1))
                    }
                    disabled={currentPage === 1}
                    className="p-2 border rounded-lg disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = Math.max(
                      1,
                      currentPage - 2 + i
                    );
                    return (
                      pageNum <= totalPages && (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-2 rounded-lg ${
                            pageNum === currentPage
                              ? "bg-blue-600 text-white"
                              : "border hover:bg-gray-50"
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    );
                  })}
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
          </>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <AlertCircle className="w-12 h-12 text-red-600 mb-4" />
              <h2 className="text-lg font-bold mb-2">Delete Submission?</h2>
              <p className="text-gray-600 mb-6">
                This action cannot be undone. The submission will be permanently
                deleted.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  disabled={deleteMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Delete"
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
