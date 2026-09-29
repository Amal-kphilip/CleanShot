'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  Sun,
  Moon,
  SlidersHorizontal,
  Menu,
  X,
  Layers,
  Eye,
  HelpCircle,
  FileCheck,
  Lock,
  Cpu,
} from 'lucide-react';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  onOpenSettings?: () => void;
}

export function Header({ onOpenSettings }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { href: '/',             label: 'Strip',        icon: Layers },
    { href: '/inspector',   label: 'Inspector',    icon: Eye },
    { href: '/how-it-works',label: 'How It Works', icon: Cpu },
    { href: '/formats',     label: 'Formats',      icon: FileCheck },
    { href: '/privacy',     label: 'Privacy',      icon: Lock },
    { href: '/faq',         label: 'FAQ',          icon: HelpCircle },
  ];

  return (
    <>
      <header
        className={`sticky top-0 z-50 w-full glass transition-all duration-300 ${
          scrolled
            ? 'bg-white/80 dark:bg-[#0C0C10]/85 border-b border-black/[0.06] dark:border-white/[0.07] shadow-sm shadow-black/[0.04]'
            : 'bg-white/60 dark:bg-[#0C0C10]/60 border-b border-transparent'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 group select-none shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[10px] bg-accent dark:bg-accent-dark flex items-center justify-center text-white shadow-sm group-hover:opacity-90 transition-opacity">
              <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-n-900 dark:text-white">
              CleanShot
            </span>
          </Link>

          {/* Desktop Nav — flat links, no pill wrapper */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 text-[13px] font-medium rounded-lg transition-all duration-150 ${
                    isActive
                      ? 'text-n-900 dark:text-white bg-n-100 dark:bg-white/[0.08]'
                      : 'text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100/60 dark:hover:bg-white/[0.05]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                className="hidden sm:flex p-2 rounded-lg text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.06] transition-colors items-center gap-1.5 text-[13px] font-medium"
                title="Settings"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden md:inline">Settings</span>
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.06] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark'
                ? <Sun className="w-4 h-4" />
                : <Moon className="w-4 h-4" />
              }
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.06] transition-colors ml-0.5"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Height Sheet */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[2px] animate-fade-in lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Slide-in panel */}
          <div className="fixed inset-y-0 right-0 z-[70] w-72 max-w-[85vw] bg-white dark:bg-n-900 shadow-2xl animate-fade-up lg:hidden flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-n-100 dark:border-white/[0.07]">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-[10px] bg-accent dark:bg-accent-dark flex items-center justify-center text-white">
                  <ShieldCheck className="w-4 h-4" strokeWidth={2.5} />
                </div>
                <span className="text-[15px] font-semibold text-n-900 dark:text-white">CleanShot</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.06] transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav links — large tap targets */}
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-[15px] font-medium transition-all ${
                      isActive
                        ? 'bg-n-100 dark:bg-white/[0.08] text-n-900 dark:text-white'
                        : 'text-n-600 dark:text-n-300 hover:bg-n-50 dark:hover:bg-white/[0.04] hover:text-n-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0 text-n-400 dark:text-n-500" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Sheet footer */}
            <div className="px-5 py-5 border-t border-n-100 dark:border-white/[0.07] space-y-3">
              {onOpenSettings && (
                <button
                  onClick={() => { setMobileMenuOpen(false); onOpenSettings(); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-n-100 dark:bg-white/[0.06] text-n-700 dark:text-n-300 text-[14px] font-medium transition-colors hover:bg-n-200 dark:hover:bg-white/[0.1]"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  Settings
                </button>
              )}
              <div className="flex items-center justify-center gap-1.5 text-[12px] text-n-400 dark:text-n-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                100% In-Browser · Private
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
