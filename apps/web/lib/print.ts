'use client';

/**
 * Printing from inside the dashboard shell needs help.
 *
 * The shell is a fixed-height, non-scrolling frame (`h-[100dvh]` + an inner
 * `overflow-auto` pane in app/(dashboard)/layout.tsx), so the printed document is
 * only ever one viewport tall — everything below the scroll pane's clip boundary
 * is dropped from the print flow entirely. The old `visibility: hidden` +
 * `position: absolute` approach also anchored itself to the nearest positioned
 * ancestor (the card, which is `relative overflow-hidden`) rather than the page,
 * so a report card printed as a header and a blank sheet.
 *
 * The fix is to lift a *clone* of the target out of the shell into a `#print-root`
 * hung directly off <body>, where no ancestor can clip or reposition it. We clone
 * rather than move so React's DOM tree is never touched.
 *
 * The matching CSS lives in app/globals.css under "PRINT".
 */

/** CSS px per mm at the 96dpi the print box is laid out in. */
const MM = 96 / 25.4;

/** A4 portrait content box, inside the 12mm `@page` margin declared in globals.css. */
export const PAGE_W = Math.floor((210 - 24) * MM); // 703px
export const PAGE_H = Math.floor((297 - 24) * MM); // 1032px

export type PrintFit =
  /** Shrink-to-fit: the node is scaled so the whole thing lands on exactly one sheet. */
  | 'page'
  /** Natural size at A4 width, spilling onto as many sheets as it needs. */
  | 'flow';

export function printElement(el: HTMLElement | null, opts: { fit?: PrintFit } = {}) {
  if (!el || typeof window === 'undefined') return;
  const fit = opts.fit ?? 'flow';

  // A previous print whose `afterprint` never fired (older webviews) would leave a
  // stale root behind. It's invisible either way, but only one may exist at a time.
  document.getElementById('print-root')?.remove();

  const root = document.createElement('div');
  root.id = 'print-root';
  root.className = fit === 'page' ? 'print-fit-page' : 'print-fit-flow';

  const inner = document.createElement('div');
  inner.className = 'print-root-inner';
  inner.appendChild(el.cloneNode(true));
  root.appendChild(inner);
  document.body.appendChild(root);
  document.body.classList.add('printing');

  // `#print-root` is laid out off-screen at the exact printable width, and every
  // print-time style (compact rows, `.print-only` blocks revealed, `.no-print`
  // hidden) is keyed off `#print-root` rather than `@media print` — so what we
  // measure here is exactly what the sheet gets.
  if (fit === 'page') {
    const scale = Math.min(1, PAGE_H / inner.scrollHeight, PAGE_W / inner.scrollWidth);
    root.style.setProperty('--print-scale', String(scale));
    root.style.setProperty('--print-height', `${Math.ceil(inner.scrollHeight * scale)}px`);
  }

  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    document.body.classList.remove('printing');
    root.remove();
  };
  window.addEventListener('afterprint', cleanup);

  window.print();
}
