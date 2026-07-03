# State Management Refactoring Patterns

## Quick Reference

This guide shows the exact patterns to apply when refactoring useState + useEffect anti-patterns into proper Next.js App Router patterns.

---

## Pattern 1: List/Filter Page with useEffect + fetch

**BEFORE (ANTI-PATTERN):**

```tsx
'use client';
import { useState, useEffect } from 'react';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadUsers();
  }, [activeTab, searchTerm]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await getAdminUsers({ tab: activeTab, search: searchTerm });
      setUsers(result.data || []);
    } catch (err) {
      setError('Failed to load');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      {/* render users */}
    </div>
  );
}
```

**AFTER (FIXED):**

Split into two files:

**1. `UsersPage.tsx` (Server Component):**

```tsx
import { Suspense } from 'react';
import { getAdminUsers } from '@/app/actions/user-management';
import UsersContent from './UsersContent';

function LoadingSkeleton() {
  return <div className="animate-pulse">Loading users...</div>;
}

async function UsersDataLoader() {
  // Move fetch to server component (rule 2)
  const result = await getAdminUsers({ tab: 'all', search: '' });
  
  if (!result.success) {
    throw new Error(result.message);
  }

  return <UsersContent initialUsers={result.data} />;
}

export default async function UsersPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <UsersDataLoader />
    </Suspense>
  );
}
```

**2. `UsersContent.tsx` (Client Component):**

```tsx
'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminUsers } from '@/app/actions/user-management';

interface UsersContentProps {
  initialUsers: User[];
}

export default function UsersContent({ initialUsers }: UsersContentProps) {
  // useState: ephemeral UI state (rule 6)
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // React Query: handles caching, refetch, loading/error states (rule 2)
  const { data: users = initialUsers, isPending: loading, error } = useQuery({
    queryKey: ['users', activeTab, searchTerm],
    queryFn: async () => {
      const result = await getAdminUsers({ tab: activeTab, search: searchTerm });
      if (!result.success) throw new Error(result.message);
      return result.data || [];
    },
    initialData: initialUsers,
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      {/* render users */}
    </div>
  );
}
```

**Key Changes:**
- ✅ Removed `useState(loading)`, `useState(error)`, `useState(data)` from client
- ✅ Moved initial fetch to Server Component
- ✅ Used React Query for reactive updates (search, filter changes)
- ✅ Kept `searchTerm`, `activeTab` as local ephemeral state (rule 6)
- ✅ Added comment justifying each useState

---

## Pattern 2: Form with Manual Submit State

**BEFORE (ANTI-PATTERN):**

```tsx
'use client';
import { useState } from 'react';

export default function ApproveUserForm({ userId }: { userId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);
      const result = await approveUserAccount(userId);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div>{error}</div>}
      {success && <div>Success!</div>}
      <button disabled={isSubmitting}>
        {isSubmitting ? 'Approving...' : 'Approve'}
      </button>
    </form>
  );
}
```

**AFTER (FIXED):**

```tsx
'use client';
import { useActionState } from 'react';
import { approveUserAction } from '@/app/actions/user-management';

export default function ApproveUserForm({ userId }: { userId: string }) {
  // useActionState: manages form state tied to Server Action (rule 3)
  const [state, formAction, isPending] = useActionState(
    approveUserAction,
    { success: false, message: '' }
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="userId" value={userId} />
      
      {state.message && (
        <div className={state.success ? 'text-green-600' : 'text-red-600'}>
          {state.message}
        </div>
      )}
      
      <button disabled={isPending}>
        {isPending ? 'Approving...' : 'Approve'}
      </button>
    </form>
  );
}
```

**Server Action:**

```tsx
'use server';

export async function approveUserAction(prevState: any, formData: FormData) {
  const userId = formData.get('userId') as string;
  
  try {
    const result = await approveUserAccount(userId);
    return {
      success: result.success,
      message: result.message,
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to approve user',
    };
  }
}
```

**Key Changes:**
- ✅ Removed manual `useState(isSubmitting)`, `useState(error)`, `useState(success)`
- ✅ Used `useActionState` hook (rule 3)
- ✅ Tied form to Server Action
- ✅ Let Next.js manage pending state automatically

---

## Pattern 3: Modal with Fetched Content

**BEFORE (ANTI-PATTERN):**

