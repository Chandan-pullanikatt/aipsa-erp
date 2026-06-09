'use client';

import { Building2 } from 'lucide-react';
import HostelView from '@/components/HostelView';

export default function StudentHostelPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><Building2 className="w-6 h-6 text-[#1D7A4A]" /> My Hostel</h1>
      <HostelView />
    </div>
  );
}
