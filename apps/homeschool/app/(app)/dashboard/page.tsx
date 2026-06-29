'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, BookOpen, CheckCircle2, Lock, X } from 'lucide-react';
import api from '@/lib/api';
import { setActiveLearner } from '@/lib/learner';

declare global {
  interface Window { Razorpay: any }
}

interface Learner { id: string; firstName: string; lastName: string; gradeLevel: string | null }
interface SubStatus { active: boolean; currentPeriodEnd: string | null; price: number; months: number }

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function DashboardPage() {
  const router = useRouter();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', gradeLevel: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [l, s] = await Promise.all([
      api.get('/homeschool/learners'),
      api.get('/homeschool/subscription/status'),
    ]);
    setLearners(l.data);
    setSub(s.data);
  }, []);

  useEffect(() => { load().catch(() => setError('Failed to load your account.')).finally(() => setLoading(false)); }, [load]);

  async function addLearner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/homeschool/learners', form);
      setForm({ firstName: '', lastName: '', gradeLevel: '' });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not add the child.');
    } finally { setSaving(false); }
  }

  function openLearner(id: string) {
    setActiveLearner(id);
    router.push('/catalog');
  }

  async function subscribe() {
    setError('');
    try {
      const ok = await loadRazorpay();
      if (!ok) { setError('Could not load the payment window. Check your connection.'); return; }
      const { data } = await api.post('/homeschool/subscription/initiate');
      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'AIPSA Home Schooling',
        description: `${data.months}-month family access`,
        order_id: data.orderId,
        handler: async (resp: any) => {
          try {
            await api.post('/homeschool/subscription/verify', {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            await load();
          } catch { setError('Payment verification failed. Contact support if you were charged.'); }
        },
        theme: { color: '#1D7A4A' },
      });
      rzp.open();
    } catch (err: any) {
      setError(err.response?.status === 503
        ? 'Payments are not configured yet. Please try again later.'
        : (err.response?.data?.error || 'Could not start the subscription.'));
    }
  }

  if (loading) return <div className="py-32 text-center text-[14px] text-[#6B7280]">Loading…</div>;

  return (
    <div className="space-y-8">
      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-[13px] px-4 py-2.5 rounded-lg">{error}</div>}

      {/* Subscription banner */}
      {sub?.active ? (
        <div className="bg-[#D6F0E4] border border-[#26A96B]/30 rounded-xl px-5 py-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#0F6E56]" />
          <div className="text-[14px] text-[#0F6E56]">
            <span className="font-semibold">Subscription active</span>
            {sub.currentPeriodEnd && <> · access until {new Date(sub.currentPeriodEnd).toLocaleDateString('en-IN')}</>}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#D97706] mt-0.5" />
            <div className="text-[14px] text-[#374151]">
              <span className="font-semibold text-[#1A1D23]">Unlock the full catalog</span>
              <p className="text-[#6B7280] mt-0.5">
                ₹{sub?.price} for {sub?.months} months — every course, for all your children. Free preview lessons are open now.
              </p>
            </div>
          </div>
          <button onClick={subscribe} className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-5 h-[40px] rounded-lg shrink-0 self-start sm:self-center">
            Subscribe
          </button>
        </div>
      )}

      {/* Learners */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">My children</h1>
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] rounded-lg">
            <UserPlus className="w-4 h-4" /> Add child
          </button>
        </div>

        {learners.length === 0 ? (
          <div className="bg-white border border-[#E5E7EB] rounded-xl py-16 text-center">
            <BookOpen className="w-10 h-10 text-[#D1D5DB] mx-auto" strokeWidth={1.5} />
            <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No children added yet</h3>
            <p className="text-[14px] text-[#6B7280] mt-1">Add your first child to start learning.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {learners.map((l) => (
              <div key={l.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex items-center justify-between">
                <div>
                  <p className="font-display text-[16px] font-semibold text-[#1A1D23]">{l.firstName} {l.lastName}</p>
                  <p className="text-[13px] text-[#6B7280] mt-0.5">{l.gradeLevel || 'Grade not set'}</p>
                </div>
                <button onClick={() => openLearner(l.id)} className="text-[14px] font-medium text-[#1D7A4A] hover:underline">
                  Continue →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92vw] p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[18px] font-semibold">Add a child</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={addLearner} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">First name</label>
                  <input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="w-full" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Last name</label>
                  <input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Grade <span className="text-[#9CA3AF]">(optional)</span></label>
                <input value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} placeholder="e.g. Grade 5" className="w-full" />
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setShowForm(false)} className="bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[14px] font-medium px-4 h-[38px] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] rounded-lg disabled:opacity-50">
                  {saving ? 'Adding…' : 'Add child'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
