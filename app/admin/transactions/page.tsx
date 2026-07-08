import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import TransactionsContent from './TransactionsContent';

export const metadata = {
  title: 'Transactions | Admin',
};

export default async function TransactionsPage() {
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <TransactionsContent />;
}
