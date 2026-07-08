import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import UsersContent from './UsersContent';

export const metadata = {
  title: 'Users | Admin',
};

export default async function UsersPage() {
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <UsersContent />;

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-gray-500">
              {searchTerm || activeTab !== 'all' 
                ? 'Try adjusting your search or filters.' 
                : 'No users in the system yet.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Financials
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Activity
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                        <div className="text-sm text-gray-500">{user.phone_number}</div>
                        {user.referral_id && (
                          <div className="text-xs text-blue-600 mt-1">
                            Referral ID: {user.referral_id}
                          </div>
                        )}
                        <button
                          onClick={() => handleViewDetails(user._id)}
                          disabled={actionLoading === `details-${user._id}`}
                          className="text-xs text-blue-600 hover:text-blue-800 mt-1 disabled:opacity-50"
                        >
                          {actionLoading === `details-${user._id}` ? 'Loading...' : 'View Details'}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.approval_status === 'approved' 
                              ? 'bg-green-100 text-green-800'
                              : user.approval_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.approval_status.toUpperCase()}
                          </span>
                          {getStatusBadge(user.status)}
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.is_active 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                          {isUserFullyActivated(user) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              ACTIVATED
                            </span>
                          )}
                        </div>
                        {user.activation_paid_at && (
                          <div className="text-xs text-gray-500">
                            Activated: {formatDate(user.activation_paid_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          Balance: {formatCurrency(user.balance_cents)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Earnings: {formatCurrency(user.total_earnings_cents)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Spins: {user.available_spins}
                        </div>
                        {(user.total_deposits_today_cents || user.total_withdrawals_today_cents) && (
                          <div className="text-xs text-gray-400 mt-1">
                            Today: D-{formatCurrency(user.total_deposits_today_cents || 0)} / W-{formatCurrency(user.total_withdrawals_today_cents || 0)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-gray-900">
                          Tasks: {user.tasks_completed}
                        </div>
                        <div className="text-sm text-gray-500">
                          Joined: {formatDate(user.created_at)}
                        </div>
                        <div className="text-sm text-gray-500">
                          Role: <span className="capitalize">{user.role}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex flex-col space-y-2 items-end">
                        {/* Approval Actions - Show for unapproved users */}
                        {canApproveUser(user) && (
                          <button
                            onClick={() => handleApprove(user._id)}
                            disabled={actionLoading === `approve-${user._id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `approve-${user._id}` ? 'Approving...' : 'Approve'}
                          </button>
                        )}

                        {/* Activation Actions - Show for users who can be activated */}
                        {canActivateUser(user) && (
                          <button
                            onClick={() => handleActivate(user._id)}
                            disabled={actionLoading === `activate-${user._id}`}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {actionLoading === `activate-${user._id}` ? 'Activating...' : 'Activate (KES 95)'}
                          </button>
                        )}

                        {/* Add Spins for Active Users */}
                        {user.is_active && (
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={spinsAmount[user._id] || ''}
                              onChange={(e) => setSpinsAmount(prev => ({
                                ...prev,
                                [user._id]: parseInt(e.target.value) || 0
                              }))}
                              placeholder="Spins"
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                            <button
                              onClick={() => handleAddSpins(user._id)}
                              disabled={actionLoading === `spins-${user._id}`}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading === `spins-${user._id}` ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        )}

                        {/* Status Management */}
                        <div className="flex space-x-2">
                          <select
                            value={user.status}
                            onChange={(e) => handleStatusUpdate(user._id, e.target.value)}
                            disabled={actionLoading === `status-${user._id}`}
                            className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-50 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="suspended">Suspended</option>
                            <option value="banned">Banned</option>
                          </select>
                          
                          {/* Reset Limits Button */}
                          <button
                            onClick={() => handleResetLimits(user._id)}
                            disabled={actionLoading === `reset-${user._id}`}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs rounded text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            title="Reset Daily Limits"
                          >
                            {actionLoading === `reset-${user._id}` ? '...' : '↻'}
                          </button>

                          {/* Chat Foreigners Coming Soon */}
                          <button
                            disabled
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-500 bg-gray-100 cursor-not-allowed"
                            title="Chat Foreigners feature coming soon"
                          >
                            Chat Foreigners (Coming Soon)
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserDetails && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-gray-900">
                  User Details: {selectedUser.user.username}
                </h3>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* User Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Basic Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Username</label>
                    <p className="text-sm text-gray-900">{selectedUser.user.username}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-sm text-gray-900">{selectedUser.user.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone Number</label>
                    <p className="text-sm text-gray-900">{selectedUser.user.phone_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Referral ID</label>
                    <p className="text-sm text-gray-900">{selectedUser.user.referral_id || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">M-Pesa Number</label>
                    <p className="text-sm text-gray-900">{selectedUser.user.preferred_mpesa_number || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Joined Date</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedUser.user.created_at)}</p>
                  </div>
                  {selectedUser.user.activation_paid_at && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Activated At</label>
                      <p className="text-sm text-gray-900">{formatDate(selectedUser.user.activation_paid_at)}</p>
                    </div>
                  )}
                  {selectedUser.user.activation_method && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Activation Method</label>
                      <p className="text-sm text-gray-900 capitalize">{selectedUser.user.activation_method}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Account Status</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-500">Approval</div>
                    <div className={`text-sm font-medium ${
                      selectedUser.user.approval_status === 'approved' ? 'text-green-600' : 
                      selectedUser.user.approval_status === 'pending' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {selectedUser.user.approval_status.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-500">Status</div>
                    <div className="text-sm font-medium text-gray-900">
                      {selectedUser.user.status.toUpperCase()}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-500">Active</div>
                    <div className={`text-sm font-medium ${
                      selectedUser.user.is_active ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedUser.user.is_active ? 'YES' : 'NO'}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-500">Role</div>
                    <div className="text-sm font-medium text-gray-900 capitalize">
                      {selectedUser.user.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Information */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">Financial Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm font-medium text-blue-600">Balance</div>
                    <div className="text-lg font-bold text-blue-700">
                      {formatCurrency(selectedUser.user.balance_cents)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-sm font-medium text-green-600">Total Earnings</div>
                    <div className="text-lg font-bold text-green-700">
                      {formatCurrency(selectedUser.user.total_earnings_cents)}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-sm font-medium text-purple-600">Available Spins</div>
                    <div className="text-lg font-bold text-purple-700">
                      {selectedUser.user.available_spins}
                    </div>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <div className="text-sm font-medium text-orange-600">Tasks Completed</div>
                    <div className="text-lg font-bold text-orange-700">
                      {selectedUser.user.tasks_completed}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Transactions */}
              {selectedUser.recentTransactions && selectedUser.recentTransactions.length > 0 && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Recent Transactions</h4>
                  <div className="space-y-2">
                    {selectedUser.recentTransactions.slice(0, 5).map((transaction: any) => (
                      <div key={transaction._id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {transaction.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatDate(transaction.created_at)}
                          </div>
                        </div>
                        <div className={`text-sm font-medium ${
                          transaction.amount_cents >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(transaction.amount_cents)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Referral Information */}
              {selectedUser.referral && (
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-4">Referral Information</h4>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium">Referred by:</span>{' '}
                      {selectedUser.referral.referrer_id?.username || 'Unknown'}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Referral Earnings: {formatCurrency(selectedUser.referral.earning_cents || 0)}
                    </div>
                    {selectedUser.referral.referred_user_activated && (
                      <div className="text-sm text-green-600 mt-1">
                        ✓ Referred user activated
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
