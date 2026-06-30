// app/providers/SessionProvider.tsx - FIXED VERSION
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import type { Session } from 'next-auth';

interface SessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export default function SessionProvider({ children, session }: SessionProviderProps) {
  return (
    <NextAuthSessionProvider 
      session={session}
      // CRITICAL: These settings ensure proper session handling
      refetchInterval={0}              // Don't auto-refetch (prevents loops)
      refetchOnWindowFocus={true}      // Refetch when window gets focus
      refetchWhenOffline={false}       // Don't refetch when offline
    >
      {children}
    </NextAuthSessionProvider>
  );
}
