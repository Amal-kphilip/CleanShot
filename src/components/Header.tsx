'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Menu,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onOpenSettings?: () => void;
}

const toolDropdownLinks = [
  { href: '/', label: 'Metadata Remover' },
  { href: '/gemini-watermark-remover', label: 'Gemini Watermark Remover' },
  { href: '/inspector', label: 'Metadata Inspector' },
  { href: '/edit-metadata', label: 'Edit JPEG XMP' },
  { href: '/analyze-image', label: 'Analyze Image' },
  { href: '/compare-images', label: 'Compare Images' },
];

const topLinks = [
  { href: '/gemini-watermark-remover', label: 'Watermark Remover' },
  { href: '/inspector', label: 'Inspector' },
  { href: '/formats', label: 'Formats' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/faq', label: 'FAQ' },
];

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  return (
    <header className="relative flex min-h-[80px] lg:min-h-[92px] items-center">
      <div className="w-full flex-1 min-w-0">
        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 xl:gap-6">
            <Link
              href="/"
              aria-label="Go to CleanShot homepage"
              className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#145BF5]"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#145BF5] text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="text-[20px] font-extrabold text-foreground tracking-tight whitespace-nowrap">
                CleanShot
              </span>
            </Link>

            <div className="flex items-center gap-1 whitespace-nowrap">
              {/* Tools Dropdown matching geminiwatermarkremover.io */}
              <div className="group relative">
                <Link
                  href="/tools"
                  className="flex items-center justify-center rounded-lg px-3 py-2.5 gap-1 text-[15px] font-medium text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                >
                  <span>Tools</span>
                  <ChevronDown className="h-4 w-4 transition-transform duration-200 group-hover:rotate-180" />
                </Link>

                <div className="invisible absolute left-0 top-full z-50 min-w-[250px] pt-2 opacity-0 transition duration-200 ease-out group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-2 text-left shadow-[0_18px_45px_rgba(15,23,42,0.12)]">
                    <div className="px-3 pt-2 pb-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-ter">
                        Local Tools
                      </span>
                    </div>
                    {toolDropdownLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors ${
                          isActive(item.href)
                            ? 'bg-[#145BF5]/10 text-[#145BF5] dark:text-[#60A5FA]'
                            : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{item.label}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              {topLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-lg px-3 py-2.5 text-[14px] xl:text-[15px] transition-colors ${
                      active
                        ? 'bg-black/[0.05] dark:bg-white/[0.08] font-semibold text-foreground'
                        : 'font-medium text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors shadow-sm"
                title="Settings"
                aria-label="Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors shadow-sm"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </nav>

        {/* Mobile Nav */}
        <div className="flex lg:hidden items-center justify-between gap-2">
          <Link
            href="/"
            aria-label="Go to CleanShot homepage"
            className="flex items-center gap-2 rounded-lg"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#145BF5] text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-[18px] font-extrabold text-foreground tracking-tight">
              CleanShot
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-glass-card text-foreground"
                title="Settings"
                aria-label="Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-glass-card text-foreground"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="h-9 w-9 inline-flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-glass-card text-foreground"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden mt-3 rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-3 shadow-lg flex flex-col gap-1">
            {toolDropdownLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`rounded-xl px-3 py-2 text-[14px] font-semibold ${
                  isActive(item.href)
                    ? 'bg-[#145BF5]/10 text-[#145BF5] dark:text-[#60A5FA]'
                    : 'text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="my-1 h-px bg-[var(--border-subtle)]" />
            <div className="flex flex-wrap gap-1">
              {topLinks.slice(2).map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-text-sec hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
