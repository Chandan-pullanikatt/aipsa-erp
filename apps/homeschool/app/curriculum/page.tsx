import Link from "next/link";
import type { Metadata } from "next";
import {
  GraduationCap, Heart, Infinity as InfinityIcon, Layers, Sparkles, Target,
  CheckCircle2, XCircle, BookOpen, Calculator, Globe, Palette, FlaskConical,
  Landmark, Brain, Scale, Code2, ShieldCheck, Compass, Users, DoorOpen,
  ClipboardList, Award, ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Curriculum Framework — NEP 2020 | AIPSA Home Schooling",
  description:
    "The complete NEP 2020 course & syllabus catalog we follow — a joyful, structured 5+3+3+4 learning path from Class 1 to lifelong education.",
};

/* ---------- small building blocks ---------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block bg-[#D6F0E4] text-[#0B4D2E] text-[12px] font-semibold tracking-wide uppercase px-3 py-1 rounded-full">
      {children}
    </span>
  );
}

function SectionHead({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="font-display text-[28px] sm:text-[34px] font-bold text-[#1A1D23] mt-3 leading-tight">{title}</h2>
      <p className="font-body text-[15px] sm:text-[16px] text-[#6B7280] mt-2 max-w-3xl">{subtitle}</p>
    </div>
  );
}

function SubjectCard({
  icon: Icon, title, items,
}: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; title: string; items: string[] }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-5 h-5 text-[#26A96B]" strokeWidth={1.75} />
        <h4 className="font-display text-[15px] font-semibold text-[#1A1D23]">{title}</h4>
      </div>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="font-body text-[14px] text-[#4B5563] flex gap-2">
            <span className="text-[#26A96B] mt-[2px]">•</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Section({ id, tone = "surface", children }: { id: string; tone?: "surface" | "white"; children: React.ReactNode }) {
  return (
    <section id={id} className={tone === "white" ? "bg-white" : "bg-[#F7F8FA]"}>
      <div className="max-w-5xl mx-auto px-6 sm:px-10 py-14 sm:py-20">{children}</div>
    </section>
  );
}

/* ---------- data ---------- */

const stages = [
  { n: "5", name: "Foundational", meta: "Ages 3–8 · Classes 1–2" },
  { n: "3", name: "Preparatory", meta: "Ages 8–11 · Classes 3–5" },
  { n: "3", name: "Middle", meta: "Ages 11–14 · Classes 6–8" },
  { n: "4", name: "Secondary", meta: "Ages 14–18 · Classes 9–12" },
];

const leaveBehind = ["Rote memorization", "Exam fear", "Marks obsession", "One-size-fits-all"];
const embrace = ["Joyful learning", "Critical thinking", "Creativity", "Holistic growth"];

/* ---------- page ---------- */

