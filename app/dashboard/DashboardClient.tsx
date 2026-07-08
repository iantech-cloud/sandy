'use client';

// DashboardClient.tsx - Client-side wrapper for dashboard
// This component is responsible for handling user interface, session monitoring,
// and client-side state after the server-side auth guard (layout.tsx) has verified access.

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { signOut, useSession } from 'next-auth/react';
import SideNav from '@/app/ui/dashboard/sidenav';
import BottomNav from '@/app/ui/dashboard/BottomNav';
import HamburgerMenu from '@/app/ui/dashboard/HamburgerMenu';
import Alert from '@/app/ui/Alert';
import { Loader2, Sparkles } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { DashboardProvider } from './DashboardContext';
import { getUserProfile } from '../actions/user';
import { getReferrals } from '../actions/referrals';
import { getTransactions } from '../actions/transactions';
import SessionMonitor from '@/app/components/SessionMonitor';
import UserChatWidget from '@/app/components/chat/UserChatWidget';
import NotificationBell from '@/app/components/NotificationBell';

const MAX_RETRIES = 3;

async function apiFetch<T>(
  endpoint: string,
  method: 'GET' | 'POST',
  data?: any,
  token?: string
): Promise<{ success: boolean; data?: T; message: string }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
    }

    if (data && method === 'POST') {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(endpoint, options);

      let result: { success: boolean; data?: T; message: string };
      const contentType = response.headers.get('content-type');
      
      if (response.status === 204 || (contentType && !contentType.includes('application/json'))) {
        if (response.ok) {
          result = { success: true, message: 'No content', data: {} as T };
        } else {
          const errorText = await response.text();
          return { success: false, message: errorText || `Client Error: ${response.statusText}` };
        }
      } else {
        try {
          result = await response.json();
        } catch (e) {
          console.error('Failed to parse JSON response:', e);
          return { success: false, message: 'The server returned an invalid JSON response.' };
        }
      }

      if (response.ok) {
        return result;
      }

      if (response.status === 401 || response.status < 500) {
        return { success: false, message: result.message || `Client Error: ${response.statusText}` };
      }

      console.warn(`Attempt ${attempt + 1} failed for ${endpoint}. Retrying in ${Math.pow(2, attempt)}s...`);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        return { success: false, message: result.message || `Server Error: ${response.statusText}` };
      }
    } catch (error) {
      console.error(`Fetch error on attempt ${attempt + 1}:`, error);
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        return { success: false, message: 'Network or internal error after multiple retries.' };
      }
    }
  }
  return { success: false, message: 'Exceeded max retries.' };
}

interface User {
  id: string;
  name: string;
  phone: string;
  balance: number;
  referralCode: string;
  totalEarnings: number;
  tasksCompleted: number;
  isVerified: boolean;
  isActive: boolean;
  isApproved: boolean;
  role: string;
  status: string;
  banReason?: string;
  bannedAt?: string;
  suspensionReason?: string;
  suspendedAt?: string;
  level: number;
  rank: string;
  availableSpins: number;
  lastWithdrawalDate?: string;
  email: string;
}

interface DashboardClientProps {
  children: React.ReactNode;
}

