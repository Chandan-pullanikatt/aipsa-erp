import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pre-School Start-up Project · AEPSA',
  description: '10,000 Pre-schools under AEPSA and 1 Lakh Job Opportunities — an initiative for employment and women empowerment.',
};

const PILLARS = [
  {
    title: 'Employment Generation',
    body: 'A nationwide network of pre-schools creating direct and indirect livelihoods — teachers, helpers, administrators and support staff across every district.',
  },
  {
    title: 'Women Empowerment',
    body: 'Priority pathways for women to lead, teach and run neighbourhood pre-schools — turning local talent into entrepreneurs and educators.',
  },
  {
    title: 'End-to-end Support',
    body: 'AEPSA provides curriculum, branding, training and the EduBridge platform so a new pre-school can start with a proven system, not from scratch.',
  },
  {
    title: 'Quality at Scale',
    body: 'A shared standard of early-childhood education across 10,000 centres — consistent learning outcomes, safety and parent trust.',
  },
];

const STEPS = [
  'Express your interest and tell us about your locality.',
  'Get onboarded with AEPSA’s curriculum, branding and training.',
  'Set up your pre-school on the EduBridge platform.',
  'Launch, hire your team, and start enrolling children.',
];

export default function PreSchoolPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA]">
      {/* Hero */}
      <section className="bg-[#0B4D2E] text-white">
        <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
          <Link href="/" className="text-[13px] font-medium text-white/70 hover:text-white">← Back to home</Link>
          <div className="grid md:grid-cols-2 gap-8 items-center mt-6">
            <div>
              <p className="text-[12px] font-semibold tracking-widest uppercase text-[#7CD4A6]">AEPSA Initiative</p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold mt-3 leading-tight">
                10,000 Pre-schools.<br />1 Lakh Job Opportunities.
              </h1>
              <p className="text-white/80 text-sm sm:text-base mt-4 leading-relaxed">
                The Pre-School Start-up Project is AEPSA’s mission to build early-childhood education
                across the country — powering employment and women empowerment, one neighbourhood at a time.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <Link href="/register" className="bg-white text-[#0B4D2E] text-sm font-semibold rounded-lg px-5 py-3 hover:bg-white/90">
                  Register your interest
                </Link>
                <a href="#how-it-works" className="border border-white/30 text-white text-sm font-semibold rounded-lg px-5 py-3 hover:bg-white/10">
                  How it works
                </a>
              </div>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/programs/preschool-startup.jpg" alt="AEPSA Pre-School Start-up Project" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { n: '10,000', l: 'Pre-schools planned' },
            { n: '1 Lakh+', l: 'Job opportunities' },
            { n: 'Pan-India', l: 'District-level reach' },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center shadow-sm">
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#1D7A4A]">{s.n}</p>
              <p className="text-xs text-[#6B7280] mt-1">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="font-display text-2xl font-bold text-[#1A1D23] text-center">Why this matters</h2>
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {PILLARS.map(p => (
            <div key={p.title} className="bg-white rounded-xl border border-[#E5E7EB] p-6">
              <h3 className="font-display font-semibold text-[#0B4D2E]">{p.title}</h3>
              <p className="text-sm text-[#374151] mt-2 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="bg-white border-y border-[#E5E7EB]">
        <div className="max-w-5xl mx-auto px-4 py-12">
          <h2 className="font-display text-2xl font-bold text-[#1A1D23] text-center">How to get started</h2>
          <ol className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((s, i) => (
              <li key={i} className="bg-[#F7F8FA] rounded-xl border border-[#E5E7EB] p-5">
                <div className="w-8 h-8 rounded-full bg-[#1D7A4A] text-white font-bold flex items-center justify-center text-sm">{i + 1}</div>
                <p className="text-sm text-[#374151] mt-3 leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 py-14 text-center">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1A1D23]">Be part of the movement</h2>
        <p className="text-sm text-[#6B7280] mt-3 max-w-xl mx-auto">
          Whether you want to start a pre-school, teach, or join the team — the Pre-School Start-up Project has a place for you.
        </p>
        <Link href="/register" className="inline-block mt-6 bg-[#1D7A4A] text-white text-sm font-semibold rounded-lg px-6 py-3 hover:bg-[#155B37]">
          Register your interest
        </Link>
        <p className="text-[11px] text-[#9CA3AF] mt-8">Powered by All India Private Schools Association (AEPSA)</p>
      </section>
    </main>
  );
}
