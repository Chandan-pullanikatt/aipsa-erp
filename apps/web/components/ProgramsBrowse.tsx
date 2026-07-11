'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Award, Search, CheckCircle2, Clock, IndianRupee, Users2, CalendarDays } from 'lucide-react';

interface ProgramItem { id: string; name: string; fee: number | null; }
interface Program {
  id: string;
  type: 'COMPETITION' | 'TUITION' | 'TRAINING' | 'COUNSELING' | 'EVENT';
  category: string | null;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  fee: number;
  capacity: number | null;
  closesAt: string | null;
  requiresTeacherMatch: boolean;
  items: ProgramItem[];
}
interface Registration {
  id: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  paymentStatus: string;
  amount: number;
  program: { id: string; title: string; type: string };
  programItem: { id: string; name: string } | null;
  assignedTeacher: { firstName: string; lastName: string } | null;
  createdAt: string;
}

declare global { interface Window { Razorpay: any; } }

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

const TYPE_TABS: { key: string; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'COMPETITION', label: 'Competitions' },
  { key: 'TUITION', label: '1-to-1 Tuition' },
  { key: 'TRAINING', label: 'Training' },
  { key: 'COUNSELING', label: 'Counseling' },
  { key: 'EVENT', label: 'Events' },
];

const TYPE_BADGE: Record<string, string> = {
  COMPETITION: 'bg-[#FFF8E6] text-[#92400E] border-[#FEEBAD]',
  TUITION: 'bg-[#F0F5FF] text-[#1E40AF] border-[#BFDBFE]',
  TRAINING: 'bg-[#FBF0FF] text-[#6B21A8] border-[#E9D5FF]',
  COUNSELING: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]',
  EVENT: 'bg-[#FFF5F5] text-[#9B1C1C] border-[#FEB2B2]',
};

