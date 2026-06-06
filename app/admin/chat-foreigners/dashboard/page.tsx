'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, DollarSign, TrendingUp } from 'lucide-react';

interface Analytics {
  totalUsers: number;
  totalPersons: number;
  totalPersonUnlocks: number;
  totalMessages: number;
  totalRevenue: number;
  averageUnlockPrice: number;
  topPersons: Array<{ name: string; unlocks: number; revenue: number }>;
  recentActivity: Array<{
    id: string;
    type: 'unlock' | 'message' | 'payment';
    description: string;
    timestamp: string;
  }>;
}

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      // Fetch persons with access data included
      const personsRes = await fetch('/api/chat-foreigners/bots?includeAccess=true');
      const personsData = await personsRes.json();

      if (personsData.success) {
        const persons = personsData.data || [];
        const totalPersonUnlocks = persons.reduce((sum: number, p: any) =>
          sum + ((p.userAccess || []).length), 0);
        const totalMessages = persons.reduce((sum: number, p: any) =>
          sum + (p.userAccess || []).reduce((msgSum: number, a: any) =>
            msgSum + (a.messageCount || 0), 0), 0);
        const totalRevenue = persons.reduce((sum: number, p: any) =>
          sum + (p.userAccess || []).length * (p.unlockPrice || 60), 0);
        const topPersons = persons
          .map((p: any) => ({
            name: p.name,
            unlocks: (p.userAccess || []).length,
            revenue: (p.userAccess || []).length * (p.unlockPrice || 60),
          }))
          .sort((a: any, b: any) => b.unlocks - a.unlocks)
          .slice(0, 5);

        setAnalytics({
          totalUsers: 0,
          totalPersons: persons.length,
          totalPersonUnlocks,
          totalMessages,
          totalRevenue,
          averageUnlockPrice: persons.length > 0
            ? persons.reduce((sum: number, p: any) => sum + (p.unlockPrice || 60), 0) / persons.length
            : 60,
          topPersons,
          recentActivity: [],
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="p-8 text-center">Failed to load analytics data.</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-600 mt-1">Chat Foreigners platform metrics and insights</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Total Persons</h3>
            <MessageSquare className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalPersons}</p>
          <p className="text-sm text-gray-600 mt-2">Active personality profiles</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Total Unlocks</h3>
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalPersonUnlocks}</p>
          <p className="text-sm text-gray-600 mt-2">Person unlock transactions</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Total Messages</h3>
            <Users className="w-6 h-6 text-purple-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalMessages}</p>
          <p className="text-sm text-gray-600 mt-2">Messages exchanged</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Revenue</h3>
            <DollarSign className="w-6 h-6 text-orange-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">KSh {analytics.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-2">Actual from unlocks</p>
        </div>
      </div>

      {/* Top Persons */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Personalities</h2>
        <div className="space-y-3">
          {analytics.topPersons.length === 0 ? (
            <p className="text-gray-600">No performance data available yet.</p>
          ) : (
            analytics.topPersons.map((person, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{person.name}</p>
                    <p className="text-sm text-gray-600">{person.unlocks} unlocks</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    KSh {person.revenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-600">Revenue</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Engagement Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Avg. Unlock Price</span>
              <span className="font-medium">KSh {analytics.averageUnlockPrice.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Messages per Unlock</span>
              <span className="font-medium">
                {analytics.totalPersonUnlocks > 0
                  ? (analytics.totalMessages / analytics.totalPersonUnlocks).toFixed(1)
                  : '0'}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600 font-medium">Platform Health</span>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Good
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Active Personalities</span>
              <span className="font-medium">{analytics.totalPersons}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Unlocks</span>
              <span className="font-medium">{analytics.totalPersonUnlocks}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600 font-medium">Total Revenue</span>
              <span className="font-bold">KSh {analytics.totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
