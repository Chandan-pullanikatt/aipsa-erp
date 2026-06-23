'use client';

// App-style pull-to-refresh. Wraps a scroll container; when the user drags down
// while already scrolled to the top, releasing past the threshold reloads the page.
// Touch-only — mouse devices never fire these handlers, so the desktop UX is untouched.
import { useRef, useState, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

const THRESHOLD = 70; // px of pull needed to trigger a refresh
const MAX_PULL = 110; // px the indicator can stretch to

export default function PullToRefresh({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const active = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const el = ref.current;
    if (!el || refreshing) return;
    if (el.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      active.current = true;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const el = ref.current;
    if (!active.current || refreshing || !el) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0 || el.scrollTop > 0) {
      active.current = false;
      setPull(0);
      return;
    }
    setPull(Math.min(MAX_PULL, dy * 0.5)); // resistance
  }, [refreshing]);

  const onTouchEnd = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      window.location.reload();
    } else {
      setPull(0);
    }
  }, [pull]);

  const armed = refreshing || pull >= THRESHOLD;

  return (
    <div
      ref={ref}
      className={className}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="flex items-end justify-center overflow-hidden"
        style={{ height: pull, opacity: pull > 0 ? 1 : 0, transition: active.current ? 'none' : 'height 150ms ease, opacity 150ms ease' }}
      >
        <div className="pb-2">
          <RefreshCw
            className={`w-5 h-5 text-[#1D7A4A] ${refreshing ? 'animate-spin' : ''}`}
            strokeWidth={2}
            style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)`, opacity: armed ? 1 : 0.6 }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}
