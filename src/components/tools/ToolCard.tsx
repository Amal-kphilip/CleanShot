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
    <div className="group flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-6 shadow-sm transition-all hover:border-[#145BF5]/40 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#145BF5]/10 text-[#145BF5] dark:text-[#60A5FA]">
          {icon}
        </span>
        <span className="rounded-full bg-blue-50 dark:bg-blue-500/15 px-2.5 py-0.5 text-[11px] font-bold text-[#145BF5] dark:text-[#60A5FA]">
          {status}
        </span>
      </div>
      <h2 className="text-[17px] font-bold text-foreground tracking-tight">
        {title}
      </h2>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-sec">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#145BF5] dark:text-[#60A5FA] group-hover:underline">
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
