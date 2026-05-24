'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, Check } from 'lucide-react';
import Link from 'next/link';

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

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch unread notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/notifications/unread', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNotifications(result.notifications || []);
          setUnreadCount(result.unreadCount || 0);
        }
      }
    } catch (error) {
      console.error('[Notifications] Error fetching:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch notifications when component mounts
  useEffect(() => {
    fetchNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle marking notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNotifications(prev =>
            prev.map(n => n._id === notificationId ? { ...n, read: true } : n)
          );
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('[Notifications] Error marking as read:', error);
    }
  };

  // Handle marking all as read
  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          setUnreadCount(0);
        }
      }
    } catch (error) {
      console.error('[Notifications] Error marking all as read:', error);
    }
  };

  // Handle deleting notification
  const handleDelete = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setNotifications(prev => prev.filter(n => n._id !== notificationId));
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('[Notifications] Error deleting:', error);
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
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="relative z-40">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all duration-200 flex-shrink-0 z-40"
        title="Notifications"
        type="button"
      >
        <Bell size={18} className="lg:w-6 lg:h-6" />
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-red-500 to-red-600 rounded-full">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop to close dropdown - Higher z-index than panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[998]"
          onClick={() => setIsOpen(false)}
          role="presentation"
        />
      )}

      {/* Dropdown Notification Panel - Mobile Responsive */}
      {isOpen && (
        <div className="fixed sm:absolute inset-x-0 sm:inset-auto top-auto sm:top-12 left-0 sm:left-auto right-0 bottom-0 sm:bottom-auto sm:right-0 sm:mt-2 w-full sm:w-96 bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 z-[999] max-h-96 flex flex-col sm:max-h-96">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-t-2xl sm:rounded-t-2xl">
            <h3 className="font-semibold text-slate-900">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hidden sm:flex items-center space-x-1"
                  title="Mark all as read"
                >
                  <Check size={16} />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X size={18} className="text-slate-600" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin">
                  <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                </div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-3 sm:p-4 hover:bg-slate-50 transition-colors ${
                      !notification.read ? 'bg-blue-50/50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm line-clamp-1">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <span className="inline-block w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        
                        <p className="text-slate-600 text-xs sm:text-sm mt-1 line-clamp-2">
                          {notification.message}
                        </p>

                        {notification.referral_user_name && (
                          <p className="text-xs text-slate-500 mt-1">
                            {notification.referral_user_name}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2 flex-wrap gap-1">
                          <span className="text-xs text-slate-500">
                            {formatTime(notification.created_at)}
                          </span>
                          
                          {notification.action_url && (
                            <Link
                              href={notification.action_url}
                              onClick={() => {
                                if (!notification.read) {
                                  handleMarkAsRead(notification._id);
                                }
                                setIsOpen(false);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              View
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {!notification.read && (
                          <button
                            onClick={() => handleMarkAsRead(notification._id)}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="Mark as read"
                          >
                            <Check size={14} className="sm:w-4 sm:h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <X size={14} className="sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer - View All Link */}
          {notifications.length > 0 && (
            <div className="border-t border-slate-100 p-3 bg-slate-50 rounded-b-2xl sm:rounded-b-2xl">
              <Link
                href="/dashboard/notifications"
                onClick={() => setIsOpen(false)}
                className="block text-center text-xs sm:text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View All Notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