export default function DashboardClient({ children }: DashboardClientProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingApp, setLoadingApp] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mpesaNotification, setMpesaNotification] = useState<any>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [shouldCheckStatus, setShouldCheckStatus] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
    
  const { data: session, status, update } = useSession();

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  const getCurrentSection = () => {
    if (pathname?.includes('/dashboard/content')) return 'content';
    if (pathname?.includes('/dashboard/blog')) return 'blog';
    if (pathname?.includes('/dashboard/wallet')) return 'wallet';
    if (pathname?.includes('/dashboard/surveys')) return 'surveys';
    if (pathname?.includes('/dashboard/chat-foreigners')) return 'chat-foreigners';
    if (pathname?.includes('/dashboard/referrals')) return 'referrals';
    if (pathname?.includes('/dashboard/support')) return 'support';
    if (pathname?.includes('/dashboard/settings')) return 'settings';
    if (pathname?.includes('/dashboard/soko')) return 'affiliate';
    return 'dashboard';
  };

  const externalApiToken = useMemo(() => {
    if (!isMounted) return null;
    return (session as any)?.accessToken || null; 
  }, [session, isMounted]);

  const authenticatedApiFetch = useCallback(
    <T,>(endpoint: string, method: 'GET' | 'POST', data?: any) => 
      apiFetch<T>(endpoint, method, data, externalApiToken || undefined),
    [externalApiToken]
  );

  const fetchUser = useCallback(async () => {
    if (!isMounted) return false;

    if (status !== 'authenticated' || !session?.user?.id) {
      return false;
    }

    if (hasAttemptedFetch) {
      return false;
    }

    setError(null);
    setLoadingApp(true);
    setHasAttemptedFetch(true);

    try {
      const profileResult = await getUserProfile();
      
      if (!profileResult.success || !profileResult.data) {
        if (profileResult.message?.includes('Unauthorized') || profileResult.message?.includes('401')) {
          setError('Session expired. Please log in again.');
          setLoadingApp(false);
          return false;
        }
        throw new Error(profileResult.message || 'Failed to fetch user data');
      }

      const userData = profileResult.data;

      const transformedUser: User = {
        id: userData.id,
        name: userData.name,
        phone: userData.phone,
        balance: userData.balance,
        referralCode: userData.referralCode,
        totalEarnings: userData.totalEarnings,
        tasksCompleted: userData.tasksCompleted,
        isVerified: userData.isVerified,
        isActive: userData.isActive,
        isApproved: userData.isApproved,
        role: userData.role,
        status: userData.status,
        banReason: userData.banReason,
        bannedAt: userData.bannedAt,
        suspensionReason: userData.suspensionReason,
        suspendedAt: userData.suspendedAt,
        level: userData.level,
        rank: userData.rank,
        availableSpins: userData.availableSpins,
        lastWithdrawalDate: userData.lastWithdrawalDate,
        email: userData.email,
      };

      setUser(transformedUser);
      setLoadingApp(false);
      setShouldCheckStatus(true);
      return true;
    } catch (err) {
      console.error('❌ fetchUser: Failed -', err);
      setUser(null);
      setError(err instanceof Error ? err.message : 'Failed to fetch user data. Please try again.');
      setLoadingApp(false);
      setHasAttemptedFetch(false);
      return false;
    }
  }, [status, session, hasAttemptedFetch, isMounted]);

  const fetchMpesaChangeRequests = useCallback(async () => {
    if (!user || !isMounted) return;
    
    const result = await authenticatedApiFetch<any[]>('/api/mpesa-change-requests', 'GET');
    
    if (result.success && result.data && result.data.length > 0) {
      const latestRequest = result.data[0];
      if (latestRequest.status !== 'pending' && latestRequest.processed_date) {
        const processedTimestamp = new Date(latestRequest.processed_date).getTime();
        const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
        const notificationId = `${latestRequest.id}_${latestRequest.status}_${latestRequest.processed_date}`;
        const lastNotificationId = localStorage.getItem('last_mpesa_notification_id');

        if (processedTimestamp > recentThreshold && lastNotificationId !== notificationId) {
          setMpesaNotification(latestRequest);
          localStorage.setItem('last_mpesa_notification_id', notificationId);
        }
      }
    }
  }, [user, authenticatedApiFetch, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    
    if (status === 'loading') {
      return;
    }

    if (status === 'authenticated') {
      if (session?.user?.id) {
        const timer = setTimeout(() => {
          if (!user && !hasAttemptedFetch) {
            fetchUser();
          }
        }, 100);
        
        return () => clearTimeout(timer);
      } else {
        setTimeout(() => {
          update();
        }, 0);
      }
    }
  }, [status, session, user, fetchUser, update, hasAttemptedFetch, isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    
    if (shouldCheckStatus && user) {
      fetchMpesaChangeRequests();
      setShouldCheckStatus(false);
    }
  }, [shouldCheckStatus, user, fetchMpesaChangeRequests, isMounted]);

  const handleLogout = useCallback(async () => {
    if (isLoggingOut || !isMounted) return;
    
    setIsLoggingOut(true);
    try {
      setUser(null);
      setError(null);
      setLoadingApp(false);
      setHasAttemptedFetch(false);
      
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) {
          console.warn('[dashboard] Logout API returned status:', response.status);
        }
      } catch (fetchError) {
        console.warn('[dashboard] Logout fetch error (proceeding with client-side logout):', fetchError);
      }
      
      await signOut({ redirect: false });
      
      setTimeout(() => {
        router.push('/auth/login?message=logged_out');
      }, 300);
      
    } catch (error) {
      console.error('[v0] Logout error:', error);
      setTimeout(() => {
        router.push('/auth/login');
      }, 500);
    } finally {
      if (isMounted) {
        setIsLoggingOut(false);
      }
    }
  }, [router, isLoggingOut, isMounted]);

  const isOverallLoading = 
    status === 'loading' || 
    (status === 'authenticated' && !session?.user?.id) || 
    (status === 'authenticated' && session?.user?.id && loadingApp && !user);

  if (!isMounted) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
        <div className="text-center">
          <div className="relative inline-flex">
            <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
          </div>
        </div>
      </div>
    );
  }

  if (isOverallLoading) {
    return (
      <div className="flex justify-center items-center h-full min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/30">
        <div className="text-center">
          <div className="relative inline-flex">
            <Loader2 className="animate-spin text-blue-600 w-12 h-12" />
            <div className="absolute inset-0 animate-ping">
              <Loader2 className="text-cyan-400 w-12 h-12 opacity-20" />
            </div>
          </div>
          <p className="mt-4 text-lg font-medium text-slate-700">Loading application data...</p>
          <p className="mt-1 text-sm text-slate-500">Please wait while we prepare your dashboard</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (getCurrentSection() === 'chat-foreigners') {
    return (
      <>
        <SessionMonitor />
        <DashboardProvider value={{ user, apiFetch: authenticatedApiFetch }}>
          {children}
        </DashboardProvider>
      </>
    );
  }

  return (
    <>
      <SessionMonitor />
      <div className="flex flex-col lg:flex-row min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-cyan-50/20 relative overflow-hidden">
        {/* Desktop Sidebar - hidden on mobile */}
        <div className="hidden lg:block">
          <SideNav userName={user.name} onLogout={handleLogout} />
        </div>
        
        {/* Mobile Hamburger Menu - shown on mobile only */}
        <div className="lg:hidden fixed top-4 left-4 z-50">
          <HamburgerMenu userName={user.name} onLogout={handleLogout} />
        </div>
        
        <main className="flex-1 p-4 md:p-8 pb-20 lg:pb-8 relative z-0 h-screen overflow-y-auto main-content-scrollbar">
          <header className="relative z-40 flex justify-between items-center mb-6 bg-white/70 backdrop-blur-xl p-4 rounded-2xl shadow-lg border border-white/50">
            <div className="flex items-center space-x-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Sparkles className="text-white w-5 h-5" />
              </div>
              <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent truncate">
                HustleHub
              </h1>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <NotificationBell />
            </div>
          </header>
          
          <DashboardProvider value={{ user, apiFetch: authenticatedApiFetch }}>
            {children}
          </DashboardProvider>
        </main>
      </div>

      {/* Mobile Bottom Navigation - shown on mobile only */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden z-40 bg-white border-t border-gray-200">
        <BottomNav userName={user.name} onLogout={handleLogout} />
      </div>
    </>
  );
}
