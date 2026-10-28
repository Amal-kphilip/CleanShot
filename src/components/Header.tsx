'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, Sun, SlidersHorizontal, ArrowUp } from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onOpenSettings?: () => void;
}

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '/inspector', label: 'Inspector' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/formats', label: 'Formats' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/faq', label: 'FAQ' },
];

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  const visibleSideLinks = navLinks.filter((link) => !isActive(link.href));

  return (
    <>
      <header className="w-full py-6 sm:py-10">
        <nav className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center justify-between w-full sm:w-auto">
            <Link
              href="/"
              aria-label="Go to CleanShot homepage"
              className="inline-flex items-center gap-2.5 text-foreground hover:opacity-85 transition-opacity"
            >
              <img
                src="/app-icon-black.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 object-contain dark:hidden"
              />
              <img
                src="/app-icon-white.png"
                alt=""
                aria-hidden="true"
                className="h-8 w-8 object-contain hidden dark:block"
              />
              <span className="text-[26px] sm:text-[34px] font-semibold leading-none tracking-[-0.02em]">
                CleanShot
              </span>
            </Link>

            {/* Mobile right actions */}
            <div className="flex items-center gap-1.5 sm:hidden">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-[4px] text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Settings"
                  aria-label="Settings"
                >
                  <SlidersHorizontal className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-[4px] text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Navigation links + Desktop controls */}
          <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 flex-wrap">
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap text-[13px] sm:text-[14px] font-medium">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={`transition-colors ${
                      active
                        ? 'text-foreground font-semibold underline underline-offset-4 decoration-2'
                        : 'text-text-sec hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="hidden sm:flex items-center gap-1.5">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-[4px] text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  title="Settings"
                  aria-label="Settings"
                >
                  <SlidersHorizontal className="w-5 h-5" />
                </button>
              )}
              <button
                type="button"
                onClick={toggleTheme}
                className="p-2 rounded-[4px] text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title="Toggle theme"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Fixed side navigation on wide screens */}
      <aside className="fixed flex-col items-start bottom-12 ml-[1000px] hidden xl:flex z-30">
        <div className="pointer-events-auto w-fit flex flex-col items-start gap-4">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Scroll to top"
            className="w-9 h-9 inline-flex items-center justify-center rounded-[4px] border-2 border-foreground bg-background text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            <ArrowUp className="w-4 h-4" />
          </button>

          <nav className="flex flex-col items-start gap-1.5 text-[12px] font-medium">
            {visibleSideLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-text-sec hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-1 text-[11px] text-text-ter select-none">
              &copy; {new Date().getFullYear()} All rights reserved
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
