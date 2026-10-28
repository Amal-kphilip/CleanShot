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
  title: 'Image & Metadata Tools | CleanShot',
  description:
    'Remove supported metadata, inspect metadata, edit JPEG XMP fields, analyze image properties, and compare images locally.',
};

export default function ToolsPage() {
  return (
    <ToolShell
      showBack={false}
      title="Local file & metadata tools."
      description="A focused set of browser-based tools for inspecting, cleaning, and comparing files directly on your device."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ToolCard
          href="/"
          icon={<ShieldCheck size={18} />}
          title="Metadata Remover"
          description="Remove supported embedded metadata from images, PDFs, DOCX documents, videos, and audio files."
        />
        <ToolCard
          href="/inspector"
          icon={<ScanSearch size={18} />}
          title="Metadata Inspector"
          description="Inspect hidden metadata, including GPS coordinates, camera details, dates, software, and creator fields."
        />
        <ToolCard
          href="/edit-metadata"
          icon={<SlidersHorizontal size={18} />}
          title="Edit JPEG XMP"
          description="Add or replace common XMP descriptive fields in JPEG files while keeping the compressed image stream intact."
          status="JPEG · XMP"
        />
        <ToolCard
          href="/analyze-image"
          icon={<ScanLine size={18} />}
          title="Analyze Image"
          description="Review dimensions, aspect ratio, megapixels, sampled brightness, transparency, file size, and readable metadata."
        />
        <ToolCard
          href="/compare-images"
          icon={<Images size={18} />}
          title="Compare Images"
          description="Compare two images side by side with an interactive slider and generate a pixel-difference heatmap."
        />
      </div>
    </ToolShell>
  );
}
