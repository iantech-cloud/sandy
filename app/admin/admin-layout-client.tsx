// app/admin/admin-layout-client.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Session } from 'next-auth';
import { signOut } from 'next-auth/react';
import {
  Menu,
  X,
  Home,
  Users,
  CreditCard,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  ChevronLeft,
  BarChart3,
  CheckCircle,
  MessageSquare,
  ShoppingCart,
  Building2,
  Clock,
} from 'lucide-react';

interface AdminLayoutClientProps {
  children: React.ReactNode;
  session: Session;
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size: number; className?: string }>;
  category?: string;
}

const NAVIGATION_ITEMS: NavItem[] = [
  {
    category: 'Core',
    href: '/admin',
    label: 'Dashboard',
    icon: Home,
  },
  {
    category: 'User Management',
    href: '/admin/users',
    label: 'Users',
    icon: Users,
  },
  {
    category: 'User Management',
    href: '/admin/approvals',
    label: 'Pending Approvals',
    icon: CheckCircle,
  },
  {
    category: 'Financial',
    href: '/admin/transactions',
    label: 'Transactions',
    icon: CreditCard,
  },
  {
    category: 'Financial',
    href: '/admin/withdrawals',
    label: 'Withdrawals',
    icon: TrendingUp,
  },
  {
    category: 'Financial',
    href: '/admin/reports',
    label: 'Financial Reports',
    icon: BarChart3,
  },
  {
    category: 'Content',
    href: '/admin/blogs',
    label: 'Blogs',
    icon: FileText,
  },
  {
    category: 'Content',
    href: '/admin/surveys',
    label: 'Surveys',
    icon: MessageSquare,
  },
  {
    category: 'Operations',
    href: '/admin/spin-management',
    label: 'Spin Wheel',
    icon: BarChart3,
  },
  {
    category: 'Operations',
    href: '/admin/soko',
    label: 'Marketplace',
    icon: ShoppingCart,
  },
  {
    category: 'System',
    href: '/admin/audit-logs',
    label: 'Audit Logs',
    icon: Clock,
  },
  {
    category: 'System',
    href: '/admin/settings',
    label: 'Settings',
    icon: Settings,
  },
];

export default function AdminLayoutClient({
  children,
  session,
}: AdminLayoutClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const isActive = useCallback(
    (href: string) => {
      if (href === '/admin') {
        return pathname === '/admin';
      }
      return pathname.startsWith(href);
    },
    [pathname]
  );

  const handleSignOut = async () => {
    await signOut({ redirect: true, callbackUrl: '/auth/login' });
  };

  const groupedNavItems = NAVIGATION_ITEMS.reduce(
    (acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, NavItem[]>
  );

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white shadow-sm z-40 border-b border-slate-200 flex items-center px-4">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} className="text-slate-700" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 flex-1 text-center">
          Admin Panel
        </h1>
        <div className="w-10" />
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-40 transform transition-transform duration-300 ease-out
          lg:relative lg:translate-x-0 lg:shadow-md lg:z-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Section */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 lg:mt-0 mt-16">
            <div className="flex-1">
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Admin
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {session?.user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </p>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 hover:bg-slate-100 rounded transition-colors"
              aria-label="Close menu"
            >
              <X size={20} className="text-slate-600" />
            </button>
          </div>

          {/* User Info */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-xs text-slate-600 truncate">
              {session?.user?.name || session?.user?.email}
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-6">
            {Object.entries(groupedNavItems).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 mb-2">
                  {category}
                </h3>
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center px-3 py-2 rounded-lg transition-all duration-200
                          ${
                            active
                              ? 'bg-blue-100 text-blue-700 font-semibold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }
                        `}
                      >
                        <Icon
                          size={18}
                          className="mr-3 flex-shrink-0"
                        />
                        <span className="text-sm">{item.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 space-y-2 bg-slate-50">
            <a
              href="/dashboard"
              className="flex items-center justify-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={16} className="mr-2" />
              Back to Dashboard
            </a>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 lg:p-8 mt-16 lg:mt-0">
          <div className="max-w-7xl mx-auto">{children}</div>
        </div>
      </main>
    </div>
  );
}
