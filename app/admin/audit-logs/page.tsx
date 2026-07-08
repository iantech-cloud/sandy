import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import AuditLogsContent from './AuditLogsContent';

export const metadata = {
  title: 'Audit Logs | Admin',
};

export default async function AuditLogsPage() {
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <AuditLogsContent />;
}
