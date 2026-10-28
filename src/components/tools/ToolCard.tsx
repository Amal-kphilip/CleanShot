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
    <div className="group flex h-full flex-col rounded-[4px] border-2 border-foreground bg-background p-5 transition-colors hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-[4px] border-2 border-foreground text-foreground">
          {icon}
        </span>
        <span className="rounded-[4px] border border-foreground px-2 py-0.5 text-[10px] font-semibold text-foreground">
          {status}
        </span>
      </div>
      <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-text-sec">
        {description}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--accent-primary)] group-hover:underline">
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
