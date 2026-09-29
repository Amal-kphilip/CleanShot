'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
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
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      {/* Floating Centered Pill Navbar */}
      <header className="sticky top-4 z-50 w-full px-4 sm:px-6 pointer-events-none">
        <div className="max-w-[900px] mx-auto pointer-events-auto relative">
          <nav className="liquid-glass-nav rounded-pill px-3.5 sm:px-4 py-2 flex items-center justify-between transition-all duration-200">
            {/* Logo on Left */}
            <Link
              href="/"
              className="flex items-center gap-2 select-none shrink-0 pl-1 pr-2 py-1 apple-press group"
              aria-label="CleanShot Home"
            >
              {/* App icon: black in light mode, white in dark mode */}
              <img
                src="/app-icon-black.png"
                alt=""
                aria-hidden="true"
                className="h-[26px] sm:h-[28px] w-auto block dark:hidden object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
              <img
                src="/app-icon-white.png"
                alt=""
                aria-hidden="true"
                className="h-[26px] sm:h-[28px] w-auto hidden dark:block object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
              {/* Wordmark */}
              <img
                src="/logo-light.png"
                alt="CleanShot"
                className="h-[18px] sm:h-[20px] w-auto block dark:hidden object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
              <img
                src="/logo-dark.png"
                alt="CleanShot"
                className="h-[18px] sm:h-[20px] w-auto hidden dark:block object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>

            {/* Desktop Navigation Links with Sliding Pill Highlight */}
            <div
              className="hidden lg:flex items-center gap-1 relative"
              onMouseLeave={() => setHoveredTab(null)}
            >
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                const isHovered = hoveredTab === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onMouseEnter={() => setHoveredTab(link.href)}
                    className={`relative px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 rounded-pill select-none ${
                      isActive
                        ? 'text-foreground font-semibold'
                        : 'text-text-sec hover:text-foreground'
                    }`}
                  >
                    {/* Active sliding pill */}
                    {isActive && (
                      <motion.span
                        layoutId="active-nav-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-pill bg-black/[0.06] dark:bg-white/[0.09] shadow-xs -z-10"
                      />
                    )}

                    {/* Hover indicator when not active */}
                    {!isActive && isHovered && (
                      <motion.span
                        layoutId="hover-nav-pill"
                        transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                        className="absolute inset-0 rounded-pill bg-black/[0.03] dark:bg-white/[0.04] -z-10"
                      />
                    )}

                    {link.label}
                  </Link>
                );
              })}
            </div>

            {/* Right Controls: Settings, Theme Toggle & Animated Hamburger */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pr-0.5">
              {onOpenSettings && (
                <button
                  onClick={onOpenSettings}
                  className="p-2 rounded-full text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] apple-spring apple-press flex items-center justify-center"
                  title="Configure Settings"
                  aria-label="Settings"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={toggleTheme}
                className="p-2 rounded-full text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] apple-spring apple-press flex items-center justify-center relative overflow-hidden"
                aria-label="Toggle theme"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={theme}
                    initial={{ y: -10, opacity: 0, rotate: -30 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 10, opacity: 0, rotate: 30 }}
                    transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-700" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* Upgraded Mobile Hamburger Button with Smooth Icon Morph */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`lg:hidden p-2 rounded-full apple-spring apple-press relative transition-colors ${
                  mobileMenuOpen
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground'
                    : 'text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {mobileMenuOpen ? (
                    <motion.div
                      key="close"
                      initial={{ rotate: -90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: 90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <X className="w-4.5 h-4.5" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="menu"
                      initial={{ rotate: 90, opacity: 0 }}
                      animate={{ rotate: 0, opacity: 1 }}
                      exit={{ rotate: -90, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Menu className="w-4.5 h-4.5" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
          </nav>

          {/* Upgraded Mobile Dropdown Glass Menu (Unfolds Directly Under Floating Pill) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                ref={menuRef}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                className="lg:hidden mt-2 liquid-glass-nav rounded-card shadow-floating overflow-hidden p-2.5 space-y-1.5"
              >
                <div className="grid grid-cols-2 gap-1">
                  {navLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-small text-[13px] font-medium transition-all apple-press ${
                          isActive
                            ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground font-semibold shadow-xs'
                            : 'text-text-sec hover:bg-black/[0.03] dark:hover:bg-white/[0.05] hover:text-foreground'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0 text-text-ter" />
                        <span className="truncate">{link.label}</span>
                      </Link>
                    );
                  })}
                </div>

                {/* Footer strip inside mobile menu */}
                <div className="pt-2 border-t border-border-subtle flex items-center justify-between px-2 text-[11px] text-text-ter">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    <span>In-Browser · Lossless</span>
                  </span>

                  {onOpenSettings && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenSettings();
                      }}
                      className="text-accent hover:underline font-medium"
                    >
                      Settings
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Lightweight click-away backdrop */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>
    </>
  );
}
