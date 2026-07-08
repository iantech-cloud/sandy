'use client';

import { useState, useEffect } from 'react';
import { Search, AlertCircle, Trash2 } from 'lucide-react';

interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'inactive' | 'banned';
  created_at: string;
  last_login?: string;
  account_balance: number;
}

interface UsersData {
  users: User[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  stats: {
    totalUsers: number;
    activeUsers: number;
    admins: number;
    totalBalance: number;
  };
}

export default function UsersPage() {
  const [data, setData] = useState<UsersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, [page, search, role, status]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(role && { role }),
        ...(status && { status }),
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load users');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    try {
      setProcessingId(userId);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setProcessingId(userId);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user role');
      }

      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;

    try {
      setProcessingId(userId);
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      await loadUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} className="text-red-600" />
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={loadUsers}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users Management</h1>
          <p className="text-slate-600 mt-1">
            Total: {data?.pagination.total.toLocaleString()} users
          </p>
        </div>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.stats.totalUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Active</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.stats.activeUsers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Admins</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{data.stats.admins}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Total Balance</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">KES {data.stats.totalBalance.toFixed(2)}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="banned">Banned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Username
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Balance (KES)
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.users && data.users.length > 0 ? (
                data.users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{user.username}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">{user.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user._id, e.target.value)}
                        disabled={processingId === user._id}
                        className={`px-2 py-1 rounded text-sm font-medium border-0 cursor-pointer ${
                          user.role === 'super_admin'
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'admin'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.status}
                        onChange={(e) => handleStatusChange(user._id, e.target.value)}
                        disabled={processingId === user._id}
                        className={`px-2 py-1 rounded text-sm font-medium border-0 cursor-pointer ${
                          user.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : user.status === 'banned'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="banned">Banned</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {user.account_balance?.toFixed(2) || '0.00'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(user._id)}
                          disabled={processingId === user._id}
                          className="p-2 hover:bg-slate-100 rounded transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-600">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            Showing {data.users.length} of {data.pagination.total} users
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(5, data.pagination.pages) }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
              disabled={page === data.pagination.pages}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
