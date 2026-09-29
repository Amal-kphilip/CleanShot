'use client';

import React, { useState, useEffect } from 'react';
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
      {/* Floating Centered Pill Navbar */}
      <header className="sticky top-4 z-50 w-full px-4 sm:px-6 pointer-events-none">
        <div className="max-w-[900px] mx-auto pointer-events-auto">
          <nav className="liquid-glass-nav rounded-pill px-3.5 sm:px-4 py-2 flex items-center justify-between transition-all duration-300">
            {/* Logo on Left */}
            <Link
              href="/"
              className="flex items-center select-none shrink-0 pl-1 pr-2 py-1 apple-press group"
              aria-label="CleanShot Home"
            >
              <img
                src="/logo-light.png"
                alt="CleanShot"
                className="h-[21px] sm:h-[23px] w-auto block dark:hidden object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
              <img
                src="/logo-dark.png"
                alt="CleanShot"
                className="h-[21px] sm:h-[23px] w-auto hidden dark:block object-contain transition-opacity duration-200 group-hover:opacity-80"
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
                    className={`relative px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-200 rounded-pill select-none ${
                      isActive
                        ? 'text-foreground font-semibold'
                        : 'text-text-sec hover:text-foreground'
                    }`}
                  >
                    {/* Active sliding pill */}
                    {isActive && (
                      <motion.span
                        layoutId="active-nav-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
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

            {/* Right Controls: Settings & Theme Toggle */}
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
                    initial={{ y: -12, opacity: 0, rotate: -40 }}
                    animate={{ y: 0, opacity: 1, rotate: 0 }}
                    exit={{ y: 12, opacity: 0, rotate: 40 }}
                    transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  >
                    {theme === 'dark' ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-slate-700" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </button>

              {/* Mobile Hamburger Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-full text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] apple-spring apple-press"
                aria-label="Open navigation menu"
              >
                <Menu className="w-4.5 h-4.5" />
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Mobile Slide-in Glass Sheet */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[70] w-72 max-w-[85vw] liquid-glass bg-white/95 dark:bg-[#0A0A0C]/95 border-l border-white/[0.1] shadow-2xl lg:hidden flex flex-col"
            >
              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 h-16 border-b border-black/[0.06] dark:border-white/[0.07]">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center py-1"
                >
                  <img
                    src="/logo-light.png"
                    alt="CleanShot"
                    className="h-5 w-auto block dark:hidden object-contain"
                  />
                  <img
                    src="/logo-dark.png"
                    alt="CleanShot"
                    className="h-5 w-auto hidden dark:block object-contain"
                  />
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-full text-text-ter hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nav links */}
              <nav className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1">
                {navLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-card text-[14px] font-medium transition-all ${
                        isActive
                          ? 'bg-black/[0.06] dark:bg-white/[0.09] text-foreground font-semibold'
                          : 'text-text-sec hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-foreground'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5 shrink-0 text-text-ter" />
                      <span>{link.label}</span>
                    </Link>
                  );
                })}
              </nav>

              {/* Sheet footer */}
              <div className="px-5 py-5 border-t border-black/[0.06] dark:border-white/[0.07] space-y-3">
                {onOpenSettings && (
                  <button
                    onClick={() => { setMobileMenuOpen(false); onOpenSettings(); }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-black/[0.04] dark:bg-white/[0.06] text-foreground text-[13px] font-medium transition-colors hover:bg-black/[0.08] dark:hover:bg-white/[0.1] apple-press"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-text-ter" />
                    <span>Settings</span>
                  </button>
                )}
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-text-ter">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  <span>100% In-Browser · Private</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
