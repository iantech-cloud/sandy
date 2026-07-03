'use client';

import { useState, useEffect } from 'react';
import { MapPin, Plus, MapIcon, DollarSign } from 'lucide-react';

interface LocalGigsStats {
  gigsCompleted: number;
  activeListings: number;
  totalEarnings: number;
}

export default function LocalGigsPage() {
  const [stats, setStats] = useState<LocalGigsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/marketplace/local-gigs');
        if (!response.ok) throw new Error('Failed to load stats');
        const data = await response.json();
        setStats({
          gigsCompleted: data.data?.gigsCompleted || 0,
          activeListings: data.data?.activeListings || 0,
          totalEarnings: data.data?.totalEarnings || 0,
        });
      } catch (error) {
        console.error('[v0] Failed to load local gigs stats:', error);
        setStats({ gigsCompleted: 0, activeListings: 0, totalEarnings: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  const displayStats = [
    { label: 'Gigs Completed', value: loading ? '...' : stats?.gigsCompleted.toString() || '0', icon: MapIcon },
    { label: 'Active Listings', value: loading ? '...' : stats?.activeListings.toString() || '0', icon: MapPin },
    { label: 'Total Earnings', value: loading ? '...' : `KES ${(stats?.totalEarnings || 0).toLocaleString()}`, icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
          Local Gigs
        </h1>
        <button className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all">
          <Plus className="w-5 h-5" />
          Offer Gig
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
                <Icon className="w-5 h-5 text-cyan-600" />
              </div>
              <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Gigs */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Your Active Gigs</h2>
        <div className="text-center py-12 text-gray-500">
          <MapPin className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>No active gigs. Start offering your local services today!</p>
        </div>
      </div>
    </div>
  );
}
