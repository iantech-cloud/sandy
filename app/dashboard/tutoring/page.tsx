'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Clock, Users as UsersIcon, AlertCircle } from 'lucide-react';

interface TutoringStats {
  scheduledSessions: number;
  totalStudents: number;
  earnings: number;
}

export default function TutoringPage() {
  const [stats, setStats] = useState<TutoringStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/marketplace/tutoring');
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setStats({
          scheduledSessions: data.data?.scheduledSessions || 0,
          totalStudents: data.data?.totalStudents || 0,
          earnings: data.data?.earnings || 0,
        });
      } catch (error) {
        console.error('[v0] Failed to load tutoring stats:', error);
        setStats({ scheduledSessions: 0, totalStudents: 0, earnings: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const displayStats = [
    { label: 'Scheduled Sessions', value: loading ? '...' : stats?.scheduledSessions.toString() || '0', icon: Clock },
    { label: 'Total Students', value: loading ? '...' : stats?.totalStudents.toString() || '0', icon: UsersIcon },
    { label: 'Earnings', value: loading ? '...' : `KES ${(stats?.earnings || 0).toLocaleString()}`, icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-teal-600 bg-clip-text text-transparent">
          Online Tutoring
        </h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
          <Plus className="w-5 h-5" />
          Offer Tutoring
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
                <Icon className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Scheduled Sessions</h2>
        <div className="text-center py-12 text-gray-500">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No sessions scheduled yet. Offer your tutoring services!</p>
        </div>
      </div>
    </div>
  );
}
