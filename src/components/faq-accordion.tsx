"use client";

import type { ReactNode } from "react";

type FaqItem = {
  id: string;
  question: string;
  answer: ReactNode;
  /** Gold brand glow on the question (e.g. featured items) */
  highlightQuestion?: boolean;
  /** Optional DOM id for deep links (e.g. `/faq#safety-coverage`). */
  anchorId?: string;
};

type Props = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {items.map((item) => (
        <details
          key={item.id}
          id={item.anchorId}
          className="group scroll-mt-36 rounded-xl border border-slate-800 bg-slate-900/40 shadow-sm transition-colors open:border-emerald-500/35 open:bg-slate-900/60 open:shadow-[0_0_20px_rgba(16,185,129,0.08)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left text-base font-semibold text-slate-100 sm:px-5 sm:py-4 sm:text-lg [&::-webkit-details-marker]:hidden">
            <span
              className={
                item.highlightQuestion
                  ? "faqQuestionGold min-w-0 pr-2"
                  : "min-w-0 pr-2"
              }
            >
              {item.question}
            </span>
            <span
              className="shrink-0 text-emerald-400/90 transition-transform duration-200 group-open:rotate-180"
              aria-hidden
            >
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </summary>
          <div className="border-t border-slate-800/80 px-4 pb-4 pt-0 text-sm leading-relaxed text-slate-300 sm:px-5 sm:text-base">
            <div className="pt-4">{item.answer}</div>
          </div>
        </details>
      ))}
    </div>
  );
}
