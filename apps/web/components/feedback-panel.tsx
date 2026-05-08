"use client";

import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";

export type FeedbackItem = {
  id: string;
  message: string;
  suggestion?: string;
};

type FeedbackPanelProps = {
  title: string;
  items: FeedbackItem[];
  tone?: "error" | "warning" | "info" | "success";
  className?: string;
};

const panelToneStyles = {
  error: {
    wrapper: "border-[#5a2433] bg-[#2a1018] text-[#ffd6df]",
    icon: "text-[#ff8cab]",
    suggestion: "text-[#ffb9c8]",
    Icon: AlertTriangle,
  },
  warning: {
    wrapper: "border-[#6a4b12] bg-[#251807] text-[#ffe0a8]",
    icon: "text-[#ffbf47]",
    suggestion: "text-[#ffd27d]",
    Icon: AlertTriangle,
  },
  info: {
    wrapper: "border-[#1f4767] bg-[#0f2234] text-[#d4ecff]",
    icon: "text-[#53b8ff]",
    suggestion: "text-[#9cd6ff]",
    Icon: Info,
  },
  success: {
    wrapper: "border-[#1b5536] bg-[#0f2418] text-[#cff8df]",
    icon: "text-[#83ce00]",
    suggestion: "text-[#b9f27b]",
    Icon: CheckCircle2,
  },
} as const;

export function FeedbackPanel({
  title,
  items,
  tone = "error",
  className,
}: FeedbackPanelProps) {
  if (!items.length) {
    return null;
  }

  const styles = panelToneStyles[tone];
  const Icon = styles.Icon;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-[0_10px_24px_rgba(2,8,23,0.18)]",
        styles.wrapper,
        className,
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 size-5 shrink-0", styles.icon)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl bg-black/10 px-3 py-2">
                <p className="text-sm leading-6">{item.message}</p>
                {item.suggestion ? (
                  <p className={cn("mt-1 text-xs leading-5", styles.suggestion)}>
                    Asi debes hacerlo: {item.suggestion}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
