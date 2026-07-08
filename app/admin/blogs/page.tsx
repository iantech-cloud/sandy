'use client';

import { useState, useEffect } from 'react';
import { Search, Filter, AlertCircle, Edit, Trash2, Plus } from 'lucide-react';

interface Blog {
  _id: string;
  title: string;
  content: string;
  author: string;
  status: 'draft' | 'published' | 'archived';
  category: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

interface BlogsData {
  blogs: Blog[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
  stats: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
}

export default function BlogsPage() {
  const [data, setData] = useState<BlogsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    loadBlogs();
  }, [page, search, status]);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(search && { search }),
        ...(status && { status }),
      });

      const response = await fetch(`/api/admin/blogs?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch blogs');
      }

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError('Failed to load blogs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('[Admin] Blogs error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (blogId: string) => {
    if (!confirm('Are you sure you want to delete this blog?')) return;

    try {
      setProcessingId(blogId);
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete blog');
      }

      await loadBlogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete blog');
    } finally {
      setProcessingId(null);
    }
  };

  const handleStatusChange = async (blogId: string, newStatus: string) => {
    try {
      setProcessingId(blogId);
      const response = await fetch(`/api/admin/blogs/${blogId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update blog status');
      }

      await loadBlogs();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update blog');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
          <p className="mt-4 text-slate-600">Loading blogs...</p>
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
          onClick={loadBlogs}
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
          <h1 className="text-3xl font-bold text-slate-900">Blog Management</h1>
          <p className="text-slate-600 mt-1">
            Total: {data?.pagination.total.toLocaleString()} blogs
          </p>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Plus size={18} />
          New Blog
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{data.stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Published</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{data.stats.published}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Draft</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{data.stats.draft}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border border-slate-200">
            <p className="text-slate-600 text-sm">Archived</p>
            <p className="text-2xl font-bold text-slate-600 mt-1">{data.stats.archived}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search blogs..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Author
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Views
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.blogs && data.blogs.length > 0 ? (
                data.blogs.map((blog) => (
                  <tr
                    key={blog._id}
                    className="border-b border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900 max-w-xs truncate">
                        {blog.title}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">{blog.author}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={blog.status}
                        onChange={(e) => handleStatusChange(blog._id, e.target.value)}
                        disabled={processingId === blog._id}
                        className={`px-2 py-1 rounded text-sm font-medium border-0 cursor-pointer ${
                          blog.status === 'published'
                            ? 'bg-green-100 text-green-700'
                            : blog.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">{blog.views}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-600 text-sm">
                        {new Date(blog.createdAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="p-2 hover:bg-slate-100 rounded transition-colors">
                          <Edit size={16} className="text-blue-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(blog._id)}
                          disabled={processingId === blog._id}
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
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-600">
                    No blogs found
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
            Showing {data.blogs.length} of {data.pagination.total} blogs
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
