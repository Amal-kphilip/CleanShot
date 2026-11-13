import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/Header';

export function ToolShell({
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
    <div className="flex flex-col flex-1 w-full">
      <Header />
      <main className="flex-1 w-full flex flex-col gap-5 sm:gap-8 pb-8 sm:pb-10">
        <section className="pt-2 sm:pt-8 pb-1 sm:pb-2 text-center">
          <div className="mx-auto max-w-4xl space-y-2.5 sm:space-y-5">
            {showBack && (
              <div>
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/[0.05] dark:bg-white/[0.07] px-3.5 py-1.5 text-[12px] font-semibold text-text-sec hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> All tools
                </Link>
              </div>
            )}
            <h1 className="text-[28px] sm:text-[42px] md:text-[48px] font-extrabold tracking-tight text-foreground leading-tight">
              {title}{' '}
              {accent && (
                <span className="text-[#145BF5] dark:text-[#3B82F6]">
                  {accent}
                </span>
              )}
            </h1>
            <p className="mx-auto max-w-[640px] text-[14px] sm:text-[17px] leading-[1.6] text-text-sec font-medium">
              {description}
            </p>
          </div>
        </section>

        {children}
      </main>
      <footer className="bg-glass-card -mx-5 sm:-mx-6 md:-mx-8 px-5 sm:px-6 md:px-8 py-8 mt-auto border-t border-[var(--border-subtle)]">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center text-[13px] font-medium text-text-sec">
          <p>CleanShot — 100% browser-local privacy &amp; watermark tools.</p>
          <div className="flex items-center gap-5 flex-wrap">
            <Link href="/" className="hover:text-foreground transition-colors">
              Metadata Remover
            </Link>
            <Link
              href="/gemini-watermark-remover"
              className="hover:text-foreground transition-colors"
            >
              Watermark Remover
            </Link>
            <Link href="/tools" className="hover:text-foreground transition-colors">
              All Tools
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function DownloadButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-5 py-2.5 rounded-xl bg-[#145BF5] hover:bg-[#0F4AD4] text-white shadow-sm text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowUpRight className="h-4 w-4" />
      {children}
    </button>
  );
}
