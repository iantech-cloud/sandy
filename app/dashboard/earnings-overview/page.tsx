'use client';

import { TrendingUp, BarChart3, Wallet, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface EarningStream {
  title: string;
  description: string;
  commission: string;
  potential: string;
  icon: string;
  path: string;
  color: string;
}

const earningStreams: EarningStream[] = [
  {
    title: 'Freelance Jobs',
    description: 'Complete projects for clients',
    commission: 'Keep 85-90%',
    potential: 'KES 5,000-50,000+',
    path: '/dashboard/freelance',
    color: 'from-blue-600 to-cyan-600',
    icon: '💼',
  },
  {
    title: 'Online Tutoring',
    description: 'Teach and earn per session',
    commission: 'Keep 85%',
    potential: 'KES 500-5,000/hour',
    path: '/dashboard/tutoring',
    color: 'from-green-600 to-teal-600',
    icon: '📚',
  },
  {
    title: 'Digital Products',
    description: 'Sell notes, templates, ebooks',
    commission: 'Keep 75-95%',
    potential: 'KES 100-10,000+/sale',
    path: '/dashboard/digital-products',
    color: 'from-pink-600 to-rose-600',
    icon: '📄',
  },
  {
    title: 'AI Tasks',
    description: 'Data labeling and annotation',
    commission: 'Keep 80%',
    potential: 'KES 10-500/task',
    path: '/dashboard/ai-tasks',
    color: 'from-yellow-600 to-orange-600',
    icon: '⚡',
  },
  {
    title: 'Local Gigs',
    description: 'Offer services in your area',
    commission: 'Keep 85%',
    potential: 'KES 1,000-10,000/gig',
    path: '/dashboard/local-gigs',
    color: 'from-cyan-600 to-blue-600',
    icon: '📍',
  },
  {
    title: 'Content Creation',
    description: 'Submit content & tasks',
    commission: 'Keep 80-90%',
    potential: 'KES 100-5,000+',
    path: '/dashboard/content',
    color: 'from-purple-600 to-indigo-600',
    icon: '✍️',
  },
  {
    title: 'Surveys',
    description: 'Complete paid surveys',
    commission: 'Keep 90-100%',
    potential: 'KES 50-500/survey',
    path: '/dashboard/surveys',
    color: 'from-emerald-600 to-green-600',
    icon: '📋',
  },
  {
    title: 'Affiliate Marketing',
    description: 'Earn commissions on referrals',
    commission: 'Keep 60-80%',
    potential: 'KES 500-100,000+',
    path: '/dashboard/soko',
    color: 'from-red-600 to-orange-600',
    icon: '🔗',
  },
  {
    title: 'Referral Bonuses',
    description: 'Earn when friends join',
    commission: '100% bonus',
    potential: 'KES 50-500/referral',
    path: '/dashboard/referrals',
    color: 'from-amber-600 to-yellow-600',
    icon: '🎁',
  },
];

export default function EarningsOverviewPage() {
  const totalPotential = 'KES 8,000,000+/year';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          9 Ways to Earn Money
        </h1>
        <p className="text-gray-600">
          Choose one or combine multiple earning streams to maximize your income
        </p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-green-900 font-semibold">Total Earning Streams</p>
            <BarChart3 className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-3xl font-bold text-green-600">9</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-blue-900 font-semibold">Your Commission</p>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-blue-600">75-100%</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-purple-900 font-semibold">Annual Potential</p>
            <Wallet className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-3xl font-bold text-purple-600">Unlimited</p>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-semibold text-blue-900">Multiple Income Streams</p>
          <p className="text-sm text-blue-700">
            You can participate in multiple earning streams simultaneously. Start with one and grow from there!
          </p>
        </div>
      </div>

      {/* Earning Streams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {earningStreams.map((stream, idx) => (
          <Link
            key={idx}
            href={stream.path}
            className="group"
          >
            <div className={`
              bg-gradient-to-br ${stream.color} rounded-xl p-6 text-white shadow-lg 
              hover:shadow-xl transition-all duration-300 group-hover:scale-105 h-full
              flex flex-col justify-between cursor-pointer relative overflow-hidden
            `}>
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-black/0 group-hover:from-white/10 group-hover:to-black/10 transition-all duration-300"></div>
              
              <div className="relative z-10">
                <p className="text-4xl mb-3">{stream.icon}</p>
                <h3 className="text-xl font-bold mb-1">{stream.title}</h3>
                <p className="text-white/90 text-sm mb-4">{stream.description}</p>
              </div>

              <div className="relative z-10 space-y-2">
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wider">Your Commission</p>
                  <p className="font-bold text-lg">{stream.commission}</p>
                </div>
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-wider">Earning Potential</p>
                  <p className="font-bold text-lg">{stream.potential}</p>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 text-white/50 group-hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Call to Action */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl p-8 text-white text-center">
        <h2 className="text-2xl font-bold mb-3">Start Earning Today</h2>
        <p className="mb-6 text-blue-100">
          Choose your first earning stream from the list above and start building your income
        </p>
        <Link
          href="/dashboard/wallet"
          className="inline-block bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
        >
          View Your Wallet & Escrow
        </Link>
      </div>
    </div>
  );
}
