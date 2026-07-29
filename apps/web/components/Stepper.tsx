'use client';

import { Check } from 'lucide-react';

interface StepperProps {
  /** Ordered step labels. */
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
  /** Optional: jump back to an already-completed step. */
  onStepClick?: (index: number) => void;
}

/**
 * Horizontal progress indicator for multi-step forms. Completed steps show a
 * check and (optionally) let the user jump back; the active step is filled;
 * upcoming steps are muted. Labels collapse to numbers-only on small screens.
 */
export default function Stepper({ steps, current, onStepClick }: StepperProps) {
  return (
    <nav aria-label="Progress" className="flex items-center w-full">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = !!onStepClick && done;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none min-w-0">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onStepClick!(i)}
              className={`flex items-center gap-2 min-w-0 rounded-none ${
                clickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-bold shrink-0 border transition-colors ${
                  done || active
                    ? 'bg-[#1D7A4A] border-[#1D7A4A] text-white'
                    : 'bg-white border-[#E5E7EB] text-[#9CA3AF]'
                }`}
              >
                {done ? <Check className="w-4 h-4" strokeWidth={3} /> : i + 1}
              </span>
              <span
                className={`text-[13px] font-semibold hidden sm:block truncate ${
                  active || done ? 'text-[#1A1D23]' : 'text-[#9CA3AF]'
                }`}
              >
                {label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-[2px] mx-3 rounded-full ${
                  done ? 'bg-[#1D7A4A]' : 'bg-[#E5E7EB]'
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
