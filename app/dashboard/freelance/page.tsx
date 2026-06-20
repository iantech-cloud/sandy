'use client';

import { useState, useEffect } from 'react';
import { Briefcase, Plus, TrendingUp, Users, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface FreelanceStats {
  activeJobs: number;
  totalEarned: number;
  completionRate: number;
}

export default function FreelancePage() {
  const [stats, setStats] = useState<FreelanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/marketplace/freelance');
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setStats({
          activeJobs: data.data?.activeJobs || 0,
          totalEarned: data.data?.totalEarned || 0,
          completionRate: data.data?.completionRate || 0,
        });
      } catch (error) {
        console.error('[v0] Failed to load freelance stats:', error);
        setStats({ activeJobs: 0, totalEarned: 0, completionRate: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const displayStats = [
    { label: 'Active Jobs', value: loading ? '...' : stats?.activeJobs.toString() || '0', icon: Briefcase },
    { label: 'Total Earned', value: loading ? '...' : `KES ${(stats?.totalEarned || 0).toLocaleString()}`, icon: TrendingUp },
    { label: 'Completion Rate', value: loading ? '...' : `${stats?.completionRate || 0}%`, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Freelance Jobs
        </h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
          <Plus className="w-5 h-5" />
          Post Job
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {displayStats.map((stat, idx) => {
          const Icon = stat.icon as any;
          return (
            <div key={idx} className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-gray-600 font-medium">{stat.label}</p>
                <Icon className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Available Jobs */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available Freelance Jobs</h2>
        <div className="text-center py-12 text-gray-500">
          <Briefcase className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No jobs available yet. Check back soon!</p>
        </div>
      </div>
    </div>
  );
}
