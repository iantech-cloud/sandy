'use client';

import React from 'react';
import { Wallet, Award, HelpCircle, Settings, BarChart, User as UserIcon, MessageCircle, ClipboardList, Gift, History, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function NavLinks() {
  const pathname = usePathname();

  const links = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart },
    { name: 'Wallet & Escrow', href: '/dashboard/wallet', icon: Wallet },
    { name: 'Transaction History', href: '/dashboard/transactions', icon: History },
    
    // Earning Opportunities
    { name: 'Surveys', href: '/dashboard/surveys', icon: Award },
    { name: 'Content Tasks', href: '/dashboard/content', icon: ClipboardList },
    { name: 'Chat Foreigners', href: '/dashboard/chat-foreigners', icon: MessageCircle },
    { name: 'Freelance Jobs', href: 'https://www.upwork.com', icon: Briefcase, external: true },
    
    // Monetization
    { name: 'Referral Program', href: '/dashboard/referrals', icon: Gift },
    
    // Account
    { name: 'Profile', href: '/dashboard/profile', icon: UserIcon },
    { name: 'Help & Support', href: '/dashboard/support', icon: HelpCircle },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = !link.external && pathname === link.href;
        const isExternal = link.external;

        return isExternal ? (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-[48px] grow items-center justify-center gap-2 rounded-md bg-gray-50 p-3 text-sm font-medium hover:bg-sky-100 hover:text-blue-600 md:flex-none md:justify-start md:p-2 md:px-3"
          >
            <Icon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </a>
        ) : (
          <Link
            key={link.name}
            href={link.href}
            className={`flex h-[48px] grow items-center justify-center gap-2 rounded-md p-3 text-sm font-medium md:flex-none md:justify-start md:p-2 md:px-3 ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'bg-gray-50 text-gray-900 hover:bg-sky-100 hover:text-blue-600'
            }`}
          >
            <Icon className="w-6" />
            <p className="hidden md:block">{link.name}</p>
          </Link>
        );
      })}
    </>
  );
}

