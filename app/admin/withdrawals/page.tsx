import { redirect } from 'next/navigation';
import { protectAdminRoute } from '@/app/lib/auth/auth-actions';
import WithdrawalsContent from './WithdrawalsContent';

export const metadata = {
  title: 'Withdrawals | Admin',
};

export default async function WithdrawalsPage() {
  const authResult = await protectAdminRoute();
  if (!authResult.authorized) {
    redirect('/auth/login');
  }

  return <WithdrawalsContent />;
}
