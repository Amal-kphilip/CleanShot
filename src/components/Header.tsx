'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Cpu,
  Eye,
  FileCheck,
  HelpCircle,
  Layers,
  Lock,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react';

interface HeaderProps {
  onOpenSettings?: () => void;
}

const mainLinks = [
  { href: '/', label: 'Strip', icon: Layers, description: 'Remove supported metadata' },
  { href: '/inspector', label: 'Inspector', icon: Eye, description: 'See what your files contain' },
  { href: '/tools', label: 'Tools', icon: Wrench, description: 'Explore the image toolkit' },
  { href: '/how-it-works', label: 'How it works', icon: Cpu, description: 'Understand the process' },
  { href: '/formats', label: 'Formats', icon: FileCheck, description: 'Check supported formats' },
  { href: '/privacy', label: 'Privacy', icon: Lock, description: 'Learn how files are handled' },
  { href: '/faq', label: 'FAQ', icon: HelpCircle, description: 'Answers to common questions' },
];

const quickTools = [
  { href: '/analyze-image', label: 'Analyze image' },
  { href: '/compare-images', label: 'Compare images' },
  { href: '/edit-metadata', label: 'Edit metadata' },
];

export function Header({ onOpenSettings }: HeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const menuDialogRef = useRef<HTMLDivElement>(null);
  const closeMenuButtonRef = useRef<HTMLButtonElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Lock page scroll and keep keyboard focus inside the mobile menu while it is open.
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => closeMenuButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileMenuOpen(false);
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = menuDialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !menuDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !menuDialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else menuTriggerRef.current?.focus();
    };
  }, [mobileMenuOpen]);

  const isActive = (href: string) => href === '/'
    ? pathname === '/'
    : pathname === href || Boolean(pathname?.startsWith(`${href}/`));

  const closeMenu = () => setMobileMenuOpen(false);

  const overlayTransition = shouldReduceMotion
    ? { duration: 0.01 }
    : { duration: 0.12, ease: 'easeOut' as const };

  const contentVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : { duration: 0.16, ease: [0.22, 1, 0.36, 1] as const, staggerChildren: 0.025, delayChildren: 0.015 },
    },
    exit: { opacity: 0, y: shouldReduceMotion ? 0 : 6, transition: overlayTransition },
  };

  const linkVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 13 },
    visible: {
      opacity: 1,
      y: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : { duration: 0.15, ease: [0.22, 1, 0.36, 1] as const },
    },
    exit: { opacity: 0, y: 2, transition: { duration: shouldReduceMotion ? 0.01 : 0.08 } },
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full px-3 min-[380px]:px-4 sm:px-6 pointer-events-none">
        <div className="max-w-[1280px] mx-auto pointer-events-auto relative">
          <nav className="liquid-glass-nav site-nav min-w-0 gap-2 px-2.5 min-[380px]:px-3.5 sm:px-4 py-2 flex items-center justify-between transition-all duration-200">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-1.5 min-[380px]:gap-2 select-none shrink-0 pl-0.5 pr-1.5 min-[380px]:pl-1 min-[380px]:pr-2 py-1 apple-press group"
              aria-label="CleanShot Home"
            >
              <img
                src="/app-icon-white.png"
                alt=""
                aria-hidden="true"
                className="h-7 w-7 shrink-0 object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
              <img
                src="/logo-dark.png"
                alt="CleanShot"
                className="h-5 w-auto max-w-[112px] object-contain transition-opacity duration-200 group-hover:opacity-80"
              />
            </Link>

            <div
              className="hidden lg:flex items-center gap-1 relative"
              onMouseLeave={() => setHoveredTab(null)}
            >
              {mainLinks.map((link) => {
                const active = isActive(link.href);
                const hovered = hoveredTab === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onMouseEnter={() => setHoveredTab(link.href)}
                    aria-current={active ? 'page' : undefined}
                    className={`relative px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 rounded-pill select-none ${active ? 'text-foreground font-semibold' : 'text-text-sec hover:text-foreground'}`}
                  >
                    {active && (
                      <motion.span
                        layoutId="active-nav-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 rounded-pill bg-black/[0.06] dark:bg-white/[0.09] shadow-xs -z-10"
                      />
                    )}
                    {!active && hovered && (
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

            <div className="flex items-center gap-0.5 min-[380px]:gap-1.5 shrink-0 pr-0.5">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-2 rounded-full text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] apple-spring apple-press flex items-center justify-center"
                  title="Configure Settings"
                  aria-label="Settings"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
              )}

              <button
                ref={menuTriggerRef}
                type="button"
                onClick={() => setMobileMenuOpen((open) => !open)}
                className={`lg:hidden relative isolate inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4ff4b] focus-visible:ring-offset-2 focus-visible:ring-offset-black apple-press ${mobileMenuOpen ? 'border-[#c4ff4b]/40 bg-[#c4ff4b] text-[#0b0d08]' : 'border-white/[0.10] bg-white/[0.035] text-text-sec hover:border-[#c4ff4b]/40 hover:text-[#c4ff4b]'}`}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-navigation"
                aria-haspopup="dialog"
              >
                <span aria-hidden="true" className="relative block h-6 w-6">
                  <motion.span
                    className="absolute left-[3px] top-1/2 h-[1.5px] w-5 rounded-full bg-current"
                    animate={mobileMenuOpen ? { rotate: 45, y: 0 } : { rotate: 0, y: -6 }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 600, damping: 36, mass: 0.45 }}
                  />
                  <motion.span
                    className="absolute left-[3px] top-1/2 h-[1.5px] w-5 rounded-full bg-current"
                    animate={mobileMenuOpen ? { opacity: 0, scaleX: 0.25 } : { opacity: 1, scaleX: 1 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.1 }}
                  />
                  <motion.span
                    className="absolute left-[3px] top-1/2 h-[1.5px] w-5 rounded-full bg-current"
                    animate={mobileMenuOpen ? { rotate: -45, y: 0 } : { rotate: 0, y: 6 }}
                    transition={shouldReduceMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 600, damping: 36, mass: 0.45 }}
                  />
                </span>
                <span className="sr-only">{mobileMenuOpen ? 'Close menu' : 'Open menu'}</span>
              </button>
            </div>
          </nav>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu-overlay"
            className="fixed inset-0 z-[70] lg:hidden overflow-y-auto overscroll-contain bg-[#080a07] text-[#f4f5ef]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={overlayTransition}
          >
            <div
              ref={menuDialogRef}
              id="mobile-navigation"
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-menu-title"
              className="relative flex min-h-[100dvh] flex-col overflow-hidden"
            >
              <div aria-hidden="true" className="mobile-menu-glow mobile-menu-glow-primary" />
              <div aria-hidden="true" className="mobile-menu-glow mobile-menu-glow-secondary" />
              <div aria-hidden="true" className="pointer-events-none absolute right-3 top-[18%] select-none font-serif text-[clamp(9rem,40vw,22rem)] leading-none tracking-[-0.1em] text-white/[0.018]">SM</div>

              <div className="relative z-10 mx-auto flex w-full max-w-[1040px] items-center justify-between gap-4 px-5 pt-5 sm:px-8 sm:pt-7">
                <Link href="/" onClick={closeMenu} className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4ff4b]" aria-label="CleanShot home">
                  <img src="/app-icon-white.png" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
                  <img src="/logo-dark.png" alt="CleanShot" className="h-[21px] w-auto max-w-[124px] object-contain" />
                </Link>
                <button
                  ref={closeMenuButtonRef}
                  type="button"
                  onClick={closeMenu}
                  data-menu-focusable="true"
                  className="group inline-flex min-h-11 shrink-0 items-center gap-3 rounded-full border border-white/[0.14] bg-white/[0.035] py-2 pl-4 pr-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:border-[#c4ff4b]/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4ff4b]"
                >
                  <span>Close</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/[0.08] text-[#c4ff4b] transition-transform duration-300 group-hover:rotate-90">
                    <span className="text-lg font-light leading-none" aria-hidden="true">×</span>
                  </span>
                </button>
              </div>

              <motion.main
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="relative z-10 mx-auto flex w-full max-w-[1040px] flex-1 flex-col px-5 pb-7 pt-10 sm:px-8 sm:pb-9 sm:pt-14"
              >
                <motion.div variants={linkVariants} className="mb-5 flex items-center gap-2.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45 sm:text-[11px]">
                  <span className="h-px w-7 bg-[#c4ff4b]" />
                  <span>Explore StripMeta</span>
                  <span className="ml-auto font-mono tracking-[0.12em] text-white/30">07 PAGES</span>
                </motion.div>

                <motion.h2
                  id="mobile-menu-title"
                  variants={linkVariants}
                  className="mb-8 font-serif text-[clamp(2.8rem,12vw,5.8rem)] font-medium leading-[0.9] tracking-[-0.065em] text-[#f4f5ef] sm:mb-10"
                >
                  Files, <span className="text-white/45">under</span>
                  <br />
                  <span className="text-[#c4ff4b]">control.</span>
                </motion.h2>

                <motion.nav aria-label="Mobile navigation links" variants={contentVariants} className="w-full">
                  {mainLinks.map((link, index) => {
                    const Icon = link.icon;
                    const active = isActive(link.href);
                    return (
                      <motion.div key={link.href} variants={linkVariants} whileHover={shouldReduceMotion ? undefined : { x: 4 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}>
                        <Link
                          href={link.href}
                          onClick={closeMenu}
                          aria-current={active ? 'page' : undefined}
                          data-menu-focusable="true"
                          className={`group grid min-h-[66px] grid-cols-[2.15rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-white/[0.095] py-3 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c4ff4b] sm:min-h-[76px] sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:gap-3 ${active ? 'text-[#c4ff4b]' : 'text-white/80 hover:text-white'}`}
                        >
                          <span className={`font-mono text-[10px] tabular-nums sm:text-[11px] ${active ? 'text-[#c4ff4b]' : 'text-white/30 group-hover:text-[#c4ff4b]/80'}`}>{String(index + 1).padStart(2, '0')}</span>
                          <span className="flex min-w-0 items-center gap-3 sm:gap-4">
                            <Icon className={`h-[17px] w-[17px] shrink-0 transition-colors duration-200 sm:h-[18px] sm:w-[18px] ${active ? 'text-[#c4ff4b]' : 'text-white/35 group-hover:text-[#c4ff4b]'}`} strokeWidth={1.6} />
                            <span className="min-w-0 truncate text-[clamp(1.15rem,5.2vw,1.85rem)] font-medium leading-tight tracking-[-0.035em]">{link.label}</span>
                          </span>
                          <span className="flex items-center gap-2 pl-1">
                            {active && <span className="hidden rounded-full border border-[#c4ff4b]/30 px-2 py-1 text-[8px] font-semibold uppercase tracking-[0.16em] text-[#c4ff4b] min-[360px]:inline-flex">Current</span>}
                            <ArrowUpRight className={`h-4 w-4 shrink-0 transition-all duration-300 ${active ? 'text-[#c4ff4b]' : 'text-white/20 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#c4ff4b]'}`} strokeWidth={1.7} />
                          </span>
                        </Link>
                      </motion.div>
                    );
                  })}
                </motion.nav>

                <motion.div variants={linkVariants} className="mt-7 sm:mt-8">
                  <div className="mb-3 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/35 sm:text-[10px]">
                    <Sparkles className="h-3.5 w-3.5 text-[#c4ff4b]/80" strokeWidth={1.7} />
                    Quick launch
                  </div>
                  <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-3">
                    {quickTools.map((tool, index) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        onClick={closeMenu}
                        data-menu-focusable="true"
                        className="group flex min-h-11 items-center justify-between gap-3 rounded-xl border border-white/[0.10] bg-white/[0.025] px-3.5 py-3 text-[12px] font-medium text-white/65 transition-all hover:border-[#c4ff4b]/35 hover:bg-[#c4ff4b]/[0.055] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4ff4b]"
                      >
                        <span className="min-w-0 truncate">{tool.label}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition-all group-hover:translate-x-1 group-hover:text-[#c4ff4b]" strokeWidth={1.7} />
                      </Link>
                    ))}
                  </div>
                </motion.div>

                <motion.div variants={linkVariants} className="mt-auto flex flex-col gap-4 pt-10 min-[420px]:flex-row min-[420px]:items-end min-[420px]:justify-between sm:pt-12">
                  <div className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.16em] text-white/35">
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="absolute h-2 w-2 animate-ping rounded-full bg-[#c4ff4b]/35" />
                      <span className="relative h-1.5 w-1.5 rounded-full bg-[#c4ff4b]" />
                    </span>
                    <span>Privacy-first utilities</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                    {onOpenSettings && (
                      <button
                        type="button"
                        data-menu-focusable="true"
                        onClick={() => {
                          closeMenu();
                          onOpenSettings();
                        }}
                        className="inline-flex min-h-10 items-center gap-2 text-[11px] font-medium text-white/55 transition-colors hover:text-[#c4ff4b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4ff4b]"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Settings
                      </button>
                    )}
                    <span className="text-[9px] uppercase tracking-[0.17em] text-white/25">Menu · 01 / 01</span>
                  </div>
                </motion.div>
              </motion.main>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
