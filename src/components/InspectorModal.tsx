'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  X, MapPin, Camera, Calendar, Code, User, Sliders, AlertTriangle,
  Search, ExternalLink, ShieldAlert, CheckCircle2, Layers, Info,
} from 'lucide-react';
import { ParsedMetadata } from '@/lib/engine/types';
import { useDialogAccessibility } from '@/lib/ui/useDialogAccessibility';

interface InspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata?: ParsedMetadata;
  cleanedMetadata?: ParsedMetadata;
  isProcessed?: boolean;
  processingError?: string;
  filename: string;
  thumbnailUrl?: string;
}

export function InspectorModal({
  isOpen,
  onClose,
  metadata,
  cleanedMetadata,
  isProcessed = false,
  processingError,
  filename,
  thumbnailUrl,
}: InspectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(isOpen && Boolean(metadata), onClose, dialogRef);

  useEffect(() => {
    if (!isProcessed || !cleanedMetadata) setActiveTab('before');
  }, [isProcessed, cleanedMetadata, filename]);

  useEffect(() => {
    setSelectedCategory('all');
    setSearchQuery('');
  }, [filename]);

  if (!isOpen || !metadata) return null;

  const showingAfter = activeTab === 'after' && isProcessed && Boolean(cleanedMetadata);
  const displayMetadata = showingAfter && cleanedMetadata ? cleanedMetadata : metadata;
  const filteredFields = displayMetadata.fields.filter((field) => {
    const matchesCat = selectedCategory === 'all' || field.category === selectedCategory;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      field.name.toLowerCase().includes(query) ||
      String(field.value).toLowerCase().includes(query) ||
      Boolean(field.description?.toLowerCase().includes(query));
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All', count: displayMetadata.fields.length, icon: Layers },
    { id: 'location', label: 'Location', count: displayMetadata.categories.location, icon: MapPin },
    { id: 'camera', label: 'Camera', count: displayMetadata.categories.camera, icon: Camera },
    { id: 'datetime', label: 'Date', count: displayMetadata.categories.datetime, icon: Calendar },
    { id: 'author', label: 'Author', count: displayMetadata.categories.author, icon: User },
    { id: 'software', label: 'Software', count: displayMetadata.categories.software, icon: Code },
    { id: 'technical', label: 'Technical', count: displayMetadata.categories.technical, icon: Sliders },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="inspector-dialog-title" tabIndex={-1} className="relative w-full sm:max-w-4xl liquid-glass sm:rounded-card rounded-t-card shadow-floating border border-border-subtle flex flex-col max-h-[94dvh] overflow-hidden animate-slide-up">
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-border-subtle">
          {thumbnailUrl && <img src={thumbnailUrl} alt="" className="w-10 h-10 rounded-small object-cover border border-border-subtle shrink-0" />}
          <div className="min-w-0 flex-1">
            <h3 id="inspector-dialog-title" className="text-[15px] font-semibold tracking-heading text-foreground truncate">{filename}</h3>
            <p className="text-[12px] text-text-ter">{metadata.format.toUpperCase()} · {displayMetadata.fields.length} fields detected {showingAfter ? 'after cleaning' : 'in original'}</p>
          </div>
          {displayMetadata.hasHighRiskFields && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-pill bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" /><span>High-Risk Fields</span>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-full text-text-ter hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors shrink-0" aria-label="Close inspector">
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-5 sm:px-6 py-2.5 border-b border-border-subtle flex items-center gap-2 bg-black/[0.02] dark:bg-white/[0.02]">
          <button type="button" onClick={() => setActiveTab('before')} aria-pressed={!showingAfter} className={`px-3.5 py-1.5 text-[12px] font-medium rounded-pill transition-all ${!showingAfter ? 'liquid-glass text-foreground font-semibold shadow-xs' : 'text-text-sec hover:text-foreground'}`}>
            Original
          </button>
          <button type="button" onClick={() => setActiveTab('after')} disabled={!isProcessed || !cleanedMetadata} aria-pressed={showingAfter} className={`px-3.5 py-1.5 text-[12px] font-medium rounded-pill transition-all disabled:opacity-40 disabled:cursor-not-allowed ${showingAfter ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-text-sec hover:text-foreground'}`}>
            After Cleaning
          </button>
        </div>

        {processingError && !isProcessed && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-small bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-800 dark:text-amber-300" role="status">
            A cleaned output is not available for this file: {processingError}
          </div>
        )}
        {showingAfter && (
          <div className="px-5 sm:px-6 pt-4">
            {displayMetadata.fields.length === 0 ? (
              <div className="p-3.5 rounded-small bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <div><p className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-300">No fields detected by the inspector</p><p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">This is a parser-based check of the cleaned output, not a guarantee that every possible private data block has been removed.</p></div>
              </div>
            ) : (
              <div className="p-3.5 rounded-small bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div><p className="text-[12px] font-semibold text-amber-900 dark:text-amber-300">{displayMetadata.fields.length} metadata field{displayMetadata.fields.length === 1 ? '' : 's'} still detected</p><p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">Review the remaining fields below. Some technical or color-related information may be retained to preserve how the image renders.</p></div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
          <div className="w-full sm:w-48 border-b sm:border-b-0 sm:border-r border-border-subtle p-2.5 flex sm:flex-col flex-row gap-1 overflow-x-auto sm:overflow-y-auto shrink-0">
            {categories.map((category) => {
              const Icon = category.icon;
              const selected = selectedCategory === category.id;
              return (
                <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} aria-pressed={selected} className={`flex-shrink-0 sm:flex-shrink flex items-center gap-2 px-3 py-2 rounded-pill text-[12px] font-medium transition-colors w-auto sm:w-full text-left justify-between ${selected ? 'bg-black/[0.06] dark:bg-white/[0.09] text-foreground font-semibold' : 'text-text-sec hover:bg-black/[0.03] dark:hover:bg-white/[0.04] hover:text-foreground'}`}>
                  <span className="flex items-center gap-2 min-w-0"><Icon className="w-3.5 h-3.5 shrink-0 text-text-ter" /><span className="truncate">{category.label}</span></span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-pill ml-auto shrink-0 ${selected ? 'bg-black/[0.08] dark:bg-white/[0.12] text-foreground' : 'bg-black/[0.03] dark:bg-white/[0.05] text-text-ter'}`}>{category.count}</span>
                </button>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {displayMetadata.gps && (
              <div className="m-4 mb-0 p-3.5 rounded-small bg-amber-500/10 border border-amber-500/20 flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-start gap-2.5"><MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" /><div><p className="text-[12px] font-semibold text-amber-900 dark:text-amber-300 mb-0.5">Exact GPS Location {showingAfter ? 'Still Detected' : 'Exposed'}</p><p className="text-[11px] text-amber-700 dark:text-amber-400"><code className="font-mono">{displayMetadata.gps.latitude.toFixed(6)}, {displayMetadata.gps.longitude.toFixed(6)}</code>{displayMetadata.gps.altitude != null ? ` · ${displayMetadata.gps.altitude.toFixed(1)}m` : ''}</p></div></div>
                {displayMetadata.gps.mapUrl && <a href={displayMetadata.gps.mapUrl} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0">Map <ExternalLink className="w-3 h-3" /></a>}
              </div>
            )}

            <div className="m-4 mb-2 relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-ter pointer-events-none" />
              <input type="text" aria-label="Search metadata fields" placeholder="Search fields or values…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full pl-9 pr-4 py-2 text-[12px] rounded-pill liquid-glass border border-border-subtle text-foreground placeholder:text-text-ter focus:outline-none focus:ring-2 focus:ring-accent/30 transition" />
            </div>

            <div className="flex-1 overflow-y-auto mx-4 mb-4 rounded-card border border-border-subtle divide-y divide-border-subtle">
              {filteredFields.length === 0 ? <div className="p-8 text-center text-[13px] text-text-ter">No fields match your search.</div> : filteredFields.map((field) => (
                <div key={field.id} className="inspector-field-row flex items-start justify-between gap-4 px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0"><div className="flex items-center gap-1.5 mb-0.5 flex-wrap"><span className="text-[13px] font-semibold text-foreground">{field.name}</span>{field.riskLevel === 'high' && <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-pill bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"><AlertTriangle className="w-2.5 h-2.5" />High risk</span>}</div>{field.description && <p className="text-[11px] text-text-ter leading-relaxed">{field.description}</p>}</div>
                  <div className="inspector-field-value text-right shrink-0 max-w-[160px] sm:max-w-[220px]"><span className="text-[12px] font-mono text-foreground break-all select-all">{field.formattedValue || String(field.value)}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-3.5 border-t border-border-subtle flex items-center justify-between" style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}>
          <span className="text-[12px] text-text-ter">{displayMetadata.fields.length} fields in {showingAfter ? 'cleaned output' : 'original'}</span>
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-semibold rounded-pill liquid-glass hover:bg-glass-hover text-foreground apple-spring apple-press">Close</button>
        </div>
      </div>
    </div>
  );
}
