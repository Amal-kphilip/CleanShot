'use client';

import React, { useState } from 'react';
import {
  FilePenLine,
  Download,
  AlertTriangle,
  CheckCircle2,
  FileImage,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import { updateJpegXmp } from '@/lib/tools/jpegXmp';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
type Fields = {
  title: string;
  description: string;
  author: string;
  rights: string;
  creatorTool: string;
  createDate: string;
};
const emptyFields: Fields = {
  title: '',
  description: '',
  author: '',
  rights: '',
  creatorTool: '',
  createDate: '',
};

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-text-sec">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 rounded-[4px] border-2 border-foreground bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-text-ter focus:outline-none"
      />
    </label>
  );
}

export default function EditMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const chooseFile = async (selected: File | undefined) => {
    setFile(null);
    setOutput(null);
    setError('');
    setNote('');
    setFields(emptyFields);
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) {
      setError('File exceeds the 50 MB limit.');
      return;
    }
    if (!/\.jpe?g$/i.test(selected.name) && selected.type !== 'image/jpeg') {
      setError('This editor currently supports JPEG/JPG files only.');
      return;
    }
    setFile(selected);
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      const text = new TextDecoder('latin1').decode(
        bytes.subarray(0, Math.min(bytes.length, 3 * 1024 * 1024))
      );
      const xmpMatch = text.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
      if (xmpMatch) {
        const xmp = xmpMatch[0];
        const extract = (tag: string) =>
          xmp
            .match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]
            ?.replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>') || '';
        setFields({
          title: extract('dc:title'),
          description: extract('dc:description'),
          author: extract('dc:creator'),
          rights: extract('dc:rights'),
          creatorTool: extract('xmp:CreatorTool'),
          createDate: extract('xmp:CreateDate'),
        });
      }
    } catch {
      setError('Could not read this JPEG file.');
    }
  };

  const process = async () => {
    if (!file) return;
    setError('');
    setOutput(null);
    try {
      const source = new Uint8Array(await file.arrayBuffer());
      const result = updateJpegXmp(source, fields);
      setOutput(result);
      setNote(
        'Updated the standard XMP packet. Existing EXIF, GPS and other non-XMP metadata are preserved.'
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Metadata update failed.'
      );
    }
  };

  const download = () => {
    if (!file || !output) return;
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(output)], { type: 'image/jpeg' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download =
      file.name.replace(/\.jpe?g$/i, '') + '_metadata-edited.jpg';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const update = (key: keyof Fields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setOutput(null);
    setNote('');
  };

  return (
    <ToolShell
      title="Edit file metadata."
      description="Add or replace common XMP descriptive fields in JPEG images while keeping the compressed image stream unchanged."
    >
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[4px] border-2 border-foreground bg-background p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2.5">
            <FileImage className="h-5 w-5 text-foreground" />
            <h2 className="text-sm font-semibold text-foreground">
              1. Select a JPEG
            </h2>
          </div>
          <label className="flex cursor-pointer flex-col items-center rounded-[4px] border-2 border-dashed border-foreground px-4 py-8 text-center transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            <FilePenLine className="mb-3 h-6 w-6 text-foreground" />
            <span className="text-sm font-semibold text-foreground">
              Choose a JPEG file
            </span>
            <span className="mt-1 text-[11px] text-text-sec">
              JPG/JPEG · Up to 50 MB · Processed in this tab
            </span>
            <input
              type="file"
              accept="image/jpeg,.jpg,.jpeg"
              className="sr-only"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
          </label>
          {file && (
            <div className="mt-4 break-all rounded-[4px] border border-border-subtle p-3 text-xs">
              <p className="font-semibold text-foreground">{file.name}</p>
              <p className="mt-1 text-text-sec">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 flex gap-2 rounded-[4px] border-2 border-red-500 bg-red-500/10 p-3 text-xs leading-5 text-foreground"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              {error}
            </p>
          )}
          {note && (
            <p
              role="status"
              className="mt-4 flex gap-2 rounded-[4px] border-2 border-foreground p-3 text-xs leading-5 text-foreground"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              {note}
            </p>
          )}
        </section>

        <section className="rounded-[4px] border-2 border-foreground bg-background p-5 sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-foreground">
              2. Descriptive XMP fields
            </h2>
            <p className="mt-1 text-xs text-text-sec">
              Leave a field blank to omit it from the new XMP packet.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Title"
              value={fields.title}
              onChange={(v) => update('title', v)}
              placeholder="Image title"
            />
            <TextField
              label="Author / Creator"
              value={fields.author}
              onChange={(v) => update('author', v)}
              placeholder="Creator name"
            />
            <TextField
              label="Copyright / Rights"
              value={fields.rights}
              onChange={(v) => update('rights', v)}
              placeholder="© 2026 Creator"
            />
            <TextField
              label="Creation date"
              type="datetime-local"
              value={fields.createDate}
              onChange={(v) => update('createDate', v)}
            />
            <div className="sm:col-span-2">
              <TextField
                label="Software / Creator tool"
                value={fields.creatorTool}
                onChange={(v) => update('creatorTool', v)}
                placeholder="Software or workflow name"
              />
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[12px] font-semibold text-text-sec">
                Description
              </span>
              <textarea
                rows={3}
                value={fields.description}
                onChange={(event) => update('description', event.target.value)}
                placeholder="A short description of the image"
                className="w-full resize-y rounded-[4px] border-2 border-foreground bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-text-ter focus:outline-none"
              />
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!file}
              onClick={() => void process()}
              className="px-5 py-2.5 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[13px] font-semibold inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Update XMP</span>
              <FilePenLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={!output}
              onClick={download}
              className="px-5 py-2.5 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[13px] font-semibold inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              <span>Download JPEG</span>
            </button>
          </div>
        </section>
      </div>
    </ToolShell>
  );
}
