'use client';

import Link from 'next/link';
import { BarChart3, Users, Settings } from 'lucide-react';

export default function ChatForeignersAdminPage() {
  const sections = [
    {
      title: 'Persons Management',
      description: 'Create, edit, and manage foreign personalities with custom profiles and settings',
      href: '/admin/chat-foreigners/bots',
      icon: <BarChart3 className="w-8 h-8" />,
      color: 'bg-blue-500',
    },
    {
      title: 'User Management',
      description: 'View and manage chat foreigners users, their access, and status',
      href: '/admin/chat-foreigners/users',
      icon: <Users className="w-8 h-8" />,
      color: 'bg-purple-500',
    },
    // Analytics Dashboard disabled due to API limit - {
    //   title: 'Analytics Dashboard',
    //   description: 'View key metrics, revenue, user engagement, and personality performance',
    //   href: '/admin/chat-foreigners/dashboard',
    //   icon: <Settings className="w-8 h-8" />,
    //   color: 'bg-green-500',
    // },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Chat Foreigners Admin</h1>
        <p className="text-gray-600 mt-2">Manage persons, users, and view analytics for the chat platform</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border border-gray-200"
          >
            <div className={`${section.color} text-white p-3 rounded-lg w-fit mb-4`}>
              {section.icon}
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{section.title}</h2>
            <p className="text-gray-600 text-sm">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
