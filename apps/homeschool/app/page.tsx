import Link from "next/link";
import { GraduationCap, BookOpen, BarChart3, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2 font-display font-bold text-[18px] text-[#0B4D2E]">
          <GraduationCap className="w-6 h-6" strokeWidth={2} /> AIPSA Home Schooling
        </div>
        <div className="flex items-center gap-3">
          <Link href="/curriculum" className="hidden sm:inline text-[14px] font-medium text-[#374151] hover:text-[#0B4D2E]">Curriculum</Link>
          <Link href="/login" className="text-[14px] font-medium text-[#374151] hover:text-[#0B4D2E]">Log in</Link>
          <Link href="/signup" className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] inline-flex items-center rounded-lg transition-colors">
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 sm:px-10 pt-12 pb-16 max-w-5xl mx-auto text-center">
          <h1 className="font-display text-[40px] sm:text-[52px] font-bold leading-tight text-[#1A1D23]">
            Home schooling,<br /><span className="text-[#1D7A4A]">done properly.</span>
          </h1>
          <p className="font-body text-[16px] sm:text-[18px] text-[#6B7280] mt-5 max-w-2xl mx-auto">
            A structured, grade-by-grade curriculum your family can follow at home — video lessons,
            worksheets and progress tracking for every child, all in one subscription.
          </p>
          <div className="flex items-center justify-center gap-3 mt-8">
            <Link href="/signup" className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white font-medium px-6 h-[46px] inline-flex items-center rounded-lg transition-colors">
              Start free
            </Link>
            <Link href="/login" className="bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[#1A1D23] font-medium px-6 h-[46px] inline-flex items-center rounded-lg transition-colors">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="px-6 sm:px-10 pb-20 max-w-5xl mx-auto grid sm:grid-cols-3 gap-5">
          {[
            { icon: BookOpen, title: "Structured catalog", body: "An NEP 2020 curriculum organised by grade and subject — a clear path, not scattered videos.", href: "/curriculum" },
            { icon: Users, title: "Every child", body: "Add each of your children and track them separately under one family account.", href: undefined },
            { icon: BarChart3, title: "Real progress", body: "Mark lessons complete and see how far each child has come.", href: undefined },
          ].map((f) => {
            const inner = (
              <>
                <f.icon className="w-7 h-7 text-[#26A96B]" strokeWidth={1.75} />
                <h3 className="font-display text-[16px] font-semibold text-[#1A1D23] mt-3">{f.title}</h3>
                <p className="font-body text-[14px] text-[#6B7280] mt-1.5">{f.body}</p>
                {f.href && <span className="font-body text-[13px] font-medium text-[#1D7A4A] mt-3 inline-block">View the framework →</span>}
              </>
            );
            return f.href ? (
              <Link key={f.title} href={f.href} className="bg-white border border-[#E5E7EB] hover:border-[#26A96B] rounded-xl p-6 text-left transition-colors">
                {inner}
              </Link>
            ) : (
              <div key={f.title} className="bg-white border border-[#E5E7EB] rounded-xl p-6 text-left">
                {inner}
              </div>
            );
          })}
        </section>
      </main>

      <footer className="px-6 sm:px-10 py-6 text-center text-[13px] text-[#6B7280] border-t border-[#E5E7EB]">
        A product of the All India Private Schools Association (AIPSA).
      </footer>
    </div>
  );
}
