'use client';

import ProgramsBrowse from '@/components/ProgramsBrowse';

// A student registers for themselves — no studentId needed (the API resolves it).
export default function StudentProgramsPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <ProgramsBrowse />
    </div>
  );
}
