import type { Metadata } from 'next';
import {
  ShieldCheck,
  ScanSearch,
  SlidersHorizontal,
  ScanLine,
  Images,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import { ToolCard } from '@/components/tools/ToolCard';

export const metadata: Metadata = {
  title: 'Image & Metadata Tools | StripMeta',
  description: 'Remove supported image metadata, inspect image metadata, edit JPEG XMP fields, analyze image properties, and compare images locally.',
};

export default function ToolsPage() {
  return (
    <ToolShell
      showBack={false}
      eyebrow="IMAGE PRIVACY & ANALYSIS"
      title="One toolkit."
      accent="More control."
      description="A focused set of tools for image metadata and image comparison. Processing takes place in your browser for these added tools; each tool states its actual capabilities and limitations."
    >
      <div className="mb-8 grid grid-cols-1 gap-px border border-border-subtle bg-border-subtle sm:grid-cols-3">
        <div className="bg-black/80 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-text-ter">File handling</p>
          <p className="mt-2 text-sm font-semibold">Browser-based tools</p>
        </div>
        <div className="bg-black/80 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-text-ter">Focus</p>
          <p className="mt-2 text-sm font-semibold">Images & metadata</p>
        </div>
        <div className="bg-black/80 p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.16em] text-text-ter">Results</p>
          <p className="mt-2 text-sm font-semibold">Format-specific status</p>
        </div>
      </div>

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">THE WORKSPACE</p>
          <h2 className="display-serif mt-2 text-3xl">Choose a tool</h2>
        </div>
        <p className="max-w-xs text-right text-[10px] leading-5 text-text-ter">
          Review each tool&apos;s format limits before using results for sensitive files.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          href="/"
          icon={<ShieldCheck size={19} />}
          title="Metadata Remover"
          description="Remove supported embedded metadata from images while preserving image data where the format-specific cleaner allows it."
        />
        <ToolCard
          href="/inspector"
          icon={<ScanSearch size={19} />}
          title="Metadata Viewer"
          description="Inspect supported image metadata, including GPS, camera details, dates, software, and creator fields."
        />
        <ToolCard
          href="/edit-metadata"
          icon={<SlidersHorizontal size={19} />}
          title="Edit JPEG XMP"
          description="Add or replace common XMP descriptive fields in JPEG files. This does not edit EXIF fields or remove metadata."
          status="JPEG · XMP"
        />
        <ToolCard
          href="/analyze-image"
          icon={<ScanLine size={19} />}
          title="Analyze Image"
          description="Review dimensions, aspect ratio, megapixels, sampled brightness, transparency, file size, and readable metadata."
        />
        <ToolCard
          href="/compare-images"
          icon={<Images size={19} />}
          title="Compare Images"
          description="Compare two images with an adjustable overlay and a pixel-difference heatmap. The comparison is technical, not an AI-origin detector."
        />
      </div>

      <div className="mt-8 border border-lime-300/20 bg-lime-300/[.04] p-4 sm:p-5">
        <p className="text-xs font-semibold text-lime-200">Accuracy note</p>
        <p className="mt-1 text-xs leading-6 text-text-sec">
          Metadata removal does not guarantee that a platform will stop identifying an image as AI-generated or edited. Image analysis and pixel comparison do not determine image origin.
        </p>
      </div>
    </ToolShell>
  );
}
