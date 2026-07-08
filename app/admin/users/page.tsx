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
}
