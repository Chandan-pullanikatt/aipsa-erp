'use client';

// Per-user notification channel preferences. Reachable at /settings/notifications
// for any logged-in dashboard user. Backed by /communication/notification-preferences.
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Bell, Mail, Smartphone, MessageSquare, MessageCircle } from 'lucide-react';

type Prefs = { inApp: boolean; email: boolean; push: boolean; sms: boolean; whatsapp: boolean };

const CHANNELS: { key: keyof Prefs; label: string; desc: string; icon: any }[] = [
  { key: 'inApp', label: 'In-app', desc: 'Notifications inside the app (bell icon).', icon: Bell },
  { key: 'push', label: 'Mobile push', desc: 'Push notifications on your phone.', icon: Smartphone },
  { key: 'email', label: 'Email', desc: 'Updates sent to your email address.', icon: Mail },
  { key: 'sms', label: 'SMS', desc: 'Text messages to your phone number.', icon: MessageSquare },
  { key: 'whatsapp', label: 'WhatsApp', desc: 'Messages on WhatsApp.', icon: MessageCircle },
];

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get('/communication/notification-preferences')
      .then(({ data }) => setPrefs({
        inApp: data.inApp, email: data.email, push: data.push, sms: data.sms, whatsapp: data.whatsapp,
      }))
      .catch(() => setPrefs({ inApp: true, email: true, push: true, sms: false, whatsapp: false }));
  }, []);

  async function toggle(key: keyof Prefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(key);
    try {
      await api.patch('/communication/notification-preferences', { [key]: next[key] });
    } catch {
      setPrefs(prefs); // revert on failure
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-[#E5E7EB]">
        <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">Notification Preferences</h1>
        <p className="font-body text-[14px] text-[#6B7280] mt-1">Choose how you want to be notified about fees, attendance and announcements.</p>
      </div>

      {!prefs ? (
        <div className="space-y-3">
          {CHANNELS.map((c) => <div key={c.key} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
          {CHANNELS.map(({ key, label, desc, icon: Icon }) => (
            <div key={key} className="flex items-center gap-4 px-5 py-4">
              <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center shrink-0">
                <Icon className="w-4.5 h-4.5" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-[14px] font-semibold text-[#1A1D23]">{label}</p>
                <p className="font-body text-[12px] text-[#6B7280]">{desc}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-label={`Toggle ${label}`}
                disabled={saving === key}
                onClick={() => toggle(key)}
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60 ${prefs[key] ? 'bg-[#26A96B]' : 'bg-[#D1D5DB]'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="font-body text-[12px] text-[#9CA3AF]">
        SMS and WhatsApp are charged per message and may require your number to be verified by the school.
      </p>
    </div>
  );
}
