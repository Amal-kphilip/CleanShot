'use client';

import React, { useState } from 'react';
import { FilePenLine, Download, AlertTriangle, CheckCircle2, FileImage } from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import { updateJpegXmp } from '@/lib/tools/jpegXmp';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
type Fields = { title: string; description: string; author: string; rights: string; creatorTool: string; createDate: string };
const emptyFields: Fields = { title: '', description: '', author: '', rights: '', creatorTool: '', createDate: '' };

function TextField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return <label className="block"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-text-ter">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full min-w-0 border border-border-subtle bg-black/40 px-3 py-3 text-sm text-foreground placeholder:text-text-ter focus:border-lime-300 focus:outline-none" /></label>;
}

export default function EditMetadataPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [output, setOutput] = useState<Uint8Array | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  const chooseFile = async (selected: File | undefined) => {
    setFile(null); setOutput(null); setError(''); setNote(''); setFields(emptyFields);
    if (!selected) return;
    if (selected.size > MAX_FILE_SIZE) { setError('File exceeds the 50 MB limit.'); return; }
    if (!/\.jpe?g$/i.test(selected.name) && selected.type !== 'image/jpeg') { setError('This editor currently supports JPEG/JPG files only.'); return; }
    setFile(selected);
    try {
      const bytes = new Uint8Array(await selected.arrayBuffer());
      const text = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 3 * 1024 * 1024)));
      const xmpMatch = text.match(/<x:xmpmeta[\s\S]*?<\/x:xmpmeta>/);
      if (xmpMatch) {
        const xmp = xmpMatch[0];
        const extract = (tag: string) => xmp.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>') || '';
        setFields({
          title: extract('dc:title'), description: extract('dc:description'), author: extract('dc:creator'),
          rights: extract('dc:rights'), creatorTool: extract('xmp:CreatorTool'), createDate: extract('xmp:CreateDate'),
        });
      }
    } catch { setError('Could not read this JPEG file.'); }
  };

  const process = async () => {
    if (!file) return;
    setError(''); setOutput(null);
    try {
      const source = new Uint8Array(await file.arrayBuffer());
      const result = updateJpegXmp(source, fields);
      setOutput(result);
      setNote('Updated the standard XMP packet. Existing EXIF, GPS and other non-XMP metadata are preserved. Use the Metadata Remover separately if your goal is privacy cleaning.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Metadata update failed.'); }
  };
  const download = () => {
    if (!file || !output) return;
    const url = URL.createObjectURL(new Blob([new Uint8Array(output)], { type: 'image/jpeg' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = file.name.replace(/\.jpe?g$/i, '') + '_metadata-edited.jpg'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const update = (key: keyof Fields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setOutput(null);
    setNote('');
  };

  return <ToolShell title="Edit file" accent="metadata." description="Add or replace common XMP descriptive fields in JPEG images. This keeps the compressed image stream unchanged; it does not edit camera EXIF tags or remove other metadata.">
    <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
      <section className="border border-border-subtle bg-white/[.02] p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3"><FileImage className="h-5 w-5 text-lime-300"/><h2 className="text-sm font-semibold">1. Select a JPEG</h2></div>
        <label className="flex cursor-pointer flex-col items-center border border-dashed border-white/20 bg-black/25 px-4 py-8 text-center transition-colors hover:border-lime-300/50">
          <FilePenLine className="mb-3 h-7 w-7 text-lime-300"/><span className="text-sm font-medium">Choose a JPEG file</span><span className="mt-1 text-[11px] text-text-ter">JPG/JPEG · Up to 50 MB · Processed in this tab</span>
          <input type="file" accept="image/jpeg,.jpg,.jpeg" className="sr-only" onChange={(event) => void chooseFile(event.target.files?.[0])}/>
        </label>
        {file && <div className="mt-4 break-all border border-border-subtle p-3 text-xs"><p className="font-semibold">{file.name}</p><p className="mt-1 text-text-ter">{(file.size / 1024 / 1024).toFixed(2)} MB</p></div>}
        {error && <p role="alert" className="mt-4 flex gap-2 border border-red-400/20 bg-red-400/5 p-3 text-xs leading-5 text-red-200"><AlertTriangle className="h-4 w-4 shrink-0"/>{error}</p>}
        {note && <p role="status" className="mt-4 flex gap-2 border border-lime-300/20 bg-lime-300/[.04] p-3 text-xs leading-5 text-lime-100"><CheckCircle2 className="h-4 w-4 shrink-0"/>{note}</p>}
      </section>
      <section className="border border-border-subtle bg-white/[.02] p-5 sm:p-6">
        <div className="mb-5"><p className="section-kicker">2. EDIT XMP</p><h2 className="display-serif mt-2 text-3xl">Descriptive fields</h2><p className="mt-2 text-xs leading-5 text-text-ter">Leave a field blank to omit it from the new XMP packet.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Title" value={fields.title} onChange={(v) => update('title', v)} placeholder="Image title"/>
          <TextField label="Author / Creator" value={fields.author} onChange={(v) => update('author', v)} placeholder="Creator name"/>
          <TextField label="Copyright / Rights" value={fields.rights} onChange={(v) => update('rights', v)} placeholder="© 2026 Creator"/>
          <TextField label="Creation date" type="datetime-local" value={fields.createDate} onChange={(v) => update('createDate', v)} />
          <div className="sm:col-span-2"><TextField label="Software / Creator tool" value={fields.creatorTool} onChange={(v) => update('creatorTool', v)} placeholder="Software or workflow name"/></div>
          <label className="block sm:col-span-2"><span className="mb-2 block text-[11px] font-semibold uppercase tracking-[.12em] text-text-ter">Description</span><textarea rows={3} value={fields.description} onChange={(event) => update('description', event.target.value)} placeholder="A short description of the image" className="w-full resize-y border border-border-subtle bg-black/40 px-3 py-3 text-sm text-foreground placeholder:text-text-ter focus:border-lime-300 focus:outline-none"/></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={!file} onClick={() => void process()} className="primary-cta disabled:cursor-not-allowed disabled:opacity-40">Update XMP <FilePenLine className="h-4 w-4"/></button><button type="button" disabled={!output} onClick={download} className="secondary-cta disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4"/> Download JPEG</button></div>
      </section>
    </div>
  </ToolShell>;
}
