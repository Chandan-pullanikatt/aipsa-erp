'use client';

// Subject-wise marks for one exam, drawn as hand-rolled inline SVG rather than a
// chart library: this lands on printed report cards, and lib/print.ts prints a
// *clone* of the node — a fixed viewBox scales to whatever width the sheet gives it
// with no measuring, no ResponsiveContainer, no re-render inside the print root.
//
// One series, so one hue and no legend (the caption says what is plotted). The table
// above the chart already carries every value, so only the high and low marks are
// labelled — the chart is here for the shape of the term, not to restate the numbers.

const GREEN = '#1D7A4A';
const GRID = '#E5E7EB';
const MUTED = '#6B7280';
const INK = '#1A1D23';
const PASS = '#B45309';

export interface SubjectScore {
  subject: string;
  marks: number | null;
  isAbsent: boolean;
}

// Geometry, in viewBox units (≈ CSS px at the natural render size).
const SLOT = 58;        // horizontal band per subject
const BAR_W = 24;       // mark spec: bars are capped, never fill the slot
const GUTTER_L = 38;    // y-axis labels
const GUTTER_R = 46;    // room for the pass-line label
const PLOT_H = 168;
const PAD_T = 22;       // headroom for the high/low value labels
const LABEL_H = 74;     // rotated subject names

export default function SubjectScoreChart({
  scores,
  maxMarks,
  passingPercent,
  caption,
}: {
  scores: SubjectScore[];
  maxMarks: number;
  /** Exam pass mark as a percentage of `maxMarks`, matching the exam record. */
  passingPercent?: number | null;
  caption?: string;
}) {
  const present = scores.filter((s) => !s.isAbsent && s.marks !== null);
  if (scores.length === 0 || present.length === 0 || !(maxMarks > 0)) return null;

  const W = GUTTER_L + scores.length * SLOT + GUTTER_R;
  const H = PAD_T + PLOT_H + LABEL_H;
  const baseY = PAD_T + PLOT_H;
  const y = (v: number) => baseY - (Math.max(0, Math.min(v, maxMarks)) / maxMarks) * PLOT_H;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxMarks * f));
  const values = present.map((s) => s.marks as number);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const passMark = passingPercent ? (maxMarks * passingPercent) / 100 : null;
  const showPass = passMark !== null && passMark > 0 && passMark < maxMarks;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label={`Subject-wise marks out of ${maxMarks}: ${present.map((s) => `${s.subject} ${s.marks}`).join(', ')}`}
        style={{ maxWidth: `${W}px`, display: 'block' }}
      >
        {/* Gridlines + y ticks — hairline, solid, recessive. */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={GUTTER_L} x2={W - GUTTER_R} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={GUTTER_L - 8} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={MUTED}>{t}</text>
          </g>
        ))}

        {/* Pass mark reference line. */}
        {showPass && (
          <g>
            <line x1={GUTTER_L} x2={W - GUTTER_R} y1={y(passMark)} y2={y(passMark)} stroke={PASS} strokeWidth={1} />
            <text x={W - GUTTER_R + 6} y={y(passMark) + 3.5} fontSize={9} fill={PASS} fontWeight={700}>
              Pass {Math.round(passMark)}
            </text>
          </g>
        )}

        {scores.map((s, i) => {
          const x = GUTTER_L + i * SLOT + (SLOT - BAR_W) / 2;
          const cx = GUTTER_L + i * SLOT + SLOT / 2;
          const marks = s.marks;
          const drawn = !s.isAbsent && marks !== null;
          const top = drawn ? y(marks) : baseY;
          const h = baseY - top;
          const r = Math.min(4, h); // 4px rounded data-end, square at the baseline
          const isExtreme = drawn && (marks === high || marks === low);

          return (
            <g key={`${s.subject}-${i}`}>
              {drawn && h > 0 && (
                <path
                  d={`M ${x} ${baseY} L ${x} ${top + r} Q ${x} ${top} ${x + r} ${top} L ${x + BAR_W - r} ${top} Q ${x + BAR_W} ${top} ${x + BAR_W} ${top + r} L ${x + BAR_W} ${baseY} Z`}
                  fill={GREEN}
                />
              )}
              {isExtreme && (
                <text x={cx} y={top - 7} textAnchor="middle" fontSize={10} fontWeight={700} fill={INK}>{marks}</text>
              )}
              {!drawn && (
                <text x={cx} y={baseY - 6} textAnchor="middle" fontSize={9} fontWeight={700} fill={MUTED}>AB</text>
              )}
              {/* Rotated so long subject names never collide or get clipped. */}
              <text
                x={cx}
                y={baseY + 12}
                fontSize={10}
                fill={MUTED}
                textAnchor="end"
                transform={`rotate(-40 ${cx} ${baseY + 12})`}
              >
                {/* Capped so the -40° label of the first bar cannot run past the
                    viewBox's left edge (≈14 chars at 10px reaches the y-axis gutter). */}
                {s.subject.length > 14 ? `${s.subject.slice(0, 13)}…` : s.subject}
              </text>
            </g>
          );
        })}

        {/* Baseline sits above the labels, drawn last so bars meet it cleanly. */}
        <line x1={GUTTER_L} x2={W - GUTTER_R} y1={baseY} y2={baseY} stroke={MUTED} strokeWidth={1} />
      </svg>
      <figcaption className="text-[10px] text-gray-400 mt-1 font-body">
        {caption || `Marks obtained per subject, out of ${maxMarks}. Highest and lowest are labelled; full marks are in the table above.`}
      </figcaption>
    </figure>
  );
}
