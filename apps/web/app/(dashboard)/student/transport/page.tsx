'use client';

import { Bus } from 'lucide-react';
import TransportView from '@/components/TransportView';

export default function StudentTransportPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><Bus className="w-6 h-6 text-[#1D7A4A]" /> My Transport</h1>
      <TransportView />
    </div>
  );
}
