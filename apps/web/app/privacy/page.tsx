import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy · AIPSA Digital School',
  description: 'How AIPSA Digital School collects, uses and protects your information.',
};

const UPDATED = 'June 23, 2026';

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#F7F8FA] py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#E5E7EB] p-6 sm:p-10">
        <Link href="/" className="text-[13px] font-medium text-[#1D7A4A] hover:underline">← Back to home</Link>
        <h1 className="font-display text-[28px] sm:text-[32px] font-bold text-[#1A1D23] mt-4">Privacy Policy</h1>
        <p className="text-[13px] text-[#6B7280] mt-1">Last updated: {UPDATED}</p>

        <div className="prose-legal mt-8 space-y-6 text-[14px] leading-relaxed text-[#374151]">
          <p>
            AIPSA Digital School (&ldquo;AIPSA&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) provides a school
            management platform (ERP &amp; LMS) used by schools, their staff, students and parents. This policy
            explains what information we collect, how we use it, and the choices you have. By using our website or
            mobile app you agree to this policy.
          </p>

          <Section title="1. Information We Collect">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account information</strong> — name, email, phone number, role, and the school you belong to.</li>
              <li><strong>School records</strong> — attendance, fees, marks, timetables, homework and similar data entered by your school.</li>
              <li><strong>Device information</strong> — for the mobile app: a push-notification token and basic device/app version data.</li>
              <li><strong>Files you upload</strong> — documents, photos or other files you choose to attach within the app.</li>
              <li><strong>Usage data</strong> — log information needed to operate and secure the service.</li>
            </ul>
          </Section>

          <Section title="2. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To operate the platform and provide the features your school has enabled.</li>
              <li>To send notifications (in-app, push, email, SMS or WhatsApp) about events relevant to you, such as announcements, fee reminders and attendance.</li>
              <li>To authenticate you and keep your account secure.</li>
              <li>To provide support and to improve and maintain the service.</li>
            </ul>
          </Section>

          <Section title="3. Permissions Used by the Mobile App">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Notifications</strong> — to deliver alerts from your school. You can disable these in your device settings at any time.</li>
              <li><strong>Storage / Photos / Camera</strong> — only when you choose to upload or capture a file. We do not access your files in the background.</li>
            </ul>
          </Section>

          <Section title="4. How Information Is Shared">
            <p>
              Your data is visible to authorised users of your own school (for example, administrators and teachers)
              as required to run the school. We do not sell your personal information. We share data only with service
              providers that help us operate the platform (such as hosting, email, SMS/WhatsApp and push delivery) and
              when required by law.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We keep your information for as long as your school maintains an active account, or as needed to comply
              with legal obligations. When a school account is closed, associated data is deleted or anonymised within a
              reasonable period unless retention is legally required.
            </p>
          </Section>

          <Section title="6. Security">
            <p>
              We use industry-standard measures — encryption in transit, hashed passwords and access controls — to
              protect your information. No method of transmission or storage is completely secure, but we work to
              protect your data and respond promptly to any incident.
            </p>
          </Section>

          <Section title="7. Children&rsquo;s Privacy">
            <p>
              Student data is provided and managed by schools acting on behalf of parents/guardians. We process such
              data only to provide the service to the school and do not use it for advertising.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>
              You may request access to, correction of, or deletion of your personal information by contacting your
              school administrator or us at the address below. Some requests may be fulfilled by your school as the data
              controller.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this policy from time to time. Material changes will be reflected by the &ldquo;Last
              updated&rdquo; date above.
            </p>
          </Section>

          <Section title="10. Contact Us">
            <p>
              Questions about this policy? Email <a href="mailto:support@aipsa.in" className="text-[#1D7A4A] hover:underline">support@aipsa.in</a>.
            </p>
          </Section>
        </div>

        <div className="mt-10 pt-6 border-t border-[#E5E7EB] text-[13px] text-[#6B7280]">
          See also our <Link href="/terms" className="text-[#1D7A4A] hover:underline">Terms &amp; Conditions</Link>.
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
