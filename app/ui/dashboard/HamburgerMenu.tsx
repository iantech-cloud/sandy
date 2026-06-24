'use client';

import React from 'react';
import { useState } from 'react';
import { Menu, X, BarChart, Wallet, Award, Users, Settings, HelpCircle, User as UserIcon, ShoppingBag, MessageCircle, ClipboardList, LogOut, History, TrendingUp, Briefcase, BookOpen, FileText, Zap, MapPin, Gift } from 'lucide-react';
// (UserIcon used for Profile entry; Settings icon used for Settings entry)
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HamburgerMenuProps {
  userName?: string;
  onLogout?: () => void;
}

export default function HamburgerMenu({ userName, onLogout }: HamburgerMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const tabs: { id: string; label: string; icon: React.ElementType; path: string; external?: boolean }[] = [
    { id: 'dashboard',        label: 'Dashboard',         icon: BarChart,      path: '/dashboard' },
    { id: 'wallet',           label: 'Wallet & Escrow',   icon: Wallet,        path: '/dashboard/wallet' },
    { id: 'transactions',     label: 'Transaction History', icon: History,     path: '/dashboard/transactions' },
    { id: 'earning-ways',     label: '💰 All Earning Ways', icon: TrendingUp,  path: '/dashboard/earnings-overview' },
    { id: 'freelance',        label: 'Freelance Jobs',    icon: Briefcase,     path: 'https://www.upwork.com', external: true },
    { id: 'tutoring',         label: 'Online Tutoring',   icon: BookOpen,      path: '/dashboard/tutoring' },
    { id: 'digital-products', label: 'Digital Products',  icon: FileText,      path: '/dashboard/digital-products' },
    { id: 'ai-tasks',         label: 'AI Tasks',          icon: Zap,           path: '/dashboard/ai-tasks' },
    { id: 'local-gigs',       label: 'Local Gigs',        icon: MapPin,        path: '/dashboard/local-gigs' },
    { id: 'surveys',          label: 'Surveys',           icon: Award,         path: '/dashboard/surveys' },
    { id: 'tasks',            label: 'Content Tasks',     icon: ClipboardList, path: '/dashboard/content' },
    { id: 'chat-foreigners',  label: 'Chat Foreigners',   icon: MessageCircle, path: '/dashboard/chat-foreigners' },
    { id: 'affiliate',        label: 'Affiliate Marketing', icon: ShoppingBag, path: '/dashboard/soko' },
    { id: 'referrals',        label: 'Referral Program',  icon: Gift,          path: '/dashboard/referrals' },
    { id: 'profile',          label: 'Profile',           icon: UserIcon,      path: '/dashboard/profile' },
    { id: 'support',          label: 'Help & Support',    icon: HelpCircle,    path: '/dashboard/support' },
    { id: 'settings',         label: 'Settings',          icon: Settings,      path: '/dashboard/settings' },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="lg:hidden">
      {/* Hamburger Button */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-3 bg-gradient-to-br from-purple-600 to-pink-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Hamburger Menu */}
      <nav
        className={`
          fixed inset-y-0 right-0 w-64 z-40 bg-white dark:bg-slate-900 shadow-2xl
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col pt-20 pb-6 px-4 overflow-y-auto">
          {/* User Info */}
          {userName && (
            <div className="mb-8 pb-4 border-b border-gray-200 dark:border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-md">
                  <UserIcon size={20} className="text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {userName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <div className="space-y-2 flex-1">
            {tabs.map(({ id, label, icon: Icon, path, external }: any) => {
              const active = !external && isActive(path);
              
              if (external) {
                return (
                  <a
                    key={id}
                    href={path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 font-medium text-sm text-gray-700 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400"
                  >
                    <Icon size={20} />
                    <span>{label}</span>
                    <svg className="ml-auto w-4 h-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                );
              }
              
              return (
                <Link
                  key={id}
                  href={path}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center space-x-3 px-4 py-3 rounded-lg
                    transition-all duration-200 font-medium text-sm
                    ${
                      active
                        ? 'bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 shadow-md'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                  {active && (
                    <div className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Logout Button */}
          {onLogout && (
            <div className="border-t border-gray-200 dark:border-slate-700 pt-4 mt-4">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onLogout();
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 font-semibold text-sm"
              >
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
