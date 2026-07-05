// app/admin/components/AdminHeader.tsx
'use client';

import { useDashboard } from '@/app/dashboard/DashboardContext';
import { ThemeToggle } from '@/app/components/ThemeToggle';

export default function AdminHeader() {
  const { user } = useDashboard();

  return (
    <header className="bg-surface shadow-sm border-b border-border">
      <div className="flex justify-between items-center px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-heading">Admin Dashboard</h1>
          <p className="text-sm text-text-muted">Manage your platform efficiently</p>
        </div>
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          <div className="text-right">
            <p className="font-medium text-text">{user?.name || 'Admin User'}</p>
            <p className="text-sm text-text-muted">
              {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Administrator'}
            </p>
          </div>
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
