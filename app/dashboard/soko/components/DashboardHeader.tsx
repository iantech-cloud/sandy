// app/dashboard/soko/components/DashboardHeader.tsx
'use client';

import { ThemeToggle } from '@/app/components/ThemeToggle';

export default function DashboardHeader() {
  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 rounded-xl p-6 sm:p-8 text-white">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold mb-2">Soko Affiliate Dashboard</h1>
          <p className="text-blue-100 text-sm sm:text-base">Promote products and earn commissions</p>
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
}
