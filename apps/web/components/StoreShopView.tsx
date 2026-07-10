'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { ShoppingBag, Loader2, CheckCircle2, Minus, Plus, Package } from 'lucide-react';

const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

interface StoreItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
  imageUrl: string | null;
  stock: number | null; // null = unlimited
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

const CATEGORY_BADGE: Record<string, string> = {
  UNIFORM: 'bg-[#F0F5FF] text-[#1E40AF]',
  BOOKS: 'bg-[#FBF0FF] text-[#6B21A8]',
  MATERIALS: 'bg-[#FFF8E6] text-[#92400E]',
  OTHER: 'bg-[#F3F4F6] text-[#6B7280]',
};

// Reusable store shop. `studentId` optional — a parent buying for a specific child
// passes it; a student buying for themselves omits it (backend resolves the account).
export default function StoreShopView({ studentId, onPurchased }: { studentId?: string; onPurchased?: () => void }) {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [qty, setQty] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/purchases/items');
      setItems(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not load the store.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getQty = (id: string) => qty[id] || 1;
  const setItemQty = (id: string, n: number) => setQty(q => ({ ...q, [id]: Math.max(1, n) }));

  async function buy(item: StoreItem) {
    setError(''); setNotice(''); setBusyId(item.id);
    try {
      const quantity = getQty(item.id);
      const { data } = await api.post('/purchases/checkout', {
        storeItemId: item.id,
        quantity,
        ...(studentId ? { studentId } : {}),
      });

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway. Please try again.');

      const order = data.payment;
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'EduBridge Store',
        description: `${item.name} × ${quantity}`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/purchases/checkout/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setNotice(`Payment successful — ${item.name} × ${quantity} purchased.`);
            await load();
            onPurchased?.();
          } catch {
            setError('Payment received but verification failed. Please contact the school.');
          }
        },
        theme: { color: '#1D7A4A' },
        modal: { ondismiss: () => setBusyId(null) },
      });
      rzp.open();
      setBusyId(null);
    } catch (e: any) {
      setError(e.response?.data?.error || e.message || 'Could not start checkout.');
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading store…</p>;

  return (
    <div className="space-y-4">
      {error && <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</p>}
      {notice && <p className="text-sm font-semibold text-[#0F6E56] bg-[#E5F6EE] border border-[#A7F3D0] rounded-lg px-4 py-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {notice}</p>}

      {items.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 text-center">
          <ShoppingBag className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" />
          <p className="text-sm text-[#9CA3AF]">The store has no items yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map(item => {
            const soldOut = item.stock != null && item.stock <= 0;
            const quantity = getQty(item.id);
            const maxQty = item.stock != null ? item.stock : undefined;
            return (
              <div key={item.id} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden flex flex-col">
                <div className="aspect-square bg-[#F8FAFC] flex items-center justify-center overflow-hidden">
                  {item.imageUrl
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    : <Package className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.5} />}
                </div>
                <div className="p-3 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${CATEGORY_BADGE[item.category] || CATEGORY_BADGE.OTHER}`}>{item.category}</span>
                    {item.stock != null && !soldOut && <span className="text-[9px] font-medium text-[#9CA3AF]">{item.stock} left</span>}
                  </div>
                  <p className="text-sm font-semibold text-[#1A1D23] leading-snug">{item.name}</p>
                  {item.description && <p className="text-[11px] text-[#9CA3AF] mt-0.5 line-clamp-2">{item.description}</p>}
                  <p className="font-mono font-bold text-[#1D7A4A] mt-2">{rupees(item.price)}</p>

                  <div className="mt-auto pt-3">
                    {soldOut ? (
                      <span className="block text-center text-xs font-semibold text-[#9CA3AF] py-2">Sold out</span>
                    ) : (
                      <>
                        <div className="flex items-center justify-center gap-3 mb-2">
                          <button onClick={() => setItemQty(item.id, quantity - 1)} className="w-6 h-6 rounded border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-gray-50"><Minus className="w-3 h-3" /></button>
                          <span className="text-sm font-semibold w-6 text-center">{quantity}</span>
                          <button onClick={() => setItemQty(item.id, maxQty ? Math.min(maxQty, quantity + 1) : quantity + 1)} className="w-6 h-6 rounded border border-[#E5E7EB] flex items-center justify-center text-[#6B7280] hover:bg-gray-50"><Plus className="w-3 h-3" /></button>
                        </div>
                        <button
                          onClick={() => buy(item)}
                          disabled={busyId === item.id}
                          className="w-full bg-[#1D7A4A] hover:bg-[#155B37] disabled:opacity-60 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
                        >
                          {busyId === item.id ? 'Processing…' : `Buy · ${rupees(item.price * quantity)}`}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
