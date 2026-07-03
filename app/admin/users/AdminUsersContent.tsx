'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  getAdminUsers,
  approveUserAccount,
  activateUserAccount,
  addUserSpins,
  updateUserStatus,
  resetUserLimits,
  getUserDetails,
} from '../../actions/user-management';

interface User {
  _id: string;
  username: string;
  email: string;
  phone_number: string;
  role: string;
  approval_status: string;
  status: string;
  is_active: boolean;
  is_approved: boolean;
  balance_cents: number;
  available_spins: number;
  total_earnings_cents: number;
  tasks_completed: number;
  created_at: string;
  activation_paid_at?: string;
  activation_transaction_id?: string;
  activation_method?: string;
  referral_id?: string;
  preferred_mpesa_number?: string;
  total_deposits_today_cents?: number;
  total_withdrawals_today_cents?: number;
}

interface UsersResponse {
  success: boolean;
  data?: User[];
  message?: string;
  stats?: {
    total: number;
    pendingApproval: number;
    unapproved: number;
    active: number;
    inactive: number;
  };
}

interface UserDetails {
  user: User;
  recentTransactions: any[];
  referral: any;
}

interface AdminUsersContentProps {
  initialUsers: User[];
  initialStats: UsersResponse['stats'];
}

export default function AdminUsersContent({
  initialUsers,
  initialStats,
}: AdminUsersContentProps) {
  // useState: ephemeral UI state - tab selection (rule 6)
  const [activeTab, setActiveTab] = useState('all');
  // useState: ephemeral UI state - search input (rule 6)
  const [searchTerm, setSearchTerm] = useState('');
  // useState: ephemeral UI state - action loading indicators (rule 6)
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // useState: ephemeral UI state - spins input values (rule 6)
  const [spinsAmount, setSpinsAmount] = useState<{ [key: string]: number }>({});
  // useState: ephemeral UI state - feedback messages (rule 6)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  // useState: ephemeral UI state - selected user modal (rule 6)
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  // useState: ephemeral UI state - modal visibility (rule 6)
  const [showUserDetails, setShowUserDetails] = useState(false);

  // React Query: fetches users with caching based on tab and search (rule 2)
  const { data: usersData = { users: initialUsers, stats: initialStats }, isPending: loading } = useQuery({
    queryKey: ['adminUsers', activeTab, searchTerm],
    queryFn: async () => {
      const result: UsersResponse = await getAdminUsers({ tab: activeTab, search: searchTerm });
      if (result.success) {
        return { users: result.data || [], stats: result.stats };
      }
      throw new Error(result.message || 'Failed to load users');
    },
    initialData: { users: initialUsers, stats: initialStats },
  });

  const handleApprove = async (userId: string) => {
    setActionLoading(`approve-${userId}`);
    setFeedback(null);

    try {
      const result = await approveUserAccount(userId);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
        // Refetch users to update the list
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to approve user' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: string) => {
    setActionLoading(`activate-${userId}`);
    setFeedback(null);

    try {
      const result = await activateUserAccount(userId);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to activate user' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSpins = async (userId: string) => {
    const amount = spinsAmount[userId] || 0;
    if (amount <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }

    setActionLoading(`spins-${userId}`);
    setFeedback(null);

    try {
      const result = await addUserSpins(userId, amount);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
        setSpinsAmount({ ...spinsAmount, [userId]: 0 });
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to add spins' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(`status-${userId}`);
    setFeedback(null);

    try {
      const result = await updateUserStatus(userId, newStatus);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to update status' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResetLimits = async (userId: string) => {
    setActionLoading(`reset-${userId}`);
    setFeedback(null);

    try {
      const result = await resetUserLimits(userId);
      if (result.success) {
        setFeedback({ type: 'success', message: result.message });
      } else {
        setFeedback({ type: 'error', message: result.message });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to reset limits' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetails = async (userId: string) => {
    try {
      const result = await getUserDetails(userId);
      if (result.success) {
        setSelectedUser(result.data);
        setShowUserDetails(true);
      } else {
        setFeedback({ type: 'error', message: 'Failed to load user details' });
      }
    } catch (error) {
      setFeedback({ type: 'error', message: 'Failed to load user details' });
    }
  };

  const { users, stats } = usersData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage user accounts, approvals, and activities</p>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedback && (
        <div
          className={`p-4 rounded-lg ${
            feedback.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Pending Approval</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pendingApproval}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Unapproved</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{stats.unapproved}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-gray-600 text-sm">Inactive</p>
            <p className="text-2xl font-bold text-gray-600 mt-1">{stats.inactive}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-4">
          {['all', 'pending_approval', 'unapproved', 'active', 'inactive'].map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSearchTerm('');
              }}
              className={`px-4 py-2 border-b-2 font-medium transition ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.replace(/_/g, ' ').toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search by username, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
          </div>
        </div>
      )}

      {/* Users Table */}
      {!loading && users.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Username</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Phone</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Balance</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-900">{user.username}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{user.phone_number}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        user.is_approved && user.is_active
                          ? 'bg-green-100 text-green-700'
                          : !user.is_approved
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {user.is_approved && user.is_active
                        ? 'Active'
                        : !user.is_approved
                        ? 'Pending'
                        : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    KES {(user.balance_cents / 100).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm space-y-2">
                    <button
                      onClick={() => handleViewDetails(user._id)}
                      className="block text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Details
                    </button>
                    {!user.is_approved && (
                      <button
                        onClick={() => handleApprove(user._id)}
                        disabled={actionLoading === `approve-${user._id}`}
                        className="block text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
                      >
                        {actionLoading === `approve-${user._id}` ? 'Approving...' : 'Approve'}
                      </button>
                    )}
                    {user.is_approved && !user.is_active && (
                      <button
                        onClick={() => handleActivate(user._id)}
                        disabled={actionLoading === `activate-${user._id}`}
                        className="block text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                      >
                        {actionLoading === `activate-${user._id}` ? 'Activating...' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-600">No users found</p>
        </div>
      )}

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedUser.user.username}</h2>
            <div className="space-y-3">
              <p>
                <span className="font-semibold text-gray-700">Email:</span> {selectedUser.user.email}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Phone:</span> {selectedUser.user.phone_number}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Balance:</span> KES{' '}
                {(selectedUser.user.balance_cents / 100).toLocaleString()}
              </p>
              <p>
                <span className="font-semibold text-gray-700">Tasks Completed:</span>{' '}
                {selectedUser.user.tasks_completed}
              </p>
            </div>
            <button
              onClick={() => setShowUserDetails(false)}
              className="mt-6 w-full px-4 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
