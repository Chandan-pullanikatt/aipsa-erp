'use client';

import MyLeaveView from '@/components/MyLeaveView';
import { getUser } from '@/lib/auth';

export default function StaffDashboardPage() {
  const user = typeof window !== 'undefined' ? getUser() : null;

  return (
    <MyLeaveView
      title={`Welcome${user ? `, ${user.firstName}` : ''}`}
      subtitle="Apply for leave and track the status of your requests."
      loadingLabel="Loading your workspace..."
    />
  );
}