const rupee = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Shared program browser used by both the student and parent pages. When a parent
// registers for a specific child, pass that child's `studentId`.
export default function ProgramsBrowse({ studentId }: { studentId?: string }) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [tab, setTab] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const [p, r] = await Promise.allSettled([
        api.get('/programs'),
        api.get('/programs/me/registrations'),
      ]);
      if (p.status === 'fulfilled') setPrograms(p.value.data);
      else setError(p.reason?.response?.data?.error || 'Failed to load programs.');
      if (r.status === 'fulfilled') setRegs(r.value.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const registeredProgramIds = new Set(
    regs.filter(r => r.status !== 'CANCELLED').map(r => r.program.id),
  );

  function feeFor(p: Program): number {
    const itemId = chosen[p.id];
    if (itemId) {
      const it = p.items.find(i => i.id === itemId);
      if (it && it.fee != null) return it.fee;
    }
    return p.fee;
  }

  async function handleRegister(p: Program) {
    setError(null); setNotice(null); setBusyId(p.id);
    try {
      if (p.items.length > 0 && !chosen[p.id]) {
        setError('Please choose an option for this program first.');
        setBusyId(null);
        return;
      }
      const payload: any = { programId: p.id };
      if (chosen[p.id]) payload.programItemId = chosen[p.id];
      if (studentId) payload.studentId = studentId;

      const { data } = await api.post('/programs/register', payload);

      if (!data.payment) {
        setNotice(`Registered for "${p.title}". The school has been notified.`);
        await load();
        setBusyId(null);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway. Please try again.');
      const order = data.payment;
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'EduBridge',
        description: p.title,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/programs/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setNotice(`Payment successful — you're registered for "${p.title}".`);
            await load();
          } catch {
            setError('Payment received but verification failed. Please contact the school.');
          }
        },
        theme: { color: '#1D7A4A' },
        modal: { ondismiss: () => setBusyId(null) },
      });
      rzp.open();
      setBusyId(null);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Could not register.');
      setBusyId(null);
    }
  }

  const filtered = programs.filter(p =>
    (tab === 'ALL' || p.type === tab) &&
    (!search || p.title.toLowerCase().includes(search.toLowerCase()) || (p.category || '').toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div className="space-y-6 font-body">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center">
            <Award className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#1A1D23]">Programs &amp; Registrations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Competitions, tuition, training, counseling and events</p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs…"
            className="w-full md:w-64 border border-[#E5E7EB] rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent text-gray-700 bg-white"
          />
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-lg">{error}</div>}
      {notice && <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs px-4 py-3 rounded-lg flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {notice}</div>}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-gray-600 hover:border-gray-300'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 text-center text-gray-400 text-sm">Loading programs…</div>
      ) : filtered.length === 0 ? (
        <div className="py-24 text-center border border-[#E5E7EB] bg-white rounded-xl">
          <p className="text-gray-500 text-sm">No programs available in this category yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => {
            const already = registeredProgramIds.has(p.id);
            const fee = feeFor(p);
            const closed = p.closesAt && new Date(p.closesAt) < new Date();
            return (
              <div key={p.id} className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden flex flex-col">
                {p.bannerUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.bannerUrl} alt={p.title} className="w-full h-32 object-cover" />
                )}
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${TYPE_BADGE[p.type]}`}>
                      {p.category || TYPE_TABS.find(t => t.key === p.type)?.label || p.type}
                    </span>
                    {fee > 0
                      ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600 inline-flex items-center"><IndianRupee className="w-2.5 h-2.5" />{fee.toLocaleString('en-IN')}</span>
                      : <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Free</span>}
                  </div>
                  <h3 className="font-display font-semibold text-[#1A1D23] text-sm leading-snug">{p.title}</h3>
                  {p.description && <p className="text-xs text-gray-500 mt-1 line-clamp-3">{p.description}</p>}

                  <div className="flex flex-wrap gap-3 mt-3 text-[11px] text-gray-400">
                    {p.capacity != null && <span className="inline-flex items-center gap-1"><Users2 className="w-3 h-3" /> {p.capacity} seats</span>}
                    {p.closesAt && <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" /> Closes {new Date(p.closesAt).toLocaleDateString('en-IN')}</span>}
                  </div>

                  {p.items.length > 0 && (
                    <select
                      value={chosen[p.id] || ''}
                      onChange={e => setChosen(c => ({ ...c, [p.id]: e.target.value }))}
                      disabled={already}
                      className="mt-3 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]"
                    >
                      <option value="">Choose an option…</option>
                      {p.items.map(it => (
                        <option key={it.id} value={it.id}>
                          {it.name}{it.fee != null ? ` — ${rupee(it.fee)}` : ''}
                        </option>
                      ))}
                    </select>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100">
                    {already ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Registered</span>
                    ) : closed ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400"><Clock className="w-4 h-4" /> Registration closed</span>
                    ) : (
                      <button
                        onClick={() => handleRegister(p)}
                        disabled={busyId === p.id}
                        className="w-full bg-[#1D7A4A] hover:bg-[#155B37] disabled:opacity-60 text-white text-xs font-semibold rounded-lg py-2.5 transition-colors"
                      >
                        {busyId === p.id ? 'Processing…' : fee > 0 ? `Register & Pay ${rupee(fee)}` : 'Register (Free)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {regs.length > 0 && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
          <h2 className="font-display font-semibold text-sm text-[#1A1D23] mb-3">My Registrations</h2>
          <div className="divide-y divide-gray-50">
            {regs.map(r => (
              <div key={r.id} className="py-3 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-800 truncate">
                    {r.program.title}{r.programItem ? ` — ${r.programItem.name}` : ''}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {new Date(r.createdAt).toLocaleDateString('en-IN')}
                    {r.assignedTeacher && ` · Teacher: ${r.assignedTeacher.firstName} ${r.assignedTeacher.lastName}`}
                    {r.amount > 0 && ` · ${rupee(r.amount)}`}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded shrink-0 ${
                  r.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700'
                    : r.status === 'PENDING' ? 'bg-amber-50 text-amber-700'
                      : 'bg-gray-100 text-gray-500'
                }`}>
                  {r.status === 'PENDING' && r.paymentStatus === 'PENDING' ? 'PAYMENT PENDING' : r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
