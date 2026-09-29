'use client';

import React, { useState } from 'react';
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

  const navLinks = [
    { href: '/', label: 'Strip', icon: Layers },
    { href: '/inspector', label: 'Inspector', icon: Eye },
    { href: '/how-it-works', label: 'How It Works', icon: Cpu },
    { href: '/formats', label: 'Formats', icon: FileCheck },
    { href: '/privacy', label: 'Privacy', icon: Lock },
    { href: '/faq', label: 'FAQ', icon: HelpCircle },
  ];

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-xl bg-white/75 dark:bg-[#070b14]/80 border-b border-surface-200/80 dark:border-white/[0.07] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-15 sm:h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-brand-500 flex items-center justify-center text-white shadow-sm shadow-indigo-500/25 group-hover:scale-105 transition-transform duration-200">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-surface-900 dark:text-white">
                CleanShot
              </span>
              <span className="hidden xs:inline-flex text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-surface-100 dark:bg-white/[0.06] text-surface-600 dark:text-surface-300 border border-surface-200 dark:border-white/[0.08]">
                Lossless
              </span>
            </div>
          </Link>

          {/* Privacy Status */}
          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-surface-100/70 dark:bg-white/[0.04] text-surface-600 dark:text-surface-300 border border-surface-200/70 dark:border-white/[0.06]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Client-side &bull; Zero Server Upload</span>
          </div>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 bg-surface-100/60 dark:bg-white/[0.03] p-1 rounded-full border border-surface-200/60 dark:border-white/[0.06]">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-all duration-150 ${
                  isActive
                    ? 'bg-white dark:bg-white/[0.12] text-surface-950 dark:text-white shadow-xs font-semibold'
                    : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white hover:bg-surface-200/40 dark:hover:bg-white/[0.05]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.06] transition-colors flex items-center gap-1.5 text-xs font-medium"
              title="Configure Stripping Settings"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-white/[0.06] transition-colors ml-0.5"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Slide-Down Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-surface-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-2xl px-4 py-4 space-y-3 animate-fade-in">
          <nav className="grid grid-cols-2 gap-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-brand-50 dark:bg-white/[0.09] text-brand-600 dark:text-white font-semibold'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-surface-200/60 dark:border-white/[0.06] flex items-center justify-between text-[11px] text-surface-500 dark:text-surface-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              100% In-Browser &bull; Private
            </span>
            {onOpenSettings && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSettings();
                }}
                className="text-brand-600 dark:text-brand-400 font-medium"
              >
                Settings
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
