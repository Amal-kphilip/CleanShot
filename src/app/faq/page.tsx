'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

export default function FaqPage() {
  const faqs = [
    {
      q: 'How does client-side metadata removal work?',
      a: 'All file processing happens directly in your web browser using JavaScript and Web Workers. When you add files, they are read locally and processed using specialized metadata stripping algorithms without uploading your files.',
    },
    {
      q: 'What types of metadata does CleanShot remove?',
      a: 'CleanShot targets documented structures for each format: image EXIF/XMP/IPTC, standard PDF properties, DOCX package and author identities, common audio tags (ID3, Vorbis, RIFF INFO/bext), and MP4/MOV or Matroska/WebM container metadata.',
    },
    {
      q: 'Does stripping metadata reduce photo, video, or audio quality?',
      a: 'No. CleanShot operates at the container and metadata block level without re-encoding image, audio, or video streams.',
    },
    {
      q: 'Is there a private way to clean PDF and Word document metadata?',
      a: 'Yes. CleanShot processes PDFs and DOCX files directly in your browser. It removes standard PDF Info/XMP properties and DOCX document properties and author/revision identities while preserving visible document content.',
    },
    {
      q: 'Does a successful clean guarantee that a file is anonymous?',
      a: 'No. Visible images, text, voices, filenames and unknown application-specific structures can still identify someone. CleanShot removes the metadata structures it targets; you should still review sensitive content before sharing.',
    },
  ];

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />

      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        <section>
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            Frequently asked questions about metadata privacy and local file cleaning.
          </h1>
        </section>

        <div className="h-[3px] w-full bg-foreground" />

        <section className="flex flex-col gap-8">
          {faqs.map((item) => (
            <div key={item.q} className="flex flex-col gap-1.5">
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-foreground leading-snug">
                {item.q}
              </h2>
              <p className="text-[14px] sm:text-[16px] text-text-sec leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
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
