'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  FileJson,
  FileText,
  LoaderCircle,
  Play,
  Search,
  ShieldCheck,
} from 'lucide-react';

type ScanStatus = 'idle' | 'running' | 'ready' | 'error';
type OutputMode = 'text' | 'json';

type ExifToolResult<T> =
  | { success: true; data: T; exitCode: 0 }
  | { success: false; data: undefined; error: string; exitCode: number | undefined };

interface FileDetails {
  name: string;
  size: string;
  mime: string;
  lastModified: string;
  magicBytes: string;
  sha256: string;
}

interface ExifToolFullScanProps {
  file?: File;
}

const WASM_URL = '/zeroperl.wasm';
const HASH_LIMIT_BYTES = 128 * 1024 * 1024;
let exifToolQueue: Promise<void> = Promise.resolve();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value: number): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function safeBaseName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  return (withoutExtension || 'metadata').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

async function getFileDetails(file: File): Promise<FileDetails> {
  const headerBuffer = await file.slice(0, 32).arrayBuffer();
  const header = new Uint8Array(headerBuffer);
  const magicBytes = Array.from(header, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');

  let sha256 = 'Not available in this browser context';
  if (file.size > HASH_LIMIT_BYTES) {
    sha256 = 'Skipped for files larger than 128 MiB to avoid excessive memory use';
  } else if (globalThis.crypto?.subtle) {
    try {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    } catch {
      sha256 = 'Hash calculation failed';
    }
  }

  return {
    name: file.name,
    size: `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`,
    mime: file.type || 'Not declared by the browser',
    lastModified: formatDate(file.lastModified),
    magicBytes: magicBytes || 'Empty file',
    sha256,
  };
}

async function runExifToolNow(file: File, json: boolean): Promise<string> {
  // This package is loaded only when the user explicitly starts a deep scan.
  // The selected file is passed directly to ExifTool; no upload API is used.
  const { parseMetadata } = await import('@uswriting/exiftool');
  const args = json ? ['-json', '-a', '-u', '-G1', '-n'] : ['-a', '-u', '-G1', '-s', '-n'];

  const result = (await parseMetadata(file, {
    args,
    fetch: async () => {
      const response = await fetch(WASM_URL, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`The local ExifTool runtime could not be loaded (${response.status}).`);
      }
      return response;
    },
    ...(json ? { transform: (output: string) => JSON.parse(output) as unknown } : {}),
  })) as ExifToolResult<unknown>;

  if (!result.success) throw new Error(result.error || 'ExifTool could not inspect this file.');
  if (typeof result.data === 'string') return result.data;
  return JSON.stringify(result.data, null, 2) ?? String(result.data ?? '');
}

