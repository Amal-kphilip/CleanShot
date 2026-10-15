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
    <div className="group flex h-full flex-col border border-border-subtle bg-white/[.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-lime-300/50 hover:bg-white/[.04]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <span className="flex h-10 w-10 items-center justify-center border border-lime-300/20 bg-lime-300/[.08] text-lime-300">{icon}</span>
        <span className="border border-lime-300/25 px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] text-lime-300">{status}</span>
      </div>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-2 flex-1 text-xs leading-6 text-text-sec">{description}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.15em] text-lime-300">
        Open tool <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
      </span>
    </div>
  );
  if (!href) return null;
  return <Link href={href} className="block h-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300">{content}</Link>;
}
