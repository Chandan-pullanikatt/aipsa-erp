'use client';

import { FileText, ExternalLink, Paperclip } from 'lucide-react';
import type { Attachment } from './AttachmentUploader';

interface Props {
  attachments?: Attachment[] | null;
  /** Legacy single link. Shown only when it isn't already the first uploaded file. */
  attachmentUrl?: string | null;
  /** Label for the legacy link chip. */
  linkLabel?: string;
  size?: 'sm' | 'md';
}

export default function AttachmentList({
  attachments, attachmentUrl, linkLabel = 'Reference link', size = 'md',
}: Props) {
  const files = Array.isArray(attachments) ? attachments : [];
  // `attachmentUrl` mirrors the first upload server-side, so only show it as a
  // separate chip when it's a genuine standalone link (pasted, or a pre-upload row).
  const showLink = Boolean(attachmentUrl) && !files.some((f) => f.url === attachmentUrl);

  if (!files.length && !showLink) return null;

  const box = size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {files.map((f, i) => (
        <a
          key={f.url}
          href={f.url}
          target="_blank"
          rel="noopener noreferrer"
          title={f.name || `Attachment ${i + 1}`}
          className={`${box} rounded-lg border border-[#E5E7EB] overflow-hidden bg-gray-50 hover:border-[#1D7A4A]/40 hover:shadow-sm transition-all shrink-0 block`}
        >
          {f.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.url} alt={f.name || `Attachment ${i + 1}`} className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex flex-col items-center justify-center gap-0.5 text-[#1D7A4A]">
              <FileText className="w-5 h-5" strokeWidth={1.75} />
              <span className="text-[8px] font-bold uppercase tracking-wide font-display">PDF</span>
            </span>
          )}
        </a>
      ))}

      {showLink && (
        <a
          href={attachmentUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1D7A4A] hover:text-[#155B37] border border-[#E5E7EB] hover:border-[#1D7A4A]/40 rounded-lg px-2.5 py-1.5 transition-colors font-body"
        >
          <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
          {linkLabel}
        </a>
      )}
    </div>
  );
}

/** Compact count badge for list rows where thumbnails would be too heavy. */
export function AttachmentCount({ attachments, attachmentUrl }: Props) {
  const files = Array.isArray(attachments) ? attachments : [];
  const total = files.length || (attachmentUrl ? 1 : 0);
  if (!total) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full font-body">
      <Paperclip className="w-3 h-3" strokeWidth={2} />
      {total}
    </span>
  );
}
