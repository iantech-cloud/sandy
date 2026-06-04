'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface BotAccess {
  _id: string;
  userId: string;
  botId: string;
  botName?: string;
  messageCount: number;
  firstMilestoneComplete: boolean;
  createdAt: string;
}

export default function UsersAdminPage() {
  const [accesses, setAccesses] = useState<BotAccess[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserAccess();
  }, []);

  const loadUserAccess = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chat-foreigners/bots?includeAccess=true');
      const data = await res.json();
      if (data.success) {
        // Flatten all accesses from all bots
        const allAccesses = data.data.flatMap((bot: any) => 
          (bot.userAccess || []).map((access: any) => ({
            ...access,
            botName: bot.name,
          }))
        );
        setAccesses(allAccesses);
      }
    } catch (error) {
      console.error('Failed to load user access:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading user access data...</div>;
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">User Access Management</h1>
        <p className="text-gray-600 mt-1">View user bot access and engagement metrics</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">User ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Bot Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Messages</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Milestone 1</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Unlocked</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accesses.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-600">
                  No user access records yet.
                </td>
              </tr>
            ) : (
              accesses.map((access) => (
                <tr key={access._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-700">
                    {access.userId.substring(0, 8)}...
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{access.botName}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {access.messageCount}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {access.firstMilestoneComplete ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        ✓ Complete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDistanceToNow(new Date(access.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
