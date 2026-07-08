// app/dashboard/layout.tsx - SECURITY: Server-side auth guard
// IMPORTANT: This is now a Server Component that enforces authentication
// before any client code or nested Server Components execute.

import React from 'react';
import { protectDashboard } from '@/app/lib/auth/auth-actions';
import DashboardClient from './DashboardClient';

// Server Component: Protect dashboard at the layout level
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // SECURITY: This will redirect to /auth/login if user is not authenticated
  // or to /auth/pending-approval if user hasn't met status requirements.
  // This runs on the server BEFORE any client component renders.
  await protectDashboard();

  // If we reach here, user is authenticated and meets all requirements.
  // Render the client wrapper component which handles the rest of the dashboard UX.
  return (
    <DashboardClient>
      {children}
    </DashboardClient>
  );
}
