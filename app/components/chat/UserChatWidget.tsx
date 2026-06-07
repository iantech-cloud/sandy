// app/components/chat/UserChatWidget.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { usePollingChat } from '@/app/hooks/usePollingChat';
import { useSession } from 'next-auth/react';
import { AIAssistantPanel } from '@/app/components/chat/AIAssistantPanel';
import {
  MessageCircle,
  X,
  Send,
  Paperclip,
  Minimize2,
  Maximize2,
  Loader2,
  Check,
  CheckCheck,
  Clock,
  RefreshCw,
  Bot,
  Users,
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';

interface Message {
  _id: string;
  sender_id: string;
  content: string;
  message_type: string;
  status: string;
  created_at: string;
  attachments?: any[];
  sender?: {
    _id: string;
    username: string;
    email: string;
    role: string;
    avatar?: string;
  };
}

// ──────────────────────── sub-components ────────────────────────

const TypingIndicator = ({ username }: { username?: string }) => (
  <div className="flex items-start space-x-2 animate-fadeIn">
    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
      {username?.[0]?.toUpperCase() || 'S'}
    </div>
    <div className="flex items-center space-x-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl rounded-tl-sm shadow-sm">
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  </div>
);

const DateSeparator = ({ date }: { date: string }) => {
  const getDateLabel = (d: string) => {
    const dt = new Date(d);
    if (isToday(dt)) return 'Today';
    if (isYesterday(dt)) return 'Yesterday';
    return format(dt, 'MMMM dd, yyyy');
  };
  return (
    <div className="flex items-center justify-center my-4">
      <div className="bg-gray-200 text-gray-600 text-xs font-medium px-3 py-1 rounded-full">
        {getDateLabel(date)}
      </div>
    </div>
  );
};

const MessageStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'sending': return <Clock className="w-3 h-3 text-blue-200 animate-pulse" />;
    case 'sent':    return <Check className="w-3 h-3 text-blue-200" />;
    case 'delivered': return <CheckCheck className="w-3 h-3 text-blue-200" />;
    case 'read':    return <CheckCheck className="w-3 h-3 text-blue-300" />;
    default:        return <Clock className="w-3 h-3 text-blue-200" />;
  }
};

