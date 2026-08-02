'use client';

// The school's own name and logo at the top of every academic document a family can
// print — per-exam mark sheets and the holistic progress card. Those sheets leave the
// app (they get filed, signed and stamped), so they have to identify the school that
// issued them rather than the platform.
//
// Branding comes from the same cached `/schools/profile` the sidebar uses, so on a
// warm pane it paints with no request and no flash.

import { GraduationCap } from 'lucide-react';
import { useBranding } from '@/lib/branding';

interface Props {
  /** Document title, e.g. "Holistic Progress Card". */
  title: string;
  /** Small line under the title — academic year, exam name. */
  subtitle?: string;
  /** `dark` sits on the green header band; `plain` on white paper. */
  tone?: 'plain' | 'dark';
  align?: 'left' | 'center';
  className?: string;
}

export default function ReportLetterhead({ title, subtitle, tone = 'plain', align = 'left', className = '' }: Props) {
  const { logo, schoolName } = useBranding();
  const dark = tone === 'dark';
  const centered = align === 'center';

  return (
    <div className={`flex items-center gap-3 ${centered ? 'flex-col text-center' : ''} ${className}`}>
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className={`w-12 h-12 rounded-lg object-contain shrink-0 ${dark ? 'bg-white/95 p-0.5' : 'bg-white'}`}
        />
      ) : (
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-white/15' : 'bg-[#E5F6EE]'}`}>
          <GraduationCap className={`w-6 h-6 ${dark ? 'text-white/80' : 'text-[#1D7A4A]'}`} strokeWidth={1.75} />
        </div>
      )}
      <div className="min-w-0">
        <p className={`font-display font-bold leading-tight tracking-wide ${dark ? 'text-white text-lg' : 'text-gray-900 text-base uppercase'}`}>
          {schoolName || 'EduBridge'}
        </p>
        <p className={`font-display font-semibold uppercase tracking-wider text-[11px] mt-0.5 ${dark ? 'text-white/85' : 'text-[#1D7A4A]'}`}>
          {title}
        </p>
        {subtitle && (
          <p className={`text-[10px] mt-0.5 ${dark ? 'text-white/70' : 'text-gray-400'}`}>{subtitle}</p>
        )}
      </div>
    </div>
  );
}
