'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronDown,
  Moon,
  SlidersHorizontal,
  Sparkles,
  Sun,
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
  { href: '/', label: 'Metadata' },
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
              aria-expanded={mobileOpen}
            >
              <svg
                className={`ham ham3 w-6 h-6${mobileOpen ? ' active' : ''}`}
                viewBox="0 0 100 100"
                aria-hidden="true"
              >
                <path
                  className="line top"
                  d="m 70,33 h -40 c -11.092231,0 11.883874,13.496726 -3.420361,12.956839 -0.962502,-2.089471 -2.222071,-3.282996 -4.545687,-3.282996 -2.323616,0 -5.113897,2.622752 -5.113897,7.071068 0,4.448316 2.080609,7.007933 5.555839,7.007933 2.401943,0 2.96769,-1.283974 4.166879,-3.282995 2.209342,0.273823 4.031294,1.642466 5.857227,-0.252538 v -13.005715 16.288404 h 7.653568"
                />
                <path
                  className="line middle"
                  d="m 70,50 h -40 c -5.6862,0 -8.534259,5.373483 -8.534259,11.551069 0,7.187738 3.499166,10.922274 13.131984,10.922274 11.021777,0 7.022787,-15.773343 15.531095,-15.773343 3.268142,0 5.177031,-2.159429 5.177031,-6.7 0,-4.540571 -1.766442,-7.33533 -5.087851,-7.326157 -3.321409,0.0092 -5.771288,2.789632 -5.771288,7.326157 0,4.536525 2.478983,6.805271 5.771288,6.7"
                />
                <path
                  className="line bottom"
                  d="m 70,67 h -40 c 0,0 -3.680675,0.737051 -3.660714,-3.517857 0.02541,-5.415597 3.391687,-10.357143 10.982142,-10.357143 4.048418,0 17.88928,0.178572 23.482143,0.178572 0,2.563604 2.451177,3.403635 4.642857,3.392857 2.19168,-0.01078 4.373905,-1.369814 4.375,-3.392857 0.0011,-2.023043 -1.924401,-2.589191 -4.553571,-4.107143 -2.62917,-1.517952 -4.196429,-1.799562 -4.196429,-3.660714 0,-1.861153 2.442181,-3.118811 4.196429,-3.035715 1.754248,0.0831 4.375,0.890841 4.375,3.125 2.628634,0 6.160714,0.267857 6.160714,0.267857 l -0.178571,-2.946428 10.178571,0 -10.178571,0 v 6.696428 l 8.928571,0 -8.928571,0 v 7.142858 l 10.178571,0 -10.178571,0"
                />
              </svg>
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
