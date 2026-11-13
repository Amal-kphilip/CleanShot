import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

export default function PrivacyPage() {
  const principles = [
    {
      num: '01',
      title: '100% browser-local processing.',
      desc: 'CleanShot processes supported files directly in your browser using Web Workers. Your files are never uploaded to a server. The local metadata queue is limited to 50 MB per file and 100 MB total to protect browser memory.',
    },
    {
      num: '02',
      title: 'File contents stay on your device.',
      desc: 'All tools read files locally to inspect, clean, and bundle ZIP archives without transmitting file bytes over the network. You can verify this at any time in your browser Network panel.',
    },
    {
      num: '03',
      title: 'Honest coverage boundaries.',
      desc: 'CleanShot removes documented metadata structures for each supported format and fails closed rather than guessing on malformed containers. No automated tool can guarantee complete anonymity if unknown vendor fields or visible content remain.',
    },
  ];

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />

      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        <section>
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            Client-side only. Your files stay in your browser and are never
            uploaded to a processing server.
          </h1>
        </section>

        <div className="h-[3px] w-full bg-foreground" />

        <section className="flex flex-col gap-8">
          {principles.map((item) => (
            <div key={item.num} className="flex gap-6">
              <span className="text-[13px] sm:text-[14px] font-medium text-text-sec shrink-0 w-8">
                {item.num}
              </span>
              <div className="flex flex-col gap-1">
                <h2 className="text-[18px] sm:text-[20px] font-semibold text-foreground leading-snug">
                  {item.title}
                </h2>
                <p className="text-[14px] sm:text-[16px] text-text-sec leading-relaxed">
                  {item.desc}
                </p>
              </div>
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