```tsx
'use client';
import { useState, useEffect } from 'react';

export default function UserDetailsModal({ userId, isOpen, onClose }: Props) {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadDetails = async () => {
      try {
        setLoading(true);
        const result = await getUserDetails(userId);
        setUserDetails(result.data);
      } catch (err) {
        setError('Failed to load');
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="modal">
      {loading && <div>Loading...</div>}
      {error && <div>{error}</div>}
      {userDetails && <div>{userDetails.email}</div>}
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**AFTER (FIXED):**

```tsx
'use client';
import { Suspense, useState } from 'react';
import { getUserDetails } from '@/app/actions/user-management';

interface UserDetailsModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
}

function UserDetailsContent({ userId }: { userId: string }) {
  // Server Component inside modal: fetches data via Server Component
  // No useState needed for data
  const userDetails = use(getUserDetails(userId));

  return <div>{userDetails.email}</div>;
}

export default function UserDetailsModal({ userId, isOpen, onClose }: UserDetailsModalProps) {
  // useState: ephemeral UI state - modal open/close trigger only (rule 6)
  // (Note: isOpen is already managed by parent, but if local control needed)

  if (!isOpen) return null;

  return (
    <div className="modal">
      <Suspense fallback={<div>Loading...</div>}>
        <UserDetailsContent userId={userId} />
      </Suspense>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
```

**Alternative: URL-Driven Modal** (Recommended for deep-linking):

```tsx
'use client';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';

export default function UserDetailsModal() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const userId = searchParams.get('userId');

  // No useState for open/close - driven by URL (rule 5)
  
  if (!userId) return null;

  return (
    <div className="modal">
      <Suspense fallback={<div>Loading...</div>}>
        <UserDetailsContent userId={userId} />
      </Suspense>
      <button onClick={() => router.back()}>Close</button>
    </div>
  );
}
```

**Key Changes:**
- ✅ Removed `useState(userDetails)`, `useState(loading)`, `useState(error)` for data
- ✅ Fetch data in Server Component inside modal
- ✅ Use Suspense for loading state
- ✅ Keep `isOpen` as ephemeral state OR use URL params

---

## Checklist for Refactoring a Page

When refactoring a page, follow this checklist:

1. **Identify all useState calls**
   - Ask: "Where does this value come from?"
   - If from DB/API: ❌ Rule violation (rule 2)
   - If ephemeral (click, toggle, input before submit): ✅ Correct (rule 6)

2. **Identify all useEffect + fetch**
   - This is almost always rule violation #2
   - Move fetch to Server Component OR React Query

3. **Check loading/error states**
   - If tied to manual fetch: replace with Suspense or React Query
   - Don't keep manual `useState(loading)` and `useState(error)`

4. **Check pagination/filters**
   - If should survive refresh: use nuqs (rule 5)
   - If just local UI: useState is ok

5. **Check modals**
   - If fetching content: move fetch to Server Component inside modal
   - If just open/close toggle: useState is ok (rule 6)

6. **Add comments**
   - Every remaining useState needs a comment justifying it by rule
   - Example: `// useState: local toggle, no server source (rule 6)`

---

## React Query Quick Reference

**Fetch once on mount:**

```tsx
const { data, isPending, error } = useQuery({
  queryKey: ['users'],
  queryFn: async () => {
    const result = await getUsers();
    return result.data;
  },
});
```

**Fetch with dynamic params:**

```tsx
const [statusFilter, setStatusFilter] = useState('all');

const { data } = useQuery({
  queryKey: ['submissions', statusFilter],
  queryFn: async () => {
    const result = await getSubmissions({ status: statusFilter });
    return result.data;
  },
  enabled: !!statusFilter, // only fetch when statusFilter is set
});
```

**Manual refetch:**

```tsx
const { data, refetch } = useQuery({
  queryKey: ['users'],
  queryFn: async () => { /* ... */ },
});

const handleDelete = async (id: string) => {
  await deleteUser(id);
  refetch(); // refetch after mutation
};
```

**With initial data from Server Component:**

```tsx
interface ContentProps {
  initialData: User[];
}

export default function UserList({ initialData }: ContentProps) {
  const { data = initialData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { /* ... */ },
    initialData,
  });
}
```

---

## Checklist Summary

When you see `useState(data) + useEffect(fetch)`:
1. Create a Server Component for initial fetch
2. Create a Client Component to receive data as prop
3. Use React Query for reactive updates
4. Replace manual loading/error with Suspense
5. Add comments justifying all remaining useState
6. Test: Load ✓, Filter ✓, Refresh ✓, Error ✓
