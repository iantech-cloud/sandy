'use client';

import { useState, useRef, useEffect } from 'react';
import {
  getAllTickets,
  getTicketByIdAdmin,
  assignTicket,
  updateTicketStatus,
  addAdminMessage,
  addInternalNote,
  updateTicketPriority,
  updateTicketCategory,
  getTicketStatistics,
  getSupportAgents,
  getMyAssignedTickets,
  bulkUpdateStatus,
  bulkAssignTickets,
} from '@/app/actions/admin/tickets';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AdminSupportContentProps {
  initialTickets: any[];
  initialStats: any;
  initialAgents: any[];
}

export function AdminSupportContent({
  initialTickets,
  initialStats,
  initialAgents,
}: AdminSupportContentProps) {
  // Ephemeral UI state only (rule 6)
  const [activeView, setActiveView] = useState<'list' | 'detail' | 'stats'>('list');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [selectedTickets, setSelectedTickets] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    category: '',
    priority: '',
    assignedTo: '',
    searchTerm: '',
    isOverdue: false,
  });
  const [newMessage, setNewMessage] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [showInternalNoteModal, setShowInternalNoteModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const CATEGORIES = ['Technical Issue', 'Billing', 'Account', 'Feature Request', 'Bug Report', 'General Inquiry', 'Password Reset', 'Payment Issue', 'Verification', 'Other'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
  const STATUSES = ['Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'];
  const STATUS_COLORS: Record<string, string> = {
    'Open': 'bg-blue-100 text-blue-800',
    'In Progress': 'bg-yellow-100 text-yellow-800',
    'Waiting for Customer': 'bg-orange-100 text-orange-800',
    'Resolved': 'bg-green-100 text-green-800',
    'Closed': 'bg-gray-100 text-gray-800',
    'Reopened': 'bg-purple-100 text-purple-800',
  };
  const PRIORITY_COLORS: Record<string, string> = {
    'Low': 'bg-gray-100 text-gray-700',
    'Medium': 'bg-blue-100 text-blue-700',
    'High': 'bg-orange-100 text-orange-700',
    'Urgent': 'bg-red-100 text-red-700',
  };

  // React Query: Replace useState(tickets) + useEffect (rule 2)
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tickets', filters],
    queryFn: () => getAllTickets(filters),
    initialData: { tickets: initialTickets },
    select: (data) => data.tickets || [],
  });

  // React Query: Replace useState(stats) + useEffect (rule 2)
  const { data: stats = initialStats } = useQuery({
    queryKey: ['ticket-stats'],
    queryFn: () => getTicketStatistics(),
    initialData: initialStats,
    select: (data) => data.stats,
  });

  // React Query: Replace useState(agents) + useEffect (rule 2)
  const { data: agents = [] } = useQuery({
    queryKey: ['support-agents'],
    queryFn: () => getSupportAgents(),
    initialData: { agents: initialAgents },
    select: (data) => data.agents || [],
  });

  // React Query: Load ticket details (rule 2)
  const { data: selectedTicketData, isLoading: detailLoading } = useQuery({
    queryKey: ['ticket-detail', selectedTicket?.id],
    queryFn: () => getTicketByIdAdmin(selectedTicket.id),
    enabled: !!selectedTicket?.id,
    select: (data) => data.ticket,
  });

  useEffect(() => {
    if (selectedTicketData) {
      setSelectedTicket(selectedTicketData);
    }
  }, [selectedTicketData]);

  useEffect(() => {
    if (selectedTicket?.messages) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.messages]);

  // Mutations for actions
  const assignMutation = useMutation({
    mutationFn: ({ ticketId, agentId }: { ticketId: string; agentId: string }) =>
      assignTicket({ ticketId, agentId }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
        queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
      } else {
        toast.error(result.error || 'Failed to assign');
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: string }) =>
      updateTicketStatus({ ticketId, status }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
        queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
      } else {
        toast.error(result.error || 'Failed to update status');
      }
    },
  });

  const priorityMutation = useMutation({
    mutationFn: ({ ticketId, priority }: { ticketId: string; priority: string }) =>
      updateTicketPriority({ ticketId, priority }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
      } else {
        toast.error(result.error || 'Failed to update priority');
      }
    },
  });

  const categoryMutation = useMutation({
    mutationFn: ({ ticketId, category }: { ticketId: string; category: string }) =>
      updateTicketCategory({ ticketId, category }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
      } else {
        toast.error(result.error || 'Failed to update category');
      }
    },
  });

  const messageMutation = useMutation({
    mutationFn: ({ ticketId, message }: { ticketId: string; message: string }) =>
      addAdminMessage({ ticketId, message }),
    onSuccess: (result) => {
      if (result.success) {
        setNewMessage('');
        toast.success('Message sent');
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
      } else {
        toast.error(result.error || 'Failed to send message');
      }
    },
  });

  const internalNoteMutation = useMutation({
    mutationFn: ({ ticketId, note }: { ticketId: string; note: string }) =>
      addInternalNote({ ticketId, note }),
    onSuccess: (result) => {
      if (result.success) {
        setInternalNote('');
        setShowInternalNoteModal(false);
        toast.success('Note added');
        queryClient.invalidateQueries({ queryKey: ['ticket-detail'] });
      } else {
        toast.error(result.error || 'Failed to add note');
      }
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ticketIds, status }: { ticketIds: string[]; status: string }) =>
      bulkUpdateStatus({ ticketIds, status }),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
        setSelectedTickets([]);
        setShowBulkModal(false);
        queryClient.invalidateQueries({ queryKey: ['tickets'] });
        queryClient.invalidateQueries({ queryKey: ['ticket-stats'] });
      } else {
        toast.error(result.error || 'Failed to update tickets');
      }
    },
  });

  const formatDate = (date: Date | string) => 
    new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

  const getTimeAgo = (date: Date | string) => {
    const diff = new Date().getTime() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const handleAssignTicket = (agentId: string) => {
    if (!selectedTicket) return;
    assignMutation.mutate({ ticketId: selectedTicket.id, agentId });
  };

  const handleUpdateStatus = (status: string) => {
    if (!selectedTicket) return;
    statusMutation.mutate({ ticketId: selectedTicket.id, status });
  };

  const handleUpdatePriority = (priority: string) => {
    if (!selectedTicket) return;
    priorityMutation.mutate({ ticketId: selectedTicket.id, priority });
  };

  const handleUpdateCategory = (category: string) => {
    if (!selectedTicket) return;
    categoryMutation.mutate({ ticketId: selectedTicket.id, category });
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;
    messageMutation.mutate({ ticketId: selectedTicket.id, message: newMessage });
  };

  const handleAddInternalNote = async () => {
    if (!selectedTicket || !internalNote.trim()) return;
    internalNoteMutation.mutate({ ticketId: selectedTicket.id, note: internalNote });
  };

  const handleBulkStatusUpdate = async (status: string) => {
    if (selectedTickets.length === 0) return;
    bulkStatusMutation.mutate({ ticketIds: selectedTickets, status });
  };

  // Placeholder JSX - replace with your actual UI
  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-gray-600">Manage customer support tickets</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="mb-4 grid grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-gray-600">Open Tickets</p>
            <p className="text-2xl font-bold">{stats.open || 0}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold">{stats.inProgress || 0}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-2xl font-bold">{stats.resolved || 0}</p>
          </div>
          <div className="bg-white p-4 rounded border">
            <p className="text-sm text-gray-600">Total Agents</p>
            <p className="text-2xl font-bold">{agents.length}</p>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-4 border-b">
        {(['list', 'detail', 'stats'] as const).map((view) => (
          <button
            key={view}
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 capitalize ${
              activeView === view
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            {view}
          </button>
        ))}
      </div>

      {/* List View */}
      {activeView === 'list' && (
        <div className="space-y-4">
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Search tickets..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="flex-1 px-3 py-2 border rounded"
            />
          </div>

          {ticketsLoading ? (
            <div className="p-8 text-center text-gray-500">Loading tickets...</div>
          ) : (
            <div className="space-y-2">
              {tickets.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No tickets found</p>
              ) : (
                tickets.map((ticket: any) => (
                  <div
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="p-4 bg-white border rounded cursor-pointer hover:bg-gray-50"
                  >
                    <div className="flex justify-between">
                      <div>
                        <h3 className="font-semibold">{ticket.subject}</h3>
                        <p className="text-sm text-gray-600">{ticket.message}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-sm ${STATUS_COLORS[ticket.status] || ''}`}>
                        {ticket.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Detail View */}
      {activeView === 'detail' && selectedTicket && (
        <div className="bg-white p-4 rounded border">
          <h2 className="text-xl font-bold mb-4">{selectedTicket.subject}</h2>
          <p className="text-gray-700 mb-4">{selectedTicket.message}</p>
          <div className="flex gap-4">
            <button
              onClick={() => handleUpdateStatus('In Progress')}
              disabled={statusMutation.isPending}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Updating...' : 'In Progress'}
            </button>
            <button
              onClick={() => handleUpdateStatus('Resolved')}
              disabled={statusMutation.isPending}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              {statusMutation.isPending ? 'Updating...' : 'Resolve'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