const Avatar = ({
  user,
  size = 'md',
  showOnline = false,
}: {
  user?: { username: string; avatar?: string; role?: string };
  size?: 'sm' | 'md' | 'lg';
  showOnline?: boolean;
}) => {
  const sizeClasses = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const initial = user?.username?.[0]?.toUpperCase() || 'S';
  return (
    <div className="relative flex-shrink-0">
      {user?.avatar ? (
        <img src={user.avatar} alt={user.username} className={`${sizeClasses[size]} rounded-full object-cover`} />
      ) : (
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold`}>
          {initial}
        </div>
      )}
      {showOnline && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
      )}
    </div>
  );
};

// ──────────────────────── main component ────────────────────────

type ChatMode = 'ai' | 'human';

export default function UserChatWidget() {
  const { data: session } = useSession();
  const {
    connected,
    conversations,
    messages,
    unreadCount,
    error,
    isLoading,
    sendMessage,
    joinConversation,
    leaveConversation,
    fetchConversations,
    createConversation,
    markMessagesAsRead,
    typingUsers,
  } = usePollingChat();

  const [isOpen, setIsOpen]               = useState(false);
  const [isMinimized, setIsMinimized]     = useState(false);
  const [mode, setMode]                   = useState<ChatMode>('ai');
  const [messageInput, setMessageInput]   = useState('');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [isMobile, setIsMobile]           = useState(false);

  const messagesEndRef       = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef         = useRef<HTMLInputElement>(null);

  const currentConversation   = conversations.find(c => c._id === selectedConversation);
  const conversationMessages  = selectedConversation ? messages[selectedConversation] || [] : [];
  const otherParticipant      = currentConversation?.participants.find(
    (p: any) => p.user_id?._id !== session?.user?.id
  );
  const isOtherUserTyping     = selectedConversation && typingUsers[selectedConversation]?.some(
    (uid: string) => uid !== session?.user?.id
  );

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Auto-select first conversation
  useEffect(() => {
    if (isOpen && mode === 'human' && conversations.length > 0 && !selectedConversation) {
      const first = conversations[0];
      setSelectedConversation(first._id);
      joinConversation(first._id);
    }
  }, [isOpen, mode, conversations, selectedConversation, joinConversation]);

  // Mark as read
  useEffect(() => {
    if (selectedConversation && conversationMessages.length > 0) {
      const unread = conversationMessages
        .filter((m: Message) => m.sender_id !== session?.user?.id && m.status !== 'read')
        .map((m: Message) => m._id);
      if (unread.length > 0) {
        const t = setTimeout(() => markMessagesAsRead(selectedConversation, unread), 1000);
        return () => clearTimeout(t);
      }
    }
  }, [selectedConversation, conversationMessages, session, markMessagesAsRead]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen && selectedConversation) {
      leaveConversation();
      setSelectedConversation(null);
    }
  }, [isOpen, selectedConversation, leaveConversation]);

  // Body scroll lock on mobile
  useEffect(() => {
    if (isOpen && isMobile) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen, isMobile]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || isLoading) return;
    const content = messageInput;
    setMessageInput('');
    if (!selectedConversation) {
      await createConversation(content, 'medium');
    } else {
      await sendMessage({ conversationId: selectedConversation, content, messageType: 'text' });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    alert('File upload will be implemented soon!');
  };

  const formatMessageTime = (d: string) => {
    try { return format(new Date(d), 'h:mm a'); } catch { return ''; }
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { [k: string]: Message[] } = {};
    msgs.forEach(m => {
      const key = format(new Date(m.created_at), 'yyyy-MM-dd');
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return groups;
  };

  const shouldGroupMessage = (curr: Message, prev: Message | null) => {
    if (!prev || prev.sender_id !== curr.sender_id) return false;
    return new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
  };

  const groupedMessages = groupMessagesByDate(conversationMessages);

  if (!session?.user) return null;

  const widgetHeight = isMinimized ? 'h-16' : 'h-[600px] sm:h-[650px]';

  return (
    <>
      {/* FAB button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 z-50 group"
          aria-label="Open support chat"
        >
          <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1.5 animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <div className="hidden sm:block absolute right-full mr-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Need help? Chat with us!
          </div>
        </button>
      )}

      {/* Chat widget */}
      {isOpen && (
        <div
          className={`
            fixed z-50 bg-white transition-all duration-300 flex flex-col
            ${isMobile
              ? 'inset-0 rounded-none'
              : `bottom-4 right-4 sm:bottom-6 sm:right-6 rounded-2xl shadow-2xl border border-gray-200 w-full sm:w-96 ${widgetHeight}`
            }
          `}
        >
          {/* Header */}
          <div className={`flex items-center justify-between p-3 sm:p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white shrink-0 ${isMobile ? 'rounded-none' : 'rounded-t-2xl'}`}>
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 flex-shrink-0" />
              <div className="min-w-0">
                <h3 className="font-semibold text-xs sm:text-sm">HustleHub Support</h3>
                <p className="text-xs text-blue-100 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-gray-400'}`} />
                  {connected ? 'Online' : 'Connecting...'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                onClick={() => fetchConversations()}
                className="hover:bg-blue-600 p-1.5 rounded-lg transition-colors"
                aria-label="Refresh"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              {!isMobile && (
                <button
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="hover:bg-blue-600 p-1.5 rounded-lg transition-colors"
                  aria-label={isMinimized ? 'Maximize' : 'Minimize'}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-blue-600 p-1.5 rounded-lg transition-colors"
                aria-label="Close chat"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Mode tabs */}
              <div className="flex border-b border-gray-200 shrink-0 bg-white">
                <button
                  onClick={() => setMode('ai')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    mode === 'ai'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  AI Assistant
                </button>
                <button
                  onClick={() => setMode('human')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                    mode === 'human'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Human Support
                  {unreadCount > 0 && (
                    <span className="ml-0.5 bg-red-500 text-white text-xs font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>

              {/* ── AI panel ── */}
              {mode === 'ai' && (
                <AIAssistantPanel
                  isVisible
                  onClose={() => setIsOpen(false)}
                  onSwitchToHuman={() => setMode('human')}
                />
              )}

              {/* ── Human support panel ── */}
              {mode === 'human' && (
                <>
                  {error && (
                    <div className="bg-red-50 border-b border-red-200 p-2 shrink-0">
                      <p className="text-red-600 text-xs flex items-center">
                        <span className="mr-2">&#9888;</span>
                        {error}
                      </p>
                    </div>
                  )}

                  {/* Agent info bar */}
                  {otherParticipant && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
                      <Avatar user={otherParticipant.user_id} size="sm" showOnline />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-700 truncate">
                          {otherParticipant.user_id?.username || 'Support Agent'}
                        </p>
                        <p className="text-xs text-gray-400">Support Specialist</p>
                      </div>
                    </div>
                  )}

                  {/* Messages area */}
                  <div
                    ref={messagesContainerRef}
                    className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-1 bg-gradient-to-b from-gray-50 to-white"
                    style={{ minHeight: 0 }}
                  >
                    {conversationMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center px-4">
                        <div className="bg-blue-50 rounded-full p-5 mb-3">
                          <MessageCircle className="w-12 h-12 text-blue-500" />
                        </div>
                        <h4 className="text-gray-700 text-sm font-semibold mb-1">Chat with a real person</h4>
                        <p className="text-gray-500 text-xs max-w-xs">
                          For urgent issues — fraud, account suspension, payment disputes — type below and a specialist will respond.
                        </p>
                      </div>
                    ) : (
                      <>
                        {Object.entries(groupedMessages).map(([date, msgs]) => (
                          <div key={date}>
                            <DateSeparator date={date} />
                            {msgs.map((message: Message, index: number) => {
                              const isOwn = message.sender_id === session.user.id;
                              const prev = index > 0 ? msgs[index - 1] : null;
                              const grouped = shouldGroupMessage(message, prev);
                              const isFirst = !grouped;
                              return (
                                <div key={message._id} className={`${isFirst ? 'mt-4' : 'mt-1'}`}>
                                  {isOwn ? (
                                    <div className="flex justify-end items-end space-x-2 animate-fadeIn">
                                      <div className="max-w-[85%] sm:max-w-[75%]">
                                        {isFirst && (
                                          <p className="text-xs text-gray-500 mb-1 text-right mr-2">You</p>
                                        )}
                                        <div className="bg-blue-500 text-white rounded-2xl rounded-tr-md px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm">
                                          <p className="text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed">
                                            {message.content}
                                          </p>
                                          <div className="flex items-center justify-end space-x-1.5 mt-1">
                                            <span className="text-xs text-blue-100">{formatMessageTime(message.created_at)}</span>
                                            <MessageStatusIcon status={message.status} />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex justify-start items-end space-x-2 animate-fadeIn">
                                      {isFirst && <Avatar user={message.sender} size="sm" />}
                                      {!isFirst && <div className="w-8" />}
                                      <div className="max-w-[85%] sm:max-w-[75%]">
                                        {isFirst && message.sender && (
                                          <p className="text-xs font-medium text-gray-600 mb-1 ml-2 flex items-center gap-1">
                                            {message.sender.username}
                                            {message.sender.role === 'admin' && (
                                              <span className="text-blue-600 text-xs">[Admin]</span>
                                            )}
                                            {message.sender.role === 'support' && (
                                              <span className="text-green-600 text-xs">[Support]</span>
                                            )}
                                          </p>
                                        )}
                                        <div className="bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-tl-md px-3 py-2 sm:px-4 sm:py-2.5 shadow-sm">
                                          <p className="text-xs sm:text-sm break-words whitespace-pre-wrap leading-relaxed">
                                            {message.content}
                                          </p>
                                          <div className="flex items-center justify-end mt-1">
                                            <span className="text-xs text-gray-400">{formatMessageTime(message.created_at)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            {isOtherUserTyping && otherParticipant && (
                              <div className="mt-4">
                                <TypingIndicator username={otherParticipant.user_id?.username} />
                              </div>
                            )}
                            <div ref={messagesEndRef} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Human chat input */}
                  <div className={`p-3 sm:p-4 bg-white border-t border-gray-200 shrink-0 ${!isMobile && 'rounded-b-2xl'}`}>
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!connected || isLoading}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 self-end mb-0.5"
                        aria-label="Attach file"
                      >
                        <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*,application/pdf,.doc,.docx"
                      />
                      <div className="flex-1 relative">
                        <textarea
                          value={messageInput}
                          onChange={e => setMessageInput(e.target.value)}
                          onKeyPress={handleKeyPress}
                          placeholder="Type a message..."
                          disabled={!connected || isLoading}
                          rows={1}
                          className="w-full px-3 py-2 sm:px-4 sm:py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-100 text-xs sm:text-sm resize-none max-h-32"
                          style={{ minHeight: '38px', height: 'auto' }}
                          onInput={e => {
                            const t = e.target as HTMLTextAreaElement;
                            t.style.height = 'auto';
                            t.style.height = Math.min(t.scrollHeight, 96) + 'px';
                          }}
                        />
                      </div>
                      <button
                        onClick={handleSendMessage}
                        disabled={!messageInput.trim() || !connected || isLoading}
                        className="p-2 sm:p-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed self-end mb-0.5"
                        aria-label="Send message"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" /> : <Send className="w-4 h-4 sm:w-5 sm:h-5" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-center mt-2">
                      <p className="text-xs text-gray-400 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {connected ? 'Connected' : 'Connecting...'}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Global styles */}
      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40%            { transform: translateY(-8px); }
        }
        .animate-fadeIn  { animation: fadeIn 0.3s ease-out; }
        .animate-bounce  { animation: bounce 1.4s infinite; }
        .overflow-y-auto::-webkit-scrollbar       { width: 6px; }
        .overflow-y-auto::-webkit-scrollbar-track  { background: transparent; }
        .overflow-y-auto::-webkit-scrollbar-thumb  { background: #cbd5e1; border-radius: 3px; }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @media (max-width: 640px) { body { overflow-x: hidden; } }
      `}</style>
    </>
  );
}
