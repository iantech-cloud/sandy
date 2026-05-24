'use client';

import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Trash2, Archive } from 'lucide-react';
import Link from 'next/link';
import { getAllNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification } from '@/app/actions/notifications';
import Alert from '@/app/ui/Alert';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  referral_user_name?: string;
  action_url?: string;
  created_at: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread'>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  const ITEMS_PER_PAGE = 20;

  // Fetch notifications
  useEffect(() => {
    fetchNotifications();
  }, [currentPage, selectedFilter]);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const skip = (currentPage - 1) * ITEMS_PER_PAGE;
      const result = await getAllNotifications(ITEMS_PER_PAGE, skip);

      if (result.success) {
        let filtered = result.notifications || [];
        if (selectedFilter === 'unread') {
          filtered = filtered.filter(n => !n.read);
        }
        setNotifications(filtered);
        setTotalNotifications(result.total || 0);
        setTotalPages(Math.ceil((result.total || 0) / ITEMS_PER_PAGE));
      } else {
        setMessage(result.message || 'Failed to fetch notifications');
        setMessageType('error');
      }
    } catch (error) {
      console.error('[v0] Error fetching notifications:', error);
      setMessage('An error occurred while fetching notifications');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const result = await markNotificationAsRead(notificationId);
      if (result.success) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
        );
        setMessage('Notification marked as read');
        setMessageType('success');
      } else {
        setMessage(result.message || 'Failed to mark notification as read');
        setMessageType('error');
      }
    } catch (error) {
      console.error('[v0] Error marking notification as read:', error);
      setMessage('An error occurred');
      setMessageType('error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllNotificationsAsRead();
      if (result.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setMessage('All notifications marked as read');
        setMessageType('success');
      } else {
        setMessage(result.message || 'Failed to mark all as read');
        setMessageType('error');
      }
    } catch (error) {
      console.error('[v0] Error marking all as read:', error);
      setMessage('An error occurred');
      setMessageType('error');
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      const result = await deleteNotification(notificationId);
      if (result.success) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        setMessage('Notification deleted');
        setMessageType('success');
      } else {
        setMessage(result.message || 'Failed to delete notification');
        setMessageType('error');
      }
    } catch (error) {
      console.error('[v0] Error deleting notification:', error);
      setMessage('An error occurred');
      setMessageType('error');
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-600 mt-1">
                {totalNotifications} total • {unreadCount} unread
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              <Check size={16} />
              Mark all as read
            </button>
          )}
        </div>

        {message && (
          <Alert
            type={messageType}
            message={message}
            onClose={() => setMessage(null)}
          />
        )}

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => {
              setSelectedFilter('all');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All Notifications
          </button>
          <button
            onClick={() => {
              setSelectedFilter('unread');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedFilter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin">
                <div className="h-8 w-8 border-3 border-blue-500 border-t-transparent rounded-full"></div>
              </div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell size={48} className="mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500 text-lg mb-2">
                {selectedFilter === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'}
              </p>
              <p className="text-gray-400 text-sm">
                {selectedFilter === 'unread'
                  ? 'You&apos;re all caught up!'
                  : 'Notifications will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification._id}
                  className={`p-4 md:p-6 hover:bg-gray-50 transition-colors ${
                    !notification.read ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Notification Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm md:text-base font-semibold text-gray-900">
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                        )}
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        {notification.message}
                      </p>

                      {notification.referral_user_name && (
                        <p className="text-xs text-gray-500 mb-3">
                          User: {notification.referral_user_name}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs text-gray-500">
                          {formatTime(notification.created_at)}
                        </span>

                        {notification.action_url && (
                          <Link
                            href={notification.action_url}
                            onClick={() => {
                              if (!notification.read) {
                                handleMarkAsRead(notification._id);
                              }
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium underline"
                          >
                            View Details
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {!notification.read && (
                        <button
                          onClick={() => handleMarkAsRead(notification._id)}
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Mark as read"
                        >
                          <Check size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notification._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t bg-gray-50 px-4 md:px-6 py-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
