'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/Header';

export function ToolShell({
  eyebrow = 'STRIPMETA TOOLKIT',
  showBack = true,
  title,
  accent,
  description,
  children,
}: {
  eyebrow?: string;
  showBack?: boolean;
  title: string;
  accent?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="site-shell flex min-h-dvh flex-col">
      <Header />
      <main className="site-main mx-auto w-full max-w-6xl px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <div className="mb-8 sm:mb-10">
          {showBack && <Link href="/tools" className="mb-5 inline-flex items-center gap-2 text-xs text-text-ter transition-colors hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> All tools
          </Link>}
          <p className="hero-kicker"><span className="status-dot" />{eyebrow}</p>
          <h1 className="display-serif mt-4 max-w-4xl text-4xl leading-[.98] tracking-[-.045em] sm:text-6xl">
            {title} {accent && <span className="hero-accent">{accent}</span>}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-text-sec sm:text-base">{description}</p>
        </div>
        {children}
      </main>
      <footer className="mt-auto border-t border-border-subtle px-4 py-7 text-center text-[11px] text-text-ter">
        <p>StripMeta · Private file tools · Dark interface</p>
        <p className="mt-1">Tool capabilities vary by format. Unsupported operations are reported rather than silently treated as successful.</p>
      </footer>
    </div>
  );
}

export function DownloadButton({ onClick, children, disabled = false }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className="primary-cta disabled:cursor-not-allowed disabled:opacity-40"><ArrowUpRight className="h-4 w-4" />{children}</button>;
}
