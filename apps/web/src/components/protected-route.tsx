import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const user = getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return <>{children}</>;
}
