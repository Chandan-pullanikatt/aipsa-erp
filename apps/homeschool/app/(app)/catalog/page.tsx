'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Layers } from 'lucide-react';
import api from '@/lib/api';

interface Course {
  id: string; title: string; description: string | null;
  subject: string; gradeLevel: string; coverUrl: string | null;
  _count: { modules: number };
}

export default function CatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/homeschool/catalog').then((r) => setCourses(r.data)).finally(() => setLoading(false));
  }, []);

  const filtered = courses.filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.subject.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">Course catalog</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Pick a course to start learning.</p>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses…" className="sm:w-64" />
      </div>

      {loading ? (
        <div className="py-32 text-center text-[14px] text-[#6B7280]">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-16 text-center">
          <BookOpen className="w-10 h-10 text-[#D1D5DB] mx-auto" strokeWidth={1.5} />
          <p className="text-[14px] text-[#6B7280] mt-3">No courses found.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden hover:border-[#26A96B] transition-colors">
              <div className="h-28 bg-gradient-to-br from-[#1D7A4A] to-[#26A96B] flex items-center justify-center">
                {c.coverUrl
                  ? <img src={c.coverUrl} alt="" className="w-full h-full object-cover" />
                  : <BookOpen className="w-9 h-9 text-white/90" strokeWidth={1.5} />}
              </div>
              <div className="p-4">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1D7A4A] bg-[#D6F0E4] px-2 py-0.5 rounded">{c.gradeLevel}</span>
                <h3 className="font-display text-[16px] font-semibold text-[#1A1D23] mt-2">{c.title}</h3>
                <p className="text-[13px] text-[#6B7280] mt-1 line-clamp-2">{c.description}</p>
                <div className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF] mt-3">
                  <Layers className="w-3.5 h-3.5" /> {c._count.modules} module{c._count.modules !== 1 ? 's' : ''}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
