'use client';

import { Library } from 'lucide-react';
import LibraryView from '@/components/LibraryView';

export default function StudentLibraryPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><Library className="w-6 h-6 text-[#1D7A4A]" /> My Library</h1>
      <LibraryView />
    </div>
  );
}
