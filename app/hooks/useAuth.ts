// hooks/useAuth.ts
import { useRouter } from 'next/navigation';

export const useAuth = () => {
  const router = useRouter();

  const logout = async () => {
    try {
      // Clear client-side storage
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Use our custom logout route instead of NextAuth's signOut
      // This avoids CSRF token validation issues
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Let the server handle the redirect, but also navigate client-side to be safe
        router.push('/auth/login?message=logged_out');
      } else {
        console.error('Logout failed:', response.statusText);
        // Fallback redirect on error
        router.push('/auth/login?error=logout_failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback redirect
      window.location.href = '/auth/login';
    }
  };

  return { logout };
};
