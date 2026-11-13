import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export function ToolCard({
  href,
  icon,
  title,
  description,
  status = 'Ready',
}: {
  href?: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  status?: string;
}) {
  const content = (
    <div className="group flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-glass-card p-5 shadow-sm transition-all hover:border-emerald-500/50 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {icon}
        </span>
        <span className="rounded-full bg-[var(--surface-elevated)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] font-semibold text-text-sec">
          {status}
        </span>
      </div>
      <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-sec">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 group-hover:underline">
        Open tool <ArrowUpRight className="h-3.5 w-3.5" />
      </span>
    </div>
  );
  if (!href) return null;
  return (
    <Link href={href} className="block h-full">
      {content}
    </Link>
  );
}
