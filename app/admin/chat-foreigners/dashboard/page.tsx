'use client';

import { useState, useEffect } from 'react';
import { Users, MessageSquare, DollarSign, TrendingUp } from 'lucide-react';

interface Analytics {
  totalUsers: number;
  totalBots: number;
  totalBotUnlocks: number;
  totalMessages: number;
  totalRevenue: number;
  averageUnlockPrice: number;
  topBots: Array<{ name: string; unlocks: number }>;
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
      // Fetch bots
      const botsRes = await fetch('/api/chat-foreigners/bots');
      const botsData = await botsRes.json();
      
      // Fetch wallet data for revenue
      const walletRes = await fetch('/api/chat-foreigners/wallet');
      const walletData = await walletRes.json();

      if (botsData.success) {
        const bots = botsData.data || [];
        const totalBotUnlocks = bots.reduce((sum: number, bot: any) => 
          sum + ((bot.userAccess || []).length || 0), 0);
        const totalMessages = bots.reduce((sum: number, bot: any) => 
          sum + (bot.userAccess || []).reduce((msgSum: number, access: any) => 
            msgSum + (access.messageCount || 0), 0), 0);
        const totalRevenue = totalBotUnlocks * 90; // Assuming 90 KSh per unlock
        const topBots = bots
          .map((bot: any) => ({
            name: bot.name,
            unlocks: (bot.userAccess || []).length,
          }))
          .sort((a: any, b: any) => b.unlocks - a.unlocks)
          .slice(0, 5);

        setAnalytics({
          totalUsers: 0, // Would need separate API
          totalBots: bots.length,
          totalBotUnlocks,
          totalMessages,
          totalRevenue,
          averageUnlockPrice: bots.length > 0 
            ? bots.reduce((sum: number, bot: any) => sum + (bot.unlockPrice || 60), 0) / bots.length
            : 60,
          topBots,
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
            <h3 className="text-gray-600 font-medium">Total Bots</h3>
            <MessageSquare className="w-6 h-6 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalBots}</p>
          <p className="text-sm text-gray-600 mt-2">Active bot profiles</p>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-gray-600 font-medium">Total Unlocks</h3>
            <TrendingUp className="w-6 h-6 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{analytics.totalBotUnlocks}</p>
          <p className="text-sm text-gray-600 mt-2">Bot unlock transactions</p>
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
          <p className="text-sm text-gray-600 mt-2">Estimated from unlocks</p>
        </div>
      </div>

      {/* Top Bots */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Bots</h2>
        <div className="space-y-3">
          {analytics.topBots.length === 0 ? (
            <p className="text-gray-600">No bot performance data available yet.</p>
          ) : (
            analytics.topBots.map((bot, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <div>
                    <p className="font-medium text-gray-900">{bot.name}</p>
                    <p className="text-sm text-gray-600">{bot.unlocks} unlocks</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">
                    KSh {(bot.unlocks * 90).toLocaleString()}
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
                {analytics.totalBotUnlocks > 0 
                  ? (analytics.totalMessages / analytics.totalBotUnlocks).toFixed(1)
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
              <span className="text-gray-600">Active Bots</span>
              <span className="font-medium">{analytics.totalBots}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total Unlocks</span>
              <span className="font-medium">{analytics.totalBotUnlocks}</span>
            </div>
            <div className="flex justify-between pt-3 border-t">
              <span className="text-gray-600 font-medium">Monthly Revenue Estimate</span>
              <span className="font-bold">KSh {(analytics.totalRevenue * 30).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
