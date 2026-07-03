'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Settings, Power, PowerOff, Calendar, Clock, Users, TrendingUp, Award, RefreshCw, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface SpinSettings {
  isActive: boolean;
  maxSpinsPerDay: number;
  spinCost: number;
  prizePool: number;
  lastUpdated: string;
}

interface SpinLog {
  id: string;
  userId: string;
  userName: string;
  prizeAmount: number;
  timestamp: string;
  status: 'success' | 'failed';
}

interface SpinStats {
  totalSpins: number;
  totalWinnings: number;
  averagePrize: number;
  activeUsers: number;
}

interface AdminSpinManagementContentProps {
  initialSettings: SpinSettings;
  initialLogs: SpinLog[];
  initialStats: SpinStats;
}

export function AdminSpinManagementContent({ 
  initialSettings,
  initialLogs,
  initialStats
}: AdminSpinManagementContentProps) {
  // useState: ephemeral form state only (rule 6)
  const [localSettings, setLocalSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logsPage, setLogsPage] = useState(1);

  // React Query: data fetching with caching (rule 2)
  const { data: settings = initialSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['admin', 'spin', 'settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/spin/settings');
      if (!response.ok) throw new Error('Failed to fetch spin settings');
      const data = await response.json();
      return data.data;
    },
    initialData: initialSettings,
    staleTime: 60000,
  });

  const { data: logs = initialLogs } = useQuery({
    queryKey: ['admin', 'spin', 'logs', logsPage],
    queryFn: async () => {
      const response = await fetch(`/api/admin/spin/logs?page=${logsPage}&limit=10`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      return data.data || [];
    },
    initialData: initialLogs,
    staleTime: 30000,
  });

  const { data: stats = initialStats } = useQuery({
    queryKey: ['admin', 'spin', 'analytics'],
    queryFn: async () => {
      const response = await fetch('/api/admin/spin/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const data = await response.json();
      return data.data;
    },
    initialData: initialStats,
    staleTime: 60000,
  });

  const handleToggleActivation = async (activate: boolean) => {
    try {
      setIsSaving(true);
      setMessage(null);

      const response = await fetch('/api/admin/spin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activate }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: data.message });
        await refetchSettings();
        toast.success(data.message);
      } else {
        setMessage({ type: 'error', text: data.message });
        toast.error(data.message);
      }
    } catch (error) {
      const errorMsg = 'Failed to toggle spin wheel';
      setMessage({ type: 'error', text: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      const response = await fetch('/api/admin/spin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localSettings),
      });

      const data = await response.json();

      if (data.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        await refetchSettings();
        toast.success('Settings saved successfully');
      } else {
        setMessage({ type: 'error', text: data.message });
        toast.error(data.message);
      }
    } catch (error) {
      const errorMsg = 'Failed to save settings';
      setMessage({ type: 'error', text: errorMsg });
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Spin Wheel Management</h1>
          <p className="text-gray-600 mt-1">Configure and monitor spin wheel settings</p>
        </div>
        <button
          onClick={() => refetchSettings()}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Alert Message */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Spins</p>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalSpins || '0'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Total Winnings</p>
          <p className="text-2xl font-bold text-green-600">KES {stats?.totalWinnings?.toLocaleString() || '0'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Average Prize</p>
          <p className="text-2xl font-bold text-blue-600">KES {stats?.averagePrize?.toFixed(2) || '0'}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">Active Users</p>
          <p className="text-2xl font-bold text-purple-600">{stats?.activeUsers || '0'}</p>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-6 h-6 text-gray-700" />
          <h2 className="text-xl font-bold text-gray-900">Wheel Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Activation Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Wheel Status
            </label>
            <div className="flex gap-3">
              <button
                onClick={() => handleToggleActivation(true)}
                disabled={isSaving || settings?.isActive}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  settings?.isActive
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Power className="w-4 h-4" />
                Activate
              </button>
              <button
                onClick={() => handleToggleActivation(false)}
                disabled={isSaving || !settings?.isActive}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  !settings?.isActive
                    ? 'bg-red-100 text-red-800 border border-red-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <PowerOff className="w-4 h-4" />
                Deactivate
              </button>
            </div>
          </div>

          {/* Settings Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Spins Per Day
              </label>
              <input
                type="number"
                value={localSettings.maxSpinsPerDay}
                onChange={(e) => setLocalSettings({ ...localSettings, maxSpinsPerDay: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Spin Cost (KES)
              </label>
              <input
                type="number"
                value={localSettings.spinCost}
                onChange={(e) => setLocalSettings({ ...localSettings, spinCost: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prize Pool (KES)
              </label>
              <input
                type="number"
                value={localSettings.prizePool}
                onChange={(e) => setLocalSettings({ ...localSettings, prizePool: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Save Button */}
          <div>
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Spin Logs */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Spin Activity</h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prize</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {logs && logs.length > 0 ? (
                logs.map((log: SpinLog) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{log.userName}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">KES {log.prizeAmount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    No recent spin activity
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {logs && logs.length > 0 && (
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setLogsPage(Math.max(1, logsPage - 1))}
              disabled={logsPage === 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">Page {logsPage}</span>
            <button
              onClick={() => setLogsPage(logsPage + 1)}
              className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
