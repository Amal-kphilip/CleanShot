'use client';

import React from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';

export default function FormatsPage() {
  const formats = [
    {
      name: 'JPEG / JPG',
      status: 'Supported',
      method: 'Segment-level removal of APP1 (EXIF/XMP), APP13 (IPTC), and COM markers',
      preserved: 'Original DCT image bitstream, optional ICC & EXIF Orientation',
    },
    {
      name: 'PNG',
      status: 'Supported',
      method: 'Chunk-level removal of eXIf, tEXt, zTXt, iTXt, and tIME chunks',
      preserved: 'IHDR, PLTE, IDAT, tRNS, iCCP (optional), pHYs, IEND',
    },
    {
      name: 'WebP',
      status: 'Supported',
      method: 'RIFF container chunk removal of EXIF and XMP',
      preserved: 'VP8 / VP8L / VP8X bitstream, ANIM, ANMF, ALPH, ICCP (optional)',
    },
    {
      name: 'GIF',
      status: 'Supported',
      method: 'Comment Extension (0xFE) and XMP Application Extension removal',
      preserved: 'All animation frames, palettes, and NETSCAPE2.0 loop block',
    },
    {
      name: 'SVG',
      status: 'Supported',
      method: 'XML tree sanitization of <metadata>, rdf:RDF, and editor namespace attributes',
      preserved: 'Vector paths, shapes, gradients, viewBox, and styling',
    },
    {
      name: 'PDF',
      status: 'Supported',
      method: 'Offset-preserving removal of /Info dictionary, /Metadata XMP streams, and trailer /ID',
      preserved: 'All pages, text, fonts, vector graphics, and embedded images',
    },
    {
      name: 'DOCX',
      status: 'Supported',
      method: 'Removal of docProps/ XML parts and author/account/revision IDs in word/*.xml',
      preserved: 'Document text, formatting, styles, tables, media, and comment text',
    },
    {
      name: 'MP4 / MOV / M4A',
      status: 'Supported',
      method: 'ISOBMFF box neutralization (udta/meta → free), zeroed timestamps, and timed meta track removal',
      preserved: 'Original video/audio sample streams and chunk offsets without re-encoding',
    },
    {
      name: 'WebM / MKV',
      status: 'Supported',
      method: 'EBML element neutralization (Tags, Chapters, Attachments → Void) and zeroed muxing strings',
      preserved: 'All Cluster audio/video frames and Cue points without re-encoding',
    },
    {
      name: 'MP3 / AAC',
      status: 'Supported',
      method: 'Removal of leading ID3v2 and trailing ID3v1 / APEv2 tags and ADTS encoder fill strings',
      preserved: 'Raw MPEG / ADTS audio frames without re-encoding',
    },
    {
      name: 'FLAC / WAV',
      status: 'Supported',
      method: 'Removal of FLAC VORBIS_COMMENT/PICTURE/APPLICATION blocks and WAV LIST/INFO, bext, and id3 chunks',
      preserved: 'Lossless PCM / FLAC audio frames and seek tables',
    },
  ];

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />

      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        <section>
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            Supported file formats and exact metadata structures removed by CleanShot.
          </h1>
        </section>

        <div className="h-[3px] w-full bg-foreground" />

        <div className="flex flex-col gap-6">
          {formats.map((f) => (
            <div
              key={f.name}
              className="p-5 rounded-[4px] border-2 border-foreground flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[17px] sm:text-[19px] font-semibold text-foreground">
                  {f.name}
                </h2>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-[4px] border border-foreground text-foreground">
                  {f.status}
                </span>
              </div>
              <p className="text-[13px] sm:text-[14px] text-text-sec leading-relaxed">
                <strong className="text-foreground">Removed:</strong> {f.method}
              </p>
              <p className="text-[13px] sm:text-[14px] text-text-sec leading-relaxed">
                <strong className="text-foreground">Preserved:</strong> {f.preserved}
              </p>
            </div>
          ))}
        </div>
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