// The runtime keeps shared stdout/stderr buffers; serialize operations so scans cannot mix output.
function runExifTool(file: File, json: boolean): Promise<string> {
  const operation = exifToolQueue.then(
    () => runExifToolNow(file, json),
    () => runExifToolNow(file, json),
  );
  exifToolQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

function downloadText(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExifToolFullScan({ file }: ExifToolFullScanProps) {
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [rawOutput, setRawOutput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');
  const [mode, setMode] = useState<OutputMode>('text');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [fileDetails, setFileDetails] = useState<FileDetails | null>(null);
  const [jsonLoading, setJsonLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const currentFileRef = useRef<File | undefined>(file);
  currentFileRef.current = file;

  useEffect(() => {
    setStatus('idle');
    setRawOutput('');
    setJsonOutput('');
    setMode('text');
    setQuery('');
    setError('');
    setFileDetails(null);
    setJsonLoading(false);
    setFeedback('');
  }, [file]);

  const visibleOutput = mode === 'json' ? jsonOutput : rawOutput;
  const filteredOutput = useMemo(() => {
    if (!query.trim()) return visibleOutput;
    const needle = query.toLowerCase();
    return visibleOutput
      .split(/\r?\n/)
      .filter((line) => line.toLowerCase().includes(needle))
      .join('\n');
  }, [visibleOutput, query]);

  const scan = async () => {
    if (!file || status === 'running' || jsonLoading) return;
    const sourceFile = file;
    setStatus('running');
    setError('');
    setFeedback('');
    setRawOutput('');
    setJsonOutput('');
    setMode('text');

    try {
      const [output, details] = await Promise.all([
        runExifTool(file, false),
        getFileDetails(file),
      ]);
      if (currentFileRef.current !== sourceFile) return;
      setRawOutput(output.trim() || 'ExifTool returned no metadata output.');
      setFileDetails(details);
      setStatus('ready');
    } catch (caught) {
      if (currentFileRef.current !== sourceFile) return;
      setError(caught instanceof Error ? caught.message : 'The full metadata scan failed.');
      setStatus('error');
    }
  };

  const generateJson = async () => {
    if (!file || status !== 'ready' || jsonLoading) return;
    const sourceFile = file;
    setJsonLoading(true);
    setError('');
    setFeedback('');
    try {
      const output = await runExifTool(sourceFile, true);
      if (currentFileRef.current !== sourceFile) return;
      setJsonOutput(output);
      setMode('json');
    } catch (caught) {
      if (currentFileRef.current !== sourceFile) return;
      setError(caught instanceof Error ? caught.message : 'JSON export failed.');
    } finally {
      setJsonLoading(false);
    }
  };

  const copyOutput = async () => {
    if (!visibleOutput) return;
    try {
      await navigator.clipboard.writeText(visibleOutput);
      setFeedback('Copied to clipboard');
    } catch {
      setFeedback('Clipboard access was blocked by the browser. Use the download button instead.');
    }
  };

  if (!file) {
    return (
      <div className="p-6 sm:p-8 text-sm text-text-sec">
        Select a file in the inspector first to run a full ExifTool scan.
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
      <div className="rounded-small border border-emerald-500/20 bg-emerald-500/[0.06] p-3.5 flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-foreground">Full ExifTool scan · browser-local processing</p>
          <p className="text-[11px] leading-relaxed text-text-sec mt-1">
            The original file is read in your browser and is not sent to a metadata API. The first scan downloads the ExifTool WebAssembly runtime from this website; it may take a few seconds.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="min-w-0">
          <h4 className="text-[14px] font-semibold text-foreground break-words">{file.name}</h4>
          <p className="text-[11px] text-text-ter mt-1">
            Includes duplicate tags (-a), unknown tags (-u), group names (-G1), short/raw tag names (-s), and numeric values (-n).
          </p>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={status === 'running' || jsonLoading}
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-pill bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-2.5 text-[12px] font-semibold text-black transition-colors"
        >
          {status === 'running' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {status === 'running' ? 'Scanning file…' : status === 'ready' ? 'Scan again' : 'Run full scan'}
        </button>
      </div>

      {status === 'running' && (
        <div className="border border-border-subtle rounded-small p-4 text-[12px] text-text-sec flex items-center gap-2">
          <LoaderCircle className="w-4 h-4 animate-spin shrink-0" /> Loading ExifTool and reading all available tags. Large files may take longer.
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-small border border-red-500/25 bg-red-500/[0.06] p-3.5 flex items-start gap-2.5 text-[12px] text-red-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Full scan or export failed</p>
            <p className="mt-1 break-words">{error}</p>
            <p className="mt-1 text-text-sec">Try a supported file copy and check that the local ExifTool runtime is available at /zeroperl.wasm.</p>
          </div>
        </div>
      )}

      {status === 'ready' && fileDetails && (
        <>
          <section className="border border-border-subtle rounded-small overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-ter" />
              <h5 className="text-[12px] font-semibold text-foreground">Technical file details & checksums</h5>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-border-subtle">
              {([
                ['File name', fileDetails.name],
                ['File size', fileDetails.size],
                ['Browser MIME type', fileDetails.mime],
                ['Last modified', fileDetails.lastModified],
                ['First 32 bytes (hex)', fileDetails.magicBytes || 'Not available'],
                ['SHA-256', fileDetails.sha256],
              ] as const).map(([label, value]) => (
                <div key={label} className="bg-background/95 px-4 py-3 min-w-0">
                  <dt className="text-[10px] uppercase tracking-wide text-text-ter mb-1">{label}</dt>
                  <dd className="text-[11px] font-mono text-foreground break-all select-text">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setMode('text')}
                className={`px-3 py-2 rounded-pill text-[11px] font-medium border ${mode === 'text' ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground' : 'border-border-subtle text-text-sec'}`}
              >
                Raw ExifTool output
              </button>
              <button
                type="button"
                onClick={generateJson}
                disabled={jsonLoading}
                className={`px-3 py-2 rounded-pill text-[11px] font-medium border border-border-subtle text-text-sec hover:text-foreground disabled:opacity-60 inline-flex items-center gap-1.5`}
              >
                {jsonLoading ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <FileJson className="w-3.5 h-3.5" />}
                {jsonOutput ? 'Refresh JSON' : 'Generate JSON'}
              </button>
              {jsonOutput && (
                <button
                  type="button"
                  onClick={() => setMode('json')}
                  className={`px-3 py-2 rounded-pill text-[11px] font-medium border ${mode === 'json' ? 'border-emerald-500/50 bg-emerald-500/10 text-foreground' : 'border-border-subtle text-text-sec'}`}
                >
                  JSON view
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" onClick={copyOutput} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pill border border-border-subtle text-[11px] text-text-sec hover:text-foreground">
                {feedback === 'Copied to clipboard' ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />} Copy
              </button>
              <button
                type="button"
                onClick={() => downloadText(`${safeBaseName(file.name)}-exiftool.${mode === 'json' ? 'json' : 'txt'}`, visibleOutput, mode === 'json' ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pill bg-emerald-500 text-black text-[11px] font-semibold hover:bg-emerald-400"
              >
                <Download className="w-3.5 h-3.5" /> Download {mode === 'json' ? 'JSON' : 'TXT'}
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-ter pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={mode === 'json' ? 'Filter JSON lines…' : 'Search every tag or value…'}
              className="w-full rounded-pill border border-border-subtle bg-background px-10 py-2.5 text-[12px] text-foreground placeholder:text-text-ter outline-none focus:ring-2 focus:ring-emerald-500/25"
            />
          </div>
          {feedback && <p role="status" className="text-[11px] text-text-sec">{feedback}</p>}
          <div className="border border-border-subtle rounded-small overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border-subtle bg-black/[0.03] dark:bg-white/[0.03]">
              <span className="text-[11px] font-semibold text-foreground">{mode === 'json' ? 'Full JSON metadata' : 'Full ExifTool output'}</span>
              <span className="text-[10px] text-text-ter">{filteredOutput.split(/\r?\n/).filter(Boolean).length.toLocaleString()} visible lines</span>
            </div>
            <pre className="max-h-[42dvh] min-h-56 overflow-auto whitespace-pre px-4 py-4 text-[11px] leading-relaxed font-mono text-foreground select-text">{filteredOutput || (query ? 'No lines match your search.' : 'No output available.')}</pre>
          </div>
          <p className="text-[10px] leading-relaxed text-text-ter">
            ExifTool reports metadata that the chosen parser can identify in this file. Missing tags may never have been recorded, may have been removed, or may not be readable from a damaged or unsupported structure. Metadata does not prove image authenticity or AI origin.
          </p>
        </>
      )}

      {status === 'idle' && (
        <div className="rounded-small border border-border-subtle border-dashed p-6 text-center">
          <FileJson className="w-7 h-7 mx-auto text-text-ter mb-2" />
          <p className="text-[13px] font-medium text-foreground">Inspect the complete tag output</p>
          <p className="text-[11px] text-text-sec mt-1">This deeper scan includes less common fields and duplicate tags that the quick summary may not show.</p>
        </div>
      )}
    </div>
  );
}
