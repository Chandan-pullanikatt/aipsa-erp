'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { Camera, ImageUp, FileText, X, Loader2, Link2, AlertCircle } from 'lucide-react';

export interface Attachment {
  url: string;
  key?: string | null;
  name?: string | null;
  type: 'image' | 'pdf';
}

interface Props {
  value: Attachment[];
  onChange: (next: Attachment[]) => void;
  /** Upload folder. Ignored by the API for students/parents, who are pinned to their own folder. */
  folder: string;
  label?: string;
  /** Shown under the buttons. Defaults to a plain-language description of the limits. */
  hint?: string;
  max?: number;
  /** Pass both to show the collapsed "paste a link instead" fallback. */
  link?: string;
  onLinkChange?: (value: string) => void;
  disabled?: boolean;
}

// Phone cameras produce 4-8 MB photos, which are slow to upload on mobile data and
// far larger than a page of homework needs. Redraw them at print-legible size
// before sending; anything that isn't a decodable image (PDFs, iPhone HEIC that
// the browser won't render) is passed through untouched and validated server-side.
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.82;

async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  // Already small enough to send as-is.
  if (scale === 1 && file.size < 1_000_000) { bitmap.close(); return file; }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob || blob.size >= file.size) return file;

  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

export default function AttachmentUploader({
  value, onChange, folder, label = 'Photos & Resources',
  hint, max = 10, link, onLinkChange, disabled = false,
}: Props) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(Boolean(link));

  const remaining = max - value.length;
  const busy = disabled || uploading > 0;

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files || []);
    // Reset immediately so picking the same file twice still fires a change event.
    e.target.value = '';
    if (!picked.length) return;

    setError(null);
    if (picked.length > remaining) {
      setError(`You can attach up to ${max} files. Only the first ${remaining} were added.`);
    }

    const queue = picked.slice(0, remaining);
    setUploading(queue.length);

    // `value` is the prop captured by this render and won't change while the loop
    // runs, so the accumulated list is tracked locally — appending to `value` each
    // time would keep only the last file.
    let next = value;

    for (const original of queue) {
      try {
        const file = await shrinkImage(original);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', folder);
        const { data } = await api.post('/uploads', fd);
        next = [...next, {
          url: data.url,
          key: data.key,
          name: original.name,
          type: file.type === 'application/pdf' ? 'pdf' : 'image',
        }];
        onChange(next);
      } catch (err) {
        const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(apiError || `Could not upload "${original.name}". Please try again.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider font-display">
          {label}
        </label>
        {value.length > 0 && (
          <span className="text-[10px] text-gray-400 font-body">{value.length} of {max}</span>
        )}
      </div>

      {/* Thumbnails */}
      {value.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {value.map((a, i) => (
            <div key={a.url} className="relative group aspect-square rounded-lg border border-[#E5E7EB] overflow-hidden bg-gray-50">
              {a.type === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt={a.name || `Attachment ${i + 1}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-1">
                  <FileText className="w-6 h-6 text-[#1D7A4A]" strokeWidth={1.75} />
                  <span className="text-[8px] text-gray-500 text-center leading-tight line-clamp-2 font-body">
                    {a.name || 'PDF'}
                  </span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, idx) => idx !== i))}
                disabled={busy}
                aria-label={`Remove ${a.name || 'attachment'}`}
                className="absolute top-1 right-1 bg-black/60 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="w-3 h-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pickers */}
      {remaining > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 border border-dashed border-[#1D7A4A]/40 bg-[#E5F6EE]/40 hover:bg-[#E5F6EE] text-[#1D7A4A] rounded-lg py-3 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 font-display"
          >
            <Camera className="w-4 h-4" strokeWidth={2} />
            Take Photo
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:bg-gray-50 text-gray-600 rounded-lg py-3 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 font-display"
          >
            <ImageUp className="w-4 h-4" strokeWidth={2} />
            Choose Files
          </button>
        </div>
      )}

      <input
        ref={cameraRef} type="file" accept="image/*" capture="environment"
        onChange={handleFiles} className="hidden"
      />
      <input
        ref={fileRef} type="file" accept="image/*,application/pdf" multiple
        onChange={handleFiles} className="hidden"
      />

      {uploading > 0 && (
        <p className="text-[11px] text-[#1D7A4A] flex items-center gap-1.5 font-body">
          <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
          Uploading {uploading} file{uploading > 1 ? 's' : ''}…
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-700 flex items-start gap-1.5 font-body">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" strokeWidth={2} />
          {error}
        </p>
      )}

      {uploading === 0 && !error && (
        <p className="text-[11px] text-gray-400 font-body">
          {hint ?? 'Photos or PDFs. Pictures are shrunk automatically, so large camera photos are fine.'}
        </p>
      )}

      {/* Link fallback, collapsed by default */}
      {onLinkChange && (
        showLink ? (
          <div className="pt-1">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5 font-display">
              Or link to a resource
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                placeholder="https://youtube.com/… or a Drive link"
                value={link ?? ''}
                onChange={(e) => onLinkChange(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
              />
              <button
                type="button"
                onClick={() => { onLinkChange(''); setShowLink(false); }}
                aria-label="Remove link field"
                className="text-gray-400 hover:text-gray-600 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowLink(true)}
            className="text-[11px] text-gray-400 hover:text-[#1D7A4A] inline-flex items-center gap-1 transition-colors cursor-pointer font-body"
          >
            <Link2 className="w-3 h-3" strokeWidth={2} />
            or paste a link instead
          </button>
        )
      )}
    </div>
  );
}
