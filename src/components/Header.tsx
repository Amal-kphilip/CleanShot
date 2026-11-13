'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onOpenSettings?: () => void;
}

const navLinks = [
  { href: '/', label: 'Metadata' },
  { href: '/gemini-watermark-remover', label: 'Watermark Remover' },
  { href: '/inspector', label: 'Inspector' },
  { href: '/tools', label: 'All Tools' },
  { href: '/formats', label: 'Formats' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/faq', label: 'FAQ' },
];

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 mb-6 bg-[var(--surface-glass)] backdrop-blur-md border-b border-[var(--border-subtle)]">
      <nav className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link
            href="/"
            aria-label="Go to CleanShot homepage"
            className="inline-flex items-center gap-2.5 text-foreground hover:opacity-90 transition-opacity"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              <Sparkles className="h-5 w-5" />
            </span>
            <span className="flex flex-col">
              <span className="text-[17px] sm:text-[18px] font-bold leading-tight tracking-tight text-foreground">
                CleanShot
              </span>
              <span className="text-[11px] font-medium text-text-ter leading-none">
                Local Privacy &amp; Watermark Studio
              </span>
            </span>
          </Link>

          {/* Mobile right actions */}
          <div className="flex items-center gap-1.5 md:hidden">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Navigation links + Desktop controls */}
        <div className="flex items-center justify-between md:justify-end gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap text-[13px] font-medium">
            {navLinks.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors ${
                    active
                      ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 font-semibold'
                      : 'text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-[var(--border-subtle)]">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors"
                title="Settings"
                aria-label="Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
}
