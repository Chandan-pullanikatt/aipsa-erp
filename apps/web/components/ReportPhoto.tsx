'use client';

// The student's photo as it appears on report cards — one frame spec shared by the
// exam report cards so the school copy and the family copy match. Falls back to
// initials rather than an empty box, since plenty of students have no photo on file.

export default function ReportPhoto({
  src,
  name,
  size = 64,
  tone = 'plain',
}: {
  src?: string | null;
  name: string;
  /** Rendered box in px; the frame is square with a soft radius. */
  size?: number;
  /** `dark` sits on a dark header band; `plain` on white paper. */
  tone?: 'plain' | 'dark';
}) {
  const dark = tone === 'dark';
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  const box = { width: size, height: size } as const;

  if (!src) {
    return (
      <div
        style={box}
        className={`rounded-xl shrink-0 flex items-center justify-center font-display font-bold ${dark ? 'bg-white/15 text-white/80 border border-white/25' : 'bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]'}`}
      >
        <span style={{ fontSize: Math.round(size * 0.32) }}>{initials || '—'}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      style={box}
      className={`rounded-xl object-cover shrink-0 ${dark ? 'border-2 border-white/40' : 'border border-[#E5E7EB]'}`}
    />
  );
}
