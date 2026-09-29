'use client';

import React, { useState } from 'react';
import {
  X,
  MapPin,
  Camera,
  Calendar,
  Code,
  User,
  Sliders,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { ParsedMetadata, MetadataField, MetadataCategory } from '@/lib/engine/types';

interface InspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata?: ParsedMetadata;
  filename: string;
  thumbnailUrl?: string;
}

const riskColors: Record<string, string> = {
  high:   'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-100 dark:border-red-900/50',
  medium: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/50',
  low:    'bg-n-50 dark:bg-white/[0.03] text-n-500 dark:text-n-400 border-n-100 dark:border-white/[0.05]',
};

export function InspectorModal({
  isOpen,
  onClose,
  metadata,
  filename,
  thumbnailUrl,
}: InspectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');

  if (!isOpen || !metadata) return null;

  const filteredFields = metadata.fields.filter((field) => {
    const matchesCat = selectedCategory === 'all' || field.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(field.value).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (field.description && field.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all',       label: 'All',       count: metadata.fields.length,         icon: Layers },
    { id: 'location',  label: 'Location',  count: metadata.categories.location,   icon: MapPin },
    { id: 'camera',    label: 'Camera',    count: metadata.categories.camera,     icon: Camera },
    { id: 'datetime',  label: 'Date',      count: metadata.categories.datetime,   icon: Calendar },
    { id: 'author',    label: 'Author',    count: metadata.categories.author,     icon: User },
    { id: 'software',  label: 'Software',  count: metadata.categories.software,   icon: Code },
    { id: 'technical', label: 'Technical', count: metadata.categories.technical,  icon: Sliders },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-4xl bg-white dark:bg-n-900 sm:rounded-2xl rounded-t-2xl shadow-2xl border-t sm:border border-n-200 dark:border-white/[0.08] flex flex-col max-h-[94dvh] overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 sm:px-6 py-4 border-b border-n-100 dark:border-white/[0.07]">
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt={filename}
              className="w-9 h-9 rounded-xl object-cover border border-n-200 dark:border-white/[0.08] shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[14px] font-semibold text-n-900 dark:text-white truncate">
              {filename}
            </h3>
            <p className="text-[11px] text-n-400 dark:text-n-500">
              {metadata.format.toUpperCase()} · {metadata.fields.length} fields detected
            </p>
          </div>
          {metadata.hasHighRiskFields && (
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50 shrink-0">
              <ShieldAlert className="w-3.5 h-3.5" />
              High-Risk Fields
            </div>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.07] transition-colors shrink-0"
            aria-label="Close"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-n-100 dark:border-white/[0.07] flex items-center gap-1.5 bg-n-50 dark:bg-white/[0.015]">
          <button
            onClick={() => setActiveTab('before')}
            className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              activeTab === 'before'
                ? 'bg-white dark:bg-n-800 text-n-900 dark:text-white shadow-sm border border-n-200 dark:border-white/[0.09]'
                : 'text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white'
            }`}
          >
            Original (With Metadata)
          </button>
          <button
            onClick={() => setActiveTab('after')}
            className={`px-3.5 py-1.5 text-[12px] font-medium rounded-lg transition-all ${
              activeTab === 'after'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white'
            }`}
          >
            After Cleaning
          </button>
        </div>

        {/* Content */}
        {activeTab === 'after' ? (
          <div className="p-10 flex flex-col items-center justify-center text-center space-y-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" strokeWidth={1.75} />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <h4 className="text-[17px] font-semibold text-n-900 dark:text-white">
                All {metadata.fields.length} fields stripped
              </h4>
              <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed">
                GPS coordinates, device serials, timestamps, and software signatures are wiped from the byte stream. Zero pixels re-compressed.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Pixel-identical · DCT data intact
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col sm:flex-row min-h-0 overflow-hidden">
            {/* Category sidebar */}
            <div className="w-full sm:w-44 border-b sm:border-b-0 sm:border-r border-n-100 dark:border-white/[0.07] p-2 flex sm:flex-col flex-row gap-1 overflow-x-auto sm:overflow-y-auto shrink-0">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`flex-shrink-0 sm:flex-shrink flex items-center gap-2 px-2.5 py-2 rounded-lg text-[12px] font-medium transition-colors w-auto sm:w-full text-left justify-between ${
                      isSelected
                        ? 'bg-n-100 dark:bg-white/[0.08] text-n-900 dark:text-white'
                        : 'text-n-500 dark:text-n-400 hover:bg-n-50 dark:hover:bg-white/[0.04] hover:text-n-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{cat.label}</span>
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ml-auto shrink-0 ${
                      isSelected ? 'bg-n-200 dark:bg-white/[0.12] text-n-700 dark:text-n-300' : 'bg-n-100 dark:bg-white/[0.05] text-n-400 dark:text-n-500'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fields panel */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* GPS warning */}
              {metadata.gps && (
                <div className="m-4 mb-0 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 flex items-start justify-between gap-3 shrink-0">
                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[12px] font-semibold text-amber-900 dark:text-amber-300 mb-0.5">
                        Exact GPS Location Exposed
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        <code className="font-mono">{metadata.gps.latitude.toFixed(6)}, {metadata.gps.longitude.toFixed(6)}</code>
                        {metadata.gps.altitude ? ` · ${metadata.gps.altitude.toFixed(1)}m` : ''}
                      </p>
                    </div>
                  </div>
                  {metadata.gps.mapUrl && (
                    <a
                      href={metadata.gps.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-medium text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      Map <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Search */}
              <div className="m-4 mb-2 relative shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-n-400 dark:text-n-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search fields or values…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-[12px] rounded-xl bg-n-50 dark:bg-white/[0.04] border border-n-200 dark:border-white/[0.08] text-n-900 dark:text-white placeholder:text-n-300 dark:placeholder:text-n-600 focus:outline-none focus:ring-2 focus:ring-accent/30 transition"
                />
              </div>

              {/* Fields table */}
              <div className="flex-1 overflow-y-auto mx-4 mb-4 rounded-xl border border-n-100 dark:border-white/[0.07] divide-y divide-n-50 dark:divide-white/[0.04]">
                {filteredFields.length === 0 ? (
                  <div className="p-8 text-center text-[13px] text-n-400 dark:text-n-500">
                    No fields match your search.
                  </div>
                ) : (
                  filteredFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-n-50 dark:hover:bg-white/[0.025] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-[12px] font-semibold text-n-900 dark:text-white">
                            {field.name}
                          </span>
                          {field.riskLevel === 'high' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border border-red-100 dark:border-red-900/50">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              High risk
                            </span>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-[11px] text-n-400 dark:text-n-500 leading-relaxed">
                            {field.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0 max-w-[160px] sm:max-w-[220px]">
                        <span className="text-[12px] font-mono text-n-700 dark:text-n-300 break-all select-all">
                          {field.formattedValue || String(field.value)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="px-5 sm:px-6 py-3.5 border-t border-n-100 dark:border-white/[0.07] flex items-center justify-between"
          style={{ paddingBottom: 'max(0.875rem, env(safe-area-inset-bottom))' }}
        >
          <span className="text-[11px] text-n-400 dark:text-n-500">
            {metadata.fields.length} fields total
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-[12px] font-semibold rounded-xl bg-n-100 dark:bg-white/[0.07] hover:bg-n-200 dark:hover:bg-white/[0.12] text-n-700 dark:text-n-300 border border-n-200 dark:border-white/[0.08] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
