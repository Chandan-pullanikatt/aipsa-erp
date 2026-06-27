import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Delete Your Account · AIPSA Digital School',
  description: 'How to request deletion of your AIPSA Digital School account and personal data.',
};

const UPDATED = 'June 27, 2026';

// Public, no-login page. This is the URL submitted in the Google Play Data Safety
// form ("Account deletion"). It must be reachable without signing in so users who
// have lost access can still find the instructions.
export default function AccountDeletionPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-10">
        <Link href="/" className="text-[13px] font-medium text-[#1D7A4A] hover:underline">← Back to home</Link>
        <h1 className="font-display text-[28px] sm:text-[32px] font-bold text-[#1A1D23] mt-4">Delete Your Account</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">Last updated: {UPDATED}</p>

        <div className="prose-legal mt-8 space-y-6 text-[14px] leading-relaxed text-[#374151]">
          <p>
            This page explains how to request deletion of your <strong>AIPSA Digital School</strong> account
            (developed by the All India Private Schools Association) and the personal data associated with it.
          </p>

          <Section title="Request deletion from inside the app">
            <ol className="list-decimal pl-5 space-y-1.5">
              <li>Open the app or website and sign in.</li>
              <li>Go to <strong>Settings → Account &amp; Privacy</strong>.</li>
              <li>Under <strong>Delete account</strong>, type <code>DELETE</code> to confirm and submit.</li>
            </ol>
            <p className="mt-3">
              Your account is deactivated immediately, you are signed out, and push notifications stop right away.
            </p>
          </Section>

          <Section title="Can't sign in? Request by email">
            <p>
              If you can no longer access your account, email{' '}
              <a href="mailto:support@aipsa.in?subject=Account%20deletion%20request" className="text-[#1D7A4A] hover:underline">support@aipsa.in</a>{' '}
              from your registered email address with the subject &ldquo;Account deletion request&rdquo;. We will
              verify your identity and process the request.
            </p>
          </Section>

          <Section title="What gets deleted">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Your profile details — name, email, phone number.</li>
              <li>Your login credentials (password).</li>
              <li>Your mobile push-notification device tokens.</li>
              <li>Your notification preferences and in-app notifications.</li>
            </ul>
          </Section>

          <Section title="What may be retained, and for how long">
            <p>
              Some records are kept where a school is legally required to retain them or where they are needed for
              the school&rsquo;s own accounting and academic records — for example fee receipts, attendance and exam
              results. Where these reference you, they are <strong>anonymised</strong> so they can no longer be linked
              to you personally. Personal data is permanently removed or anonymised within <strong>30 days</strong> of
              your request, unless a longer period is required by law.
            </p>
          </Section>

          <Section title="Note for students and parents">
            <p>
              Student records are managed by your school, which acts as the data controller. If your school&rsquo;s
              account is closed, associated data is deleted or anonymised as described in our{' '}
              <Link href="/privacy" className="text-[#1D7A4A] hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions? Email <a href="mailto:support@aipsa.in" className="text-[#1D7A4A] hover:underline">support@aipsa.in</a>.
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E7EB] text-[13px] text-[#6B7280]">
          See also our <Link href="/privacy" className="text-[#1D7A4A] hover:underline">Privacy Policy</Link> and{' '}
          <Link href="/terms" className="text-[#1D7A4A] hover:underline">Terms &amp; Conditions</Link>.
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[18px] font-semibold text-[#1A1D23] mb-2">{title}</h2>
      {children}
    </section>
  );
}
