'use client';

import { useState, useEffect } from 'react';
import { Zap, Plus, CheckCircle, BarChart3, AlertCircle } from 'lucide-react';

interface AITasksStats {
  completedTasks: number;
  accuracyRate: number;
  earnings: number;
}

export default function AITasksPage() {
  const [stats, setStats] = useState<AITasksStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/marketplace/ai-tasks');
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setStats({
          completedTasks: data.data?.completedTasks || 0,
          accuracyRate: data.data?.accuracyRate || 0,
          earnings: data.data?.earnings || 0,
        });
      } catch (error) {
        console.error('[v0] Failed to load AI tasks stats:', error);
        setStats({ completedTasks: 0, accuracyRate: 0, earnings: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const displayStats = [
    { label: 'Completed Tasks', value: loading ? '...' : stats?.completedTasks.toString() || '0', icon: CheckCircle },
    { label: 'Accuracy Rate', value: loading ? '...' : `${stats?.accuracyRate || 0}%`, icon: BarChart3 },
    { label: 'Earnings', value: loading ? '...' : `KES ${(stats?.earnings || 0).toLocaleString()}`, icon: Zap },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
          AI Tasks Marketplace
        </h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
          <Plus className="w-5 h-5" />
          Browse Tasks
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
                <Icon className="w-5 h-5 text-yellow-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Available Tasks */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Available AI Tasks</h2>
        <div className="text-center py-12 text-gray-500">
          <Zap className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>Loading available tasks... Check back soon!</p>
        </div>
      </div>
    </div>
  );
}
