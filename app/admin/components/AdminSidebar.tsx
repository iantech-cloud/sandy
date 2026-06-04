// app/admin/components/AdminSidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: '📊' },
  { name: 'User Management', href: '/admin/users', icon: '👥' },
  { name: 'Pending Approvals', href: '/admin/approvals', icon: '⏳' },
  { name: 'Withdrawals', href: '/admin/withdrawals', icon: '💰' },
  { name: 'Transactions', href: '/admin/transactions', icon: '💳' },
  { name: 'Referrals', href: '/admin/referrals', icon: '🔗' },
  { name: 'Audit Logs', href: '/admin/audit-logs', icon: '📝' },
];

const chatForeignersNav = [
  { name: 'Chat Foreigners', href: '/admin/chat-foreigners', icon: '💬' },
  { name: '  Bots', href: '/admin/chat-foreigners/bots', icon: '🤖' },
  { name: '  Users', href: '/admin/chat-foreigners/users', icon: '👤' },
  { name: '  Dashboard', href: '/admin/chat-foreigners/dashboard', icon: '📈' },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
      </div>
      <nav className="mt-6">
        <div className="px-4 space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-indigo-100 text-indigo-700 border-r-2 border-indigo-600'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </div>
        
        <div className="mt-8 px-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Chat Foreigners</p>
          <div className="space-y-2">
            {chatForeignersNav.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-green-100 text-green-700 border-r-2 border-green-600'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
