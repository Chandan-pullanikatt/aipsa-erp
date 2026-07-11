'use client';

import { Megaphone, CalendarClock, Palette, CheckSquare, ThumbsUp, ThumbsDown, Share2 } from 'lucide-react';

// Static reference page: the marketing duties, branding guidelines and social-media
// tasks a school team should execute as part of school branding. Content-only for
// now; can be made editable per-school later if needed.

const CADENCE = [
  {
    period: 'Daily',
    icon: Share2,
    tasks: [
      'Post 1 story/update — a classroom moment, activity or student achievement.',
      'Reply to comments and direct messages within the day.',
      'Re-share any positive parent feedback or tags.',
    ],
  },
  {
    period: 'Weekly',
    icon: CalendarClock,
    tasks: [
      '2–3 feed posts (photos/reels): events, toppers, teacher spotlights, tips for parents.',
      'One “behind the scenes” or facility highlight.',
      'Review reach/engagement and note what worked.',
    ],
  },
  {
    period: 'Monthly',
    icon: CalendarClock,
    tasks: [
      'Plan a content calendar for the next month (festivals, exams, admissions).',
      'One admission/enrolment campaign post or ad.',
      'Collect and publish 1–2 parent testimonials.',
    ],
  },
];

const BRANDING = [
  'Always use the official school logo — never stretched, recoloured or low-resolution.',
  'Stick to the school’s brand colours and fonts across posts and print.',
  'Keep a consistent, warm and professional tone in all captions.',
  'Add the school name/handle and a call-to-action on promotional creatives.',
  'Get consent before posting identifiable photos of children.',
];

const DUTIES = [
  'Own the school’s social media accounts (Instagram, Facebook, YouTube, WhatsApp).',
  'Maintain the content calendar and ensure posts go out on schedule.',
  'Coordinate with teachers to capture photos/videos of activities and events.',
  'Design creatives for admissions, events and announcements.',
  'Respond to enquiries from prospective parents promptly.',
  'Track followers, reach and enquiries; report monthly to the Principal.',
  'Manage listings and reviews on Google/JustDial and reply to reviews.',
];

const DOS = [
  'Showcase real students, teachers and events (with consent).',
  'Use clear, well-lit photos and short captions.',
  'Highlight results, activities and values that build trust.',
  'Respond quickly and courteously to every enquiry.',
];

const DONTS = [
  'Don’t post blurry, cluttered or off-brand creatives.',
  'Don’t share children’s photos/details without parental consent.',
  'Don’t engage in negative comparisons with other schools.',
  'Don’t leave enquiries or negative reviews unanswered.',
];

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-[#E5E7EB] p-5 ${className}`}>{children}</div>;
}

export default function MarketingPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><Megaphone className="w-6 h-6 text-[#1D7A4A]" /> Marketing &amp; School Branding</h1>
        <p className="text-sm text-[#6B7280] font-medium mt-1">Duties, guidelines and social-media tasks for building the school&apos;s brand.</p>
      </div>

      {/* Cadence */}
      <div className="grid md:grid-cols-3 gap-4">
        {CADENCE.map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.period}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                <h2 className="font-display font-semibold text-[#1A1D23]">{c.period}</h2>
              </div>
              <ul className="space-y-2">
                {c.tasks.map((t, i) => <li key={i} className="text-sm text-[#374151] leading-relaxed flex gap-2"><span className="text-[#1D7A4A] mt-0.5">•</span> {t}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>

      {/* Duties */}
      <Card>
        <div className="flex items-center gap-2 mb-3"><CheckSquare className="w-5 h-5 text-[#1D7A4A]" /><h2 className="font-display font-semibold text-[#1A1D23]">Marketing Duties</h2></div>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {DUTIES.map((d, i) => <div key={i} className="text-sm text-[#374151] leading-relaxed flex gap-2"><span className="text-[#1D7A4A] mt-0.5">•</span> {d}</div>)}
        </div>
      </Card>

      {/* Branding guidelines */}
      <Card>
        <div className="flex items-center gap-2 mb-3"><Palette className="w-5 h-5 text-[#1D7A4A]" /><h2 className="font-display font-semibold text-[#1A1D23]">Branding Guidelines</h2></div>
        <ul className="space-y-2">
          {BRANDING.map((b, i) => <li key={i} className="text-sm text-[#374151] leading-relaxed flex gap-2"><span className="text-[#1D7A4A] mt-0.5">•</span> {b}</li>)}
        </ul>
      </Card>

      {/* Do / Don't */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-[#A7F3D0]">
          <div className="flex items-center gap-2 mb-3"><ThumbsUp className="w-5 h-5 text-[#0F6E56]" /><h2 className="font-display font-semibold text-[#0F6E56]">Do</h2></div>
          <ul className="space-y-2">{DOS.map((d, i) => <li key={i} className="text-sm text-[#374151] leading-relaxed flex gap-2"><span className="text-[#0F6E56] mt-0.5">✓</span> {d}</li>)}</ul>
        </Card>
        <Card className="border-[#FECACA]">
          <div className="flex items-center gap-2 mb-3"><ThumbsDown className="w-5 h-5 text-[#B91C1C]" /><h2 className="font-display font-semibold text-[#B91C1C]">Don&apos;t</h2></div>
          <ul className="space-y-2">{DONTS.map((d, i) => <li key={i} className="text-sm text-[#374151] leading-relaxed flex gap-2"><span className="text-[#B91C1C] mt-0.5">✕</span> {d}</li>)}</ul>
        </Card>
      </div>
    </div>
  );
}
