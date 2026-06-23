import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms & Conditions · AIPSA Digital School',
  description: 'The terms that govern your use of AIPSA Digital School.',
};

const UPDATED = 'June 23, 2026';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-10">
        <Link href="/" className="text-[13px] font-medium text-[#1D7A4A] hover:underline">← Back to home</Link>
        <h1 className="font-display text-[28px] sm:text-[32px] font-bold text-[#1A1D23] mt-4">Terms &amp; Conditions</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-6 text-[14px] leading-relaxed text-[#374151]">
          <p>
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the AIPSA Digital
            School website and mobile application (the &ldquo;Service&rdquo;). By creating an account or using the
            Service, you agree to these Terms.
          </p>

          <Section title="1. The Service">
            <p>
              AIPSA Digital School is a multi-tenant school management platform (ERP &amp; LMS). Schools subscribe to
              the Service and provide access to their administrators, teachers, students and parents. Features available
              to you depend on your role and the modules your school has enabled.
            </p>
          </Section>

          <Section title="2. Accounts">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>You are responsible for keeping your login credentials confidential and for all activity under your account.</li>
              <li>You must provide accurate information and keep it up to date.</li>
              <li>Notify your school administrator or us immediately of any unauthorised use of your account.</li>
            </ul>
          </Section>

          <Section title="3. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Use the Service for any unlawful purpose or in violation of these Terms.</li>
              <li>Attempt to gain unauthorised access to any part of the Service or other users&rsquo; data.</li>
              <li>Upload content that is unlawful, harmful, or infringes the rights of others.</li>
              <li>Interfere with or disrupt the integrity or performance of the Service.</li>
            </ul>
          </Section>

          <Section title="4. School-Owned Data">
            <p>
              Data entered into the Service (such as student records, attendance, fees and marks) is owned and
              controlled by the respective school. We process this data on the school&rsquo;s behalf as described in our{' '}
              <Link href="/privacy" className="text-[#1D7A4A] hover:underline">Privacy Policy</Link>.
            </p>
          </Section>

          <Section title="5. Notifications">
            <p>
              The Service may send you notifications by in-app message, push notification, email, SMS or WhatsApp in
              connection with your school&rsquo;s activity. You can manage push and other notification preferences in
              your device or account settings.
            </p>
          </Section>

          <Section title="6. Intellectual Property">
            <p>
              The Service, including its software, design and content (excluding school-owned data), is owned by AIPSA
              and protected by applicable laws. You may not copy, modify, distribute or reverse-engineer any part of the
              Service except as permitted by law.
            </p>
          </Section>

          <Section title="7. Availability">
            <p>
              We aim to keep the Service available and reliable but do not guarantee uninterrupted access. We may modify,
              suspend or discontinue features from time to time.
            </p>
          </Section>

          <Section title="8. Limitation of Liability">
            <p>
              To the maximum extent permitted by law, AIPSA shall not be liable for any indirect, incidental or
              consequential damages arising from your use of the Service. The Service is provided &ldquo;as is&rdquo;
              without warranties of any kind.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              We may suspend or terminate access if these Terms are violated. Your school may also control or revoke your
              access at any time.
            </p>
          </Section>

          <Section title="10. Changes to These Terms">
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes take effect
              constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              Questions about these Terms? Email <a href="mailto:support@aipsa.in" className="text-[#1D7A4A] hover:underline">support@aipsa.in</a>.
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E7EB] text-[13px] text-[#6B7280]">
          See also our <Link href="/privacy" className="text-[#1D7A4A] hover:underline">Privacy Policy</Link>.
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
