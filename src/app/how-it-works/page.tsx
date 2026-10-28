'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { ArrowRight } from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Drop your files.',
      desc: 'The app reads them directly in your browser. File bytes are not uploaded or sent to a processing server in local mode.',
    },
    {
      num: '02',
      title: 'Metadata is stripped.',
      desc: 'Recognised location, camera, author, document-property and media-tag structures are removed while essential file content is preserved.',
    },
    {
      num: '03',
      title: 'Download the cleaned file.',
      desc: 'Single files download directly. Multiple files are bundled into a ZIP. No copies stored, no access retained.',
    },
  ];

  const faqs = [
    {
      q: 'How does client-side metadata removal work?',
      a: 'All file processing happens directly in your web browser using JavaScript and Web Workers. When you add files, they are read locally and processed using specialized metadata stripping algorithms.',
    },
    {
      q: 'Are my files uploaded?',
      a: 'No. By default, file bytes are read and cleaned in your browser and are not sent to a server. Server-Side mode only runs if you explicitly turn it on in Settings.',
    },
    {
      q: 'What types of metadata does CleanShot remove?',
      a: 'CleanShot targets documented structures for each format: image EXIF/XMP/IPTC, standard PDF properties, DOCX package and author identities, common audio tags, and MP4/MOV or Matroska container metadata.',
    },
    {
      q: 'Does a successful clean guarantee that a file is anonymous?',
      a: 'No. Visible images, text, voices, filenames and unknown application-specific structures can still identify someone. CleanShot removes the metadata structures it targets; you should still review sensitive content before sharing.',
    },
  ];

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />

      <main className="flex-1 w-full flex flex-col gap-10 sm:gap-12 py-4 sm:py-6">
        {/* Hero */}
        <section className="w-full">
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            CleanShot removes targeted privacy-sensitive metadata in your browser,
            before your file is shared.
          </h1>
        </section>

        {/* Steps */}
        <section className="w-full flex flex-col gap-6">
          <h2 className="text-[13px] sm:text-[14px] font-medium text-text-sec">
            How it works
          </h2>
          <div className="flex flex-col gap-8">
            {steps.map((step) => (
              <div key={step.num} className="flex gap-6">
                <span className="text-[13px] sm:text-[14px] font-medium text-text-sec shrink-0 w-8">
                  {step.num}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[18px] sm:text-[20px] font-semibold text-foreground leading-snug">
                    {step.title}
                  </h3>
                  <p className="text-[14px] sm:text-[16px] text-text-sec leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Coverage and limitations */}
        <section className="w-full flex flex-col gap-3">
          <h2 className="text-[13px] sm:text-[14px] font-medium text-text-sec">
            Coverage and limitations
          </h2>
          <p className="text-[14px] sm:text-[16px] text-text-sec leading-relaxed">
            Metadata formats are extensible, so no tool can safely promise that
            every unknown field in every file is gone. CleanShot removes documented
            structures for each supported format and fails instead of guessing when
            a container cannot be parsed safely. It does not redact visible or
            audible content. DOCX comment text and tracked-change markup are
            preserved, although their author identities, dates and revision-session
            IDs are cleaned.
          </p>
        </section>

        <div className="h-[3px] w-full bg-foreground" />

        {/* Supported formats */}
        <section className="w-full flex flex-col gap-4">
          <h2 className="text-[13px] sm:text-[14px] font-medium text-text-sec">
            Supported formats
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground">
                Images
              </span>
              <span className="text-[14px] sm:text-[15px] text-text-sec">
                JPG, PNG, WEBP, GIF, SVG
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground">
                Documents
              </span>
              <span className="text-[14px] sm:text-[15px] text-text-sec">
                PDF, DOCX
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground">
                Video
              </span>
              <span className="text-[14px] sm:text-[15px] text-text-sec">
                MP4, MOV, MKV, WEBM
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[13px] sm:text-[14px] font-medium text-foreground">
                Audio
              </span>
              <span className="text-[14px] sm:text-[15px] text-text-sec">
                MP3, WAV, FLAC, AAC, M4A
              </span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full rounded-xl bg-foreground p-8 sm:p-12 flex flex-col items-center gap-4 text-center">
          <p className="text-[20px] sm:text-[24px] font-medium text-background">
            Try it now. No sign-up, no upload, no catch.
          </p>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-[4px] bg-background text-foreground hover:opacity-90 text-[13px] sm:text-[14px] font-semibold inline-flex items-center gap-2 transition-opacity"
          >
            <span>Remove metadata</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </section>

        {/* FAQ */}
        <section className="w-full flex flex-col gap-6">
          <h2 className="text-[13px] sm:text-[14px] font-medium text-text-sec">
            Frequently asked questions
          </h2>
          <div className="flex flex-col gap-8">
            {faqs.map((item) => (
              <div key={item.q} className="flex flex-col gap-1">
                <h3 className="text-[17px] sm:text-[19px] font-semibold text-foreground leading-snug">
                  {item.q}
                </h3>
                <p className="text-[14px] sm:text-[15px] text-text-sec leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="w-full py-8 sm:py-12 mt-auto">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end text-[12px] font-medium">
          <p className="text-text-sec">Built for everyday digital hygiene.</p>
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-foreground text-text-sec"
          >
            Back to metadata remover
          </Link>
        </div>
      </footer>
    </div>
  );
}
