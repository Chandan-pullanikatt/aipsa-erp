'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Megaphone, Plus, Edit2, Trash2, X, Pin } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: string;
  targetRoles: string[];
  isPinned: boolean;
  publishedAt: string;
  expiresAt: string | null;
  createdBy: { firstName: string; lastName: string };
}

const TYPE_STYLES: Record<string, string> = {
  ANNOUNCEMENT: 'bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF]',
  CIRCULAR: 'bg-[#F3E8FF] text-[#6B21A8] border border-[#F3E8FF]',
  EVENT: 'bg-[#D6F0E4] text-[#0F6E56] border border-[#D6F0E4]',
  ALERT: 'bg-[#FEE2E2] text-[#991B1B] border border-[#FEE2E2]',
};

const ROLES = ['ALL', 'TEACHER', 'STUDENT', 'PARENT', 'SCHOOL_ADMIN'];

const EMPTY_FORM = { title: '', body: '', type: 'ANNOUNCEMENT', targetRoles: ['ALL'], isPinned: false, expiresAt: '' };

export default function CommunicationPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (typeFilter) params.type = typeFilter;
      const { data } = await api.get('/communication/announcements', { params });
      setItems(data.items);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
    setError('');
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title, body: a.body, type: a.type,
      targetRoles: a.targetRoles, isPinned: a.isPinned,
      expiresAt: a.expiresAt ? a.expiresAt.split('T')[0] : '',
    });
    setShowForm(true);
    setError('');
  }

  function toggleRole(role: string) {
    if (role === 'ALL') {
      setForm(f => ({ ...f, targetRoles: ['ALL'] }));
      return;
    }
    setForm(f => {
      const without = f.targetRoles.filter(r => r !== 'ALL' && r !== role);
      const hasRole = f.targetRoles.includes(role);
      return { ...f, targetRoles: hasRole ? without : [...without, role] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      const payload = { ...form, expiresAt: form.expiresAt || null };
      if (editing) {
        await api.put(`/communication/announcements/${editing.id}`, payload);
        setSuccess('Announcement updated.');
      } else {
        await api.post('/communication/announcements', payload);
        setSuccess('Announcement published. Notifications sent to recipients.');
      }
      setShowForm(false);
      load();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this announcement? All related notifications will also be removed.')) return;
    try {
      await api.delete(`/communication/announcements/${id}`);
      load();
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to delete.'); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Communication</h1>
          <p className="text-sm text-gray-500 mt-1 font-body">{total} announcement{total !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]">
          <Plus className="w-4 h-4" strokeWidth={1.75} />
          <span>New Announcement</span>
        </button>
      </div>

      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="font-body font-medium">{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-sm rounded-xl px-4 py-3 font-body font-medium">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
            <h3 className="text-base font-semibold text-gray-800 font-display">{editing ? 'Edit Announcement' : 'New Announcement'}</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Title *</label>
              <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. School will remain closed on Monday"
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Message *</label>
              <textarea required rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })}
                placeholder="Write the full announcement here..."
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all resize-none font-body" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                  {['ANNOUNCEMENT', 'CIRCULAR', 'EVENT', 'ALERT'].map(t => (
                    <option key={t} value={t}>{t[0] + t.slice(1).toLowerCase()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Expires On (optional)</label>
                <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 font-body">Send To</label>
              <div className="flex flex-wrap gap-2">
                {ROLES.map(r => (
                  <button key={r} type="button" onClick={() => toggleRole(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.targetRoles.includes(r) ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>
                    {r === 'ALL' ? 'Everyone' : r[0] + r.slice(1).toLowerCase() + 's'}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm font-body text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={form.isPinned} onChange={e => setForm({ ...form, isPinned: e.target.checked })} className="rounded border-[#E5E7EB] text-[#1D7A4A] focus:ring-[#1D7A4A]/20" />
              <span>Pin to top</span>
            </label>
            <div className="flex gap-3 pt-2 border-t border-[#E5E7EB]">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60">
                {saving ? 'Publishing...' : editing ? 'Save Changes' : 'Publish & Notify'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-3">
        {[['', 'All Feed'], ['ANNOUNCEMENT', 'Announcements'], ['CIRCULAR', 'Circulars'], ['EVENT', 'Events'], ['ALERT', 'Alerts']].map(([v, l]) => (
          <button key={v} onClick={() => setTypeFilter(v)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${typeFilter === v ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 flex justify-center items-center">
          <p className="text-gray-400 text-sm font-body">Loading announcement board...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(a => (
            <div key={a.id} className={`bg-white rounded-xl border p-5 transition-all shadow-sm ${a.isPinned ? 'border-[#4338CA]/30 bg-[#EEF2FF]/10' : 'border-[#E5E7EB] hover:border-gray-300'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.isPinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#EEF2FF] text-[#4338CA] px-2 py-0.5 rounded border border-[#EEF2FF]">
                        <Pin className="w-3 h-3" strokeWidth={2} />
                        PINNED
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${TYPE_STYLES[a.type] || 'bg-gray-100 text-gray-600'}`}>{a.type}</span>
                    <div className="flex flex-wrap gap-1">
                      {a.targetRoles.map(r => (
                        <span key={r} className="text-[10px] bg-[#F3F4F6] text-[#4B5563] px-2 py-0.5 rounded border border-[#E5E7EB] font-medium">
                          {r === 'ALL' ? 'Everyone' : r[0] + r.slice(1).toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h4 className="font-semibold text-gray-900 text-base font-display">{a.title}</h4>
                  <p className="text-sm text-gray-600 font-body leading-relaxed whitespace-pre-line">{a.body}</p>
                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-gray-400 font-body border-t border-[#E5E7EB]/50">
                    <span>Published {new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    <span>by {a.createdBy.firstName} {a.createdBy.lastName}</span>
                    {a.expiresAt && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <span className="text-[#854F0B] font-medium bg-[#FAEEDA] px-1.5 py-0.2 rounded text-[10px]">Expires {new Date(a.expiresAt).toLocaleDateString('en-IN')}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(a)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-[#1D7A4A] transition-colors" title="Edit announcement">
                    <Edit2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-red-600 transition-colors" title="Delete announcement">
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col items-center">
              <Megaphone className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
              <h3 className="font-display text-[16px] font-semibold text-[#374151]">No Announcements Yet</h3>
              <p className="font-body text-[14px] text-[#6B7280] mt-1">Keep students, teachers, and parents informed with announcements.</p>
              <button onClick={openCreate} className="mt-4 inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#155D37] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]">
                <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} />
                <span>Create your first announcement</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
