import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import ApprovalsContent from './ApprovalsContent';

export const metadata = {
  title: 'Approvals | Admin',
};

export default async function ApprovalsPage() {
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <ApprovalsContent />;
}