export default function CurriculumPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5 bg-white border-b border-[#E5E7EB] sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2 font-display font-bold text-[18px] text-[#0B4D2E]">
          <GraduationCap className="w-6 h-6" strokeWidth={2} /> AIPSA Home Schooling
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[14px] font-medium text-[#374151] hover:text-[#0B4D2E]">Log in</Link>
          <Link href="/signup" className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] inline-flex items-center rounded-lg transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* hero */}
        <section className="bg-[#0B4D2E] text-white">
          <div className="max-w-5xl mx-auto px-6 sm:px-10 py-20 sm:py-28 text-center">
            <span className="inline-block bg-[#F5B72E] text-[#0B4D2E] text-[12px] font-bold tracking-wide uppercase px-4 py-1.5 rounded-full">
              National Education Policy 2020
            </span>
            <h1 className="font-display text-[38px] sm:text-[54px] font-bold leading-[1.05] mt-6">
              Complete Course &amp;<br />Syllabus Catalog
            </h1>
            <p className="font-body text-[16px] sm:text-[18px] text-white/80 mt-5 max-w-2xl mx-auto">
              The comprehensive learning framework we follow — from joyful foundations to lifelong education.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-9 text-[15px] font-medium">
              <span className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-[#F5B72E]" /> 5+3+3+4 Structure</span>
              <span className="flex items-center gap-2"><Heart className="w-5 h-5 text-[#F5B72E]" /> Joyful Learning</span>
              <span className="flex items-center gap-2"><InfinityIcon className="w-5 h-5 text-[#F5B72E]" /> Lifelong Education</span>
            </div>
          </div>
        </section>

        {/* framework */}
        <Section id="framework" tone="white">
          <SectionHead
            eyebrow="NEP 2020 Framework"
            title="Transforming Indian Education"
            subtitle="A paradigm shift from rote learning to holistic, flexible, and multidisciplinary education."
          />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#0B4D2E] rounded-2xl p-6 text-white">
              <div className="flex items-center gap-2.5 mb-5">
                <Layers className="w-6 h-6 text-[#F5B72E]" />
                <h3 className="font-display text-[20px] font-bold">5+3+3+4 Structure</h3>
              </div>
              <div className="space-y-3">
                {stages.map((s) => (
                  <div key={s.name} className="flex items-center gap-4 bg-white/10 rounded-lg px-4 py-3">
                    <span className="font-display text-[26px] font-bold text-[#F5B72E] w-8">{s.n}</span>
                    <div>
                      <div className="font-display font-semibold text-[15px]">{s.name} Stage</div>
                      <div className="font-body text-[13px] text-white/70">{s.meta}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-[#FDECEC] border-l-4 border-[#E05252] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <XCircle className="w-5 h-5 text-[#E05252]" />
                  <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">What We Leave Behind</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {leaveBehind.map((x) => (
                    <span key={x} className="font-body text-[14px] text-[#4B5563] flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-[#E05252]" /> {x}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-[#E9F7F0] border-l-4 border-[#26A96B] rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-5 h-5 text-[#26A96B]" />
                  <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">What We Embrace</h4>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {embrace.map((x) => (
                    <span key={x} className="font-body text-[14px] text-[#4B5563] flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#26A96B]" /> {x}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-[#FBF3DE] border-l-4 border-[#F5B72E] rounded-xl p-5 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-[#E0A020] mt-0.5" />
                <div>
                  <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">Core Philosophy</h4>
                  <p className="font-body text-[14px] text-[#4B5563] mt-1 italic">“Learning should feel like discovery, not duty.”</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        {/* foundation */}
        <Section id="foundation">
          <SectionHead
            eyebrow="Foundation Stage · Classes 1–2"
            title="Joyful Beginnings"
            subtitle="Ages 6–8 · Play-based · Activity-based · Story-based · No exams."
          />
          <div className="grid md:grid-cols-3 gap-5">
            <SubjectCard icon={BookOpen} title="Foundational Literacy (FLN)" items={[
              "Pre-reading: alphabet, letter-sound mapping, blending",
              "Early reading: picture-word, 2–3 letter words, sight words",
              "Sentence reading: short sentences, expression, punctuation",
            ]} />
            <SubjectCard icon={Calculator} title="Foundational Numeracy (FLN)" items={[
              "Number sense: 1–100, counting with objects, forward/backward",
              "Operations: addition & subtraction through stories (concept first)",
              "Shapes & spatial: 2D shapes, size, near/far",
            ]} />
            <SubjectCard icon={Globe} title="EVS: Life Connected" items={[
              "Self & family · body & feelings",
              "School & neighbourhood",
              "Animals, plants, values & safety",
            ]} />
            <SubjectCard icon={Palette} title="Art & Play" items={[
              "Drawing, colouring, clay & craft",
              "Music, rhythm, dance & movement",
              "Role play & drama",
            ]} />
            <SubjectCard icon={Heart} title="Holistic Development" items={[
              "Emotional: express feelings, build confidence",
              "Social: sharing, teamwork, respect",
              "Physical: running, jumping, yoga, free play",
            ]} />
            <div className="bg-[#0B4D2E] rounded-xl p-5 text-white flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-[#F5B72E]" />
                <h4 className="font-display text-[15px] font-semibold">Expected Outcome</h4>
              </div>
              <p className="font-body text-[14px] text-white/85">Read simple sentences · write basic words · count confidently · speak freely · show empathy.</p>
            </div>
          </div>
        </Section>

        {/* preparatory */}
        <Section id="preparatory" tone="white">
          <SectionHead
            eyebrow="Preparatory Stage · Classes 3–5"
            title="Concept Building"
            subtitle="Ages 8–11 · Activity → Concept → Application → Expression."
          />
          <div className="grid md:grid-cols-3 gap-5">
            <SubjectCard icon={BookOpen} title="Language Development" items={[
              "Reading: stories, poems, informational texts",
              "Who / What / Why / How comprehension",
              "Writing: paragraphs, letters, creative & diary writing",
            ]} />
            <SubjectCard icon={Calculator} title="Mathematics: Logic + Application" items={[
              "Number system up to 10,00,000",
              "All 4 operations · multi-step word problems",
              "Geometry, perimeter/area, fractions, data & money",
            ]} />
            <SubjectCard icon={FlaskConical} title="EVS → Science Transition" items={[
              "Living world: life cycles, habitats, food chains",
              "Earth: air, water, soil, seasons, conservation",
              "Society: community, transport, communication",
            ]} />
            <SubjectCard icon={Landmark} title="Social Science Intro" items={[
              "Local history",
              "Maps & directions",
              "Resources, transport & communication",
            ]} />
            <SubjectCard icon={Brain} title="Cognitive Growth" items={[
              "Logical reasoning",
              "Pattern recognition & sequencing",
              "Decision making",
            ]} />
            <div className="bg-[#E9F7F0] border border-[#C7EBD9] rounded-xl p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-[#26A96B]" />
                <h4 className="font-display text-[15px] font-semibold text-[#0B4D2E]">Class 5 Outcome</h4>
              </div>
              <p className="font-body text-[14px] text-[#4B5563]">Ready for Middle Stage · an independent, curious and confident learner.</p>
            </div>
          </div>
        </Section>

        {/* middle */}
        <Section id="middle">
          <SectionHead
            eyebrow="Middle Stage · Classes 6–8"
            title="Critical Thinking"
            subtitle="Ages 11–14 · Abstract thinking · Subject separation · Why & How questions."
          />
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <SubjectCard icon={FlaskConical} title="Science: Subject Separation" items={[
              "Physics: motion, light, electricity, force & pressure",
              "Biology: organisms, cells, body systems, nutrition",
              "Chemistry: matter, reactions, acids/bases, metals",
            ]} />
            <SubjectCard icon={Calculator} title="Mathematics: Abstract Thinking" items={[
              "Integers, rational numbers, exponents",
              "Algebra: variables, expressions, linear equations",
              "Geometry, congruence, symmetry & data handling",
            ]} />
            <SubjectCard icon={Landmark} title="Social Science Depth" items={[
              "History: ancient to freedom struggle",
              "Geography: landforms, climate, resources",
              "Civics: constitution, rights & duties, democracy",
            ]} />
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <SubjectCard icon={Code2} title="Skill Education (NEP Special)" items={[
              "Digital literacy · cyber safety",
              "Coding logic intro",
              "Financial literacy",
            ]} />
            <div className="bg-[#0B4D2E] rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-5 h-5 text-[#F5B72E]" />
                <h4 className="font-display text-[15px] font-semibold">Class 8: Career Awareness Begins</h4>
              </div>
              <p className="font-body text-[14px] text-white/85">Early exposure to Science / Commerce / Arts pathways · interest discovery · entrepreneurship awareness.</p>
            </div>
          </div>
        </Section>

        {/* secondary */}
        <Section id="secondary" tone="white">
          <SectionHead
            eyebrow="Secondary Stage · Classes 9–10"
            title="Board Readiness + Career Orientation"
            subtitle="Ages 14–16 · Concept mastery · Stream selection · Aptitude validation."
          />
          <div className="grid md:grid-cols-3 gap-5 mb-5">
            <SubjectCard icon={Calculator} title="Mathematics: Proof + Application" items={[
              "Real numbers, Euclid's lemma",
              "Polynomials, linear & quadratic equations, AP",
              "Triangles (proofs), circles, coordinate geometry, trigonometry",
            ]} />
            <SubjectCard icon={FlaskConical} title="Science: Board + Career Base" items={[
              "Physics: electricity, magnetism, light, energy",
              "Biology: life processes, reproduction, environment",
              "Chemistry: reactions, acids/bases, carbon compounds",
            ]} />
            <SubjectCard icon={Landmark} title="Social Science" items={[
              "History: nationalism, world history, globalisation",
              "Geography: resources, agriculture, industries",
              "Civics & economics: federalism, sectors of economy",
            ]} />
          </div>
          <div className="bg-[#FBF3DE] border border-[#F0D98A] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-5 h-5 text-[#E0A020]" />
              <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">Stream Selection Framework</h4>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { s: "Science", d: "Engineering · Medical · Research" },
                { s: "Commerce", d: "CA · Finance · Business · Management" },
                { s: "Arts / Humanities", d: "Law · Civil Services · Media · Design" },
              ].map((x) => (
                <div key={x.s} className="bg-white rounded-lg p-4">
                  <div className="font-display font-semibold text-[15px] text-[#0B4D2E]">{x.s}</div>
                  <div className="font-body text-[13px] text-[#6B7280] mt-1">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* senior secondary */}
        <Section id="senior">
          <SectionHead
            eyebrow="Senior Secondary · Classes 11–12"
            title="Specialization + Flexibility"
            subtitle="Ages 16–18 · Stream depth · Multidisciplinary options · College transition."
          />
          <div className="grid md:grid-cols-3 gap-5">
            <SubjectCard icon={FlaskConical} title="Science Stream" items={[
              "Mathematics: calculus, probability, statistics",
              "Physics: mechanics, electrostatics, modern physics",
              "Chemistry & Biology: organic, genetics, biotechnology",
            ]} />
            <SubjectCard icon={Scale} title="Commerce Stream" items={[
              "Accountancy: partnership, companies, cash flow",
              "Economics: micro, macro, money & banking",
              "Business Studies + optional Applied Maths",
            ]} />
            <SubjectCard icon={BookOpen} title="Arts / Humanities" items={[
              "History, Geography, Political Science",
              "Sociology, Psychology, Economics",
              "Skill & vocational: Coding/AI, Design, Data — NCRF credits",
            ]} />
          </div>
          <p className="font-body text-[14px] text-[#6B7280] mt-5">
            <span className="font-semibold text-[#0B4D2E]">Class 12 outcome:</span> board excellence · college-ready · career clarity · NCRF credits.
          </p>
        </Section>

        {/* higher education */}
        <Section id="higher" tone="white">
          <SectionHead
            eyebrow="Higher Education"
            title="Flexible, Multidisciplinary & Lifelong"
            subtitle="Multiple entry–exit, an Academic Bank of Credits, and research from undergraduate to doctoral study."
          />
          <div className="bg-[#0B4D2E] rounded-2xl p-6 text-white mb-6">
            <div className="flex items-center gap-2.5 mb-5">
              <DoorOpen className="w-6 h-6 text-[#F5B72E]" />
              <h3 className="font-display text-[18px] font-bold">Multiple Entry–Exit (Undergraduate)</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { y: "1 Year", t: "Certificate" },
                { y: "2 Years", t: "Diploma" },
                { y: "3 Years", t: "Bachelor's" },
                { y: "4 Years", t: "Bachelor's + Research" },
              ].map((x) => (
                <div key={x.t} className="bg-white/10 rounded-lg px-4 py-4 text-center">
                  <div className="font-display text-[18px] font-bold text-[#F5B72E]">{x.y}</div>
                  <div className="font-body text-[13px] text-white/80 mt-1">{x.t}</div>
                </div>
              ))}
            </div>
            <p className="font-body text-[13px] text-white/70 mt-4 text-center">Credits secured in ABC · drop &amp; rejoin allowed · portable across universities.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <SubjectCard icon={GraduationCap} title="Undergraduate" items={[
              "Major core + cross-disciplinary minor",
              "Multidisciplinary: AI/ML, coding, ethics, design thinking",
              "Skill & vocational + mandatory research (4-year)",
            ]} />
            <SubjectCard icon={Award} title="Postgraduate (1–2 yrs)" items={[
              "Core specialisation + advanced electives",
              "Mandatory research & thesis",
              "Flexible entry, modular for professionals",
            ]} />
            <SubjectCard icon={Brain} title="Doctoral (PhD, 3–6 yrs)" items={[
              "Coursework, research proposal & core research",
              "Interdisciplinary innovation + IKS",
              "AI-assisted research & global standards",
            ]} />
          </div>
        </Section>

        {/* ecosystem: teacher + lifelong */}
        <Section id="ecosystem">
          <SectionHead
            eyebrow="Complete Ecosystem"
            title="Teacher Education & Lifelong Learning"
            subtitle="Building educators, empowering all ages, and enabling continuous growth."
          />
          <div className="grid md:grid-cols-2 gap-5">
            <SubjectCard icon={Users} title="Teacher Education" items={[
              "4-year integrated B.Ed (mandatory by 2030)",
              "Pedagogy, child development, IKS, NEP-style assessment",
              "AI & analytics: gap detection, adaptive lesson planning",
            ]} />
            <SubjectCard icon={InfinityIcon} title="Lifelong Learning (18+)" items={[
              "Formal, non-formal & informal modes",
              "Skill, upskilling, digital & financial literacy",
              "SWAYAM, DIKSHA, AI-powered mobile-first LMS",
            ]} />
          </div>
        </Section>

        {/* assessment */}
        <Section id="assessment" tone="white">
          <SectionHead
            eyebrow="Assessment Revolution"
            title="Holistic Progress, No Fear"
            subtitle="Portfolio-based, NEP-compliant assessment that supports growth instead of creating pressure."
          />
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-[#FDECEC] border border-[#F4C6C6] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <XCircle className="w-5 h-5 text-[#E05252]" />
                <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">What is NOT Used</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Marks & numerical ranking", "Competitive ranks", "Rote memory tests", "Exam pressure"].map((x) => (
                  <span key={x} className="font-body text-[14px] text-[#4B5563] flex items-start gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-[#E05252] mt-[3px]" /> {x}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-[#E9F7F0] border border-[#C7EBD9] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-5 h-5 text-[#26A96B]" />
                <h4 className="font-display text-[16px] font-bold text-[#0B4D2E]">What IS Used</h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {["Teacher observation", "Activity-based scoring", "Oral responses", "Portfolio evidence", "Conceptual tests", "Projects & presentations"].map((x) => (
                  <span key={x} className="font-body text-[14px] text-[#4B5563] flex items-start gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#26A96B] mt-[3px]" /> {x}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-[#0B4D2E] rounded-xl p-5 mt-6 flex items-start gap-3 text-white">
            <ShieldCheck className="w-6 h-6 text-[#F5B72E] mt-0.5" />
            <div>
              <h4 className="font-display text-[16px] font-semibold">Holistic Progress Card</h4>
              <p className="font-body text-[14px] text-white/85 mt-1">
                Tracks academics, reasoning, creativity, values, fitness & social skills — parent-friendly, NCRF-aligned, DigiLocker &amp; AI-LMS ready. “Assess to support growth, not to create fear.”
              </p>
            </div>
          </div>
        </Section>

        {/* closing CTA */}
        <section className="bg-[#0B4D2E] text-white">
          <div className="max-w-4xl mx-auto px-6 sm:px-10 py-20 text-center">
            <GraduationCap className="w-10 h-10 text-[#F5B72E] mx-auto" />
            <h2 className="font-display text-[30px] sm:text-[40px] font-bold mt-5 leading-tight">
              Building India's Future-Ready Learners
            </h2>
            <p className="font-body text-[16px] text-white/80 mt-4 max-w-2xl mx-auto">
              From joyful discovery in Class 1 to knowledge creation in research — every stage is designed to help your child realise their full potential.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mt-8 text-[14px] font-medium text-white/90">
              <span>5+3+3+4 Structure</span><span>·</span>
              <span>No Rote Learning</span><span>·</span>
              <span>Critical Thinking</span><span>·</span>
              <span>Lifelong Learning</span>
            </div>
            <Link href="/signup" className="mt-10 inline-flex items-center gap-2 bg-[#F5B72E] hover:bg-[#e0a51f] text-[#0B4D2E] font-semibold px-7 h-[50px] rounded-lg transition-colors">
              Start free <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="px-6 sm:px-10 py-6 text-center text-[13px] text-[#6B7280] border-t border-[#E5E7EB] bg-white">
        A product of the All India Private Schools Association (AIPSA).
      </footer>
    </div>
  );
}
