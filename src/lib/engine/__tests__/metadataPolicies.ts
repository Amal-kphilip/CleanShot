/**
 * Portions Copyright (c) 2026 DScaife (MIT License)
 * See THIRD_PARTY_NOTICES.md for full license text.
 */

export const supportedExtensions = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
  'docx',
  'mp4',
  'mov',
  'webm',
  'mkv',
  'mp3',
  'aac',
  'flac',
  'wav',
  'm4a',
] as const;

export type SupportedExtension = (typeof supportedExtensions)[number];

export type FixtureOverrides = {
  requiredBefore?: string[];
  forbiddenAfter?: string[];
  preserveTags?: string[];
  sentinels?: string[];
  notes?: string;
};

export type FormatPolicy = {
  forbiddenAfter: string[];
  preserveTags: string[];
  optionalPreserveTags?: string[];
  browserProbe: 'image' | 'video' | 'audio' | 'none';
};

const commonForbidden = [
  '*GPS*',
  '*Location*',
  '*:Author',
  '*:Artist',
  '*:Creator',
  '*:Producer',
  '*:Title',
  '*:Subject',
  '*:Keywords',
  '*:Comment',
  '*:Copyright',
  '*:Software',
  '*:Make',
  '*:Model',
  '*LensModel*',
  '*SerialNumber*',
  '*OwnerName*',
  '*SegmentIdentifier*',
  '*ProductName*',
  '*ProductVersion*',
  '*ProductBuildVersion*',
  '*DetectedFace*',
  '*LivePhotoInfo*',
  '*SceneIlluminance*',
  '*CinematicAudio*',
  '*WritingApp*',
  '*MuxingApp*',
  '*TrackName*',
  '*:Encoder',
  'XMP:*',
];

const mp3Forbidden = commonForbidden.filter((pattern) => pattern !== '*:Encoder');

const imagePreserve = ['FileType', 'ImageWidth', 'ImageHeight'];
const videoPreserve = ['FileType', 'Duration', 'ImageSize', 'VideoFrameRate'];
const videoOptionalPreserve = ['CompressorID', 'Rotation'];
const audioPreserve = ['FileType', 'Duration', 'AudioSampleRate', 'AudioChannels'];

const imagePolicy: FormatPolicy = {
  forbiddenAfter: [
    ...commonForbidden,
    'EXIF:*',
    'IPTC:*',
    'Photoshop:*',
    '*:UserComment',
  ],
  preserveTags: imagePreserve,
  browserProbe: 'image',
};

const policies: Record<SupportedExtension, FormatPolicy> = {
  jpg: imagePolicy,
  jpeg: imagePolicy,
  png: imagePolicy,
  webp: imagePolicy,
  gif: {
    forbiddenAfter: [...commonForbidden, 'GIF:Comment', '*:CommentExtension'],
    preserveTags: imagePreserve,
    optionalPreserveTags: ['FrameCount', 'AnimationIterations'],
    browserProbe: 'image',
  },
  pdf: {
    forbiddenAfter: [
      ...commonForbidden,
      'PDF:ID',
      'PDF:Subject',
      'PDF:Creator',
      'PDF:Producer',
      'PDF:Keywords',
    ],
    preserveTags: ['FileType', 'PageCount'],
    browserProbe: 'none',
  },
  docx: {
    forbiddenAfter: [
      ...commonForbidden,
      '*:LastModifiedBy',
      '*:Revision',
      '*:Template',
      '*:Manager',
      '*:Company',
    ],
    preserveTags: ['FileType'],
    browserProbe: 'none',
  },
  mp4: {
    forbiddenAfter: commonForbidden,
    preserveTags: videoPreserve,
    optionalPreserveTags: videoOptionalPreserve,
    browserProbe: 'video',
  },
  mov: {
    forbiddenAfter: commonForbidden,
    preserveTags: videoPreserve,
    optionalPreserveTags: videoOptionalPreserve,
    browserProbe: 'video',
  },
  webm: {
    forbiddenAfter: commonForbidden,
    preserveTags: ['FileType', 'ImageSize'],
    optionalPreserveTags: ['Duration', 'VideoFrameRate', ...videoOptionalPreserve],
    browserProbe: 'video',
  },
  mkv: {
    forbiddenAfter: [...commonForbidden, '*:AttachedFile*', '*:ChapterString'],
    preserveTags: videoPreserve,
    optionalPreserveTags: videoOptionalPreserve,
    browserProbe: 'video',
  },
  mp3: {
    forbiddenAfter: [...mp3Forbidden, 'ID3:*', 'ID3v1:*', 'ID3v2:*', 'APE:*'],
    preserveTags: ['FileType', 'Duration', 'AudioSampleRate'],
    optionalPreserveTags: ['AudioChannels'],
    browserProbe: 'audio',
  },
  aac: {
    forbiddenAfter: [...commonForbidden, 'ID3:*', 'ID3v2:*', 'APE:*'],
    preserveTags: ['FileType'],
    optionalPreserveTags: ['Duration', 'AudioSampleRate', 'AudioChannels'],
    browserProbe: 'audio',
  },
  flac: {
    forbiddenAfter: [...commonForbidden, 'Vorbis:*', '*:Picture*'],
    preserveTags: audioPreserve,
    browserProbe: 'audio',
  },
  wav: {
    forbiddenAfter: [
      ...commonForbidden,
      'RIFF:Comment',
      'RIFF:Artist',
      'RIFF:Product',
      'ID3:*',
      'ID3v2:*',
    ],
    preserveTags: audioPreserve,
    browserProbe: 'audio',
  },
  m4a: {
    forbiddenAfter: commonForbidden,
    preserveTags: audioPreserve,
    browserProbe: 'audio',
  },
};

export function getPolicy(extension: SupportedExtension): FormatPolicy {
  return policies[extension];
}

export function isSupportedExtension(value: string): value is SupportedExtension {
  return supportedExtensions.includes(value as SupportedExtension);
}

export function classifyExifValidationSummary(
  text: string,
): 'ok' | 'warning' | 'error' {
  if (text.trim().toUpperCase() === 'OK') return 'ok';
  if (/^\d+\s+warnings?$/i.test(text.trim())) return 'warning';
  return 'error';
}

function durationInSeconds(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const match = value.trim().match(/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function technicalValuesEqual(
  before: unknown,
  after: unknown,
  tag: string,
  extension: SupportedExtension,
): boolean {
  if (tag === 'FileType') {
    if (
      extension === 'webp' &&
      [before, after].every(
        (value) => value === 'WEBP' || value === 'Extended WEBP',
      )
    ) {
      return true;
    }
    if (extension === 'aac' && before === 'MP3' && after === 'AAC') return true;
  }

  if (tag === 'Duration') {
    const beforeSeconds = durationInSeconds(before);
    const afterSeconds = durationInSeconds(after);
    if (beforeSeconds !== null && afterSeconds !== null) {
      return Math.abs(beforeSeconds - afterSeconds) <= 0.02;
    }
  }

  if (typeof before === 'number' && typeof after === 'number') {
    const tolerance = tag === 'VideoFrameRate' ? 0.001 : 0;
    return Math.abs(before - after) <= tolerance;
  }
  return JSON.stringify(before) === JSON.stringify(after);
}

function wildcardRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

function tagMatches(tag: string, pattern: string): boolean {
  const regex = wildcardRegex(pattern);
  const baseTag = tag.split(':').at(-1) ?? tag;
  return regex.test(tag) || regex.test(baseTag);
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') {
    return Object.values(value).some(hasMeaningfulValue);
  }
  if (typeof value !== 'string') return true;
  const trimmed = value.trim();
  return trimmed !== '' && !/^0{4}:0{2}:0{2} 0{2}:0{2}:0{2}/.test(trimmed);
}

export function matchingTags(
  snapshot: Record<string, unknown>,
  patterns: string[],
): string[] {
  return Object.entries(snapshot)
    .filter(
      ([tag, value]) =>
        hasMeaningfulValue(value) &&
        patterns.some((pattern) => tagMatches(tag, pattern)),
    )
    .map(([tag]) => tag)
    .sort();
}

export function findTechnicalValue(
  snapshot: Record<string, unknown>,
  tag: string,
): unknown {
  const aliases: Record<string, string[]> = {
    AudioSampleRate: ['AudioSampleRate', 'SampleRate'],
    AudioChannels: ['AudioChannels', 'Channels', 'NumChannels'],
  };
  for (const candidate of aliases[tag] ?? [tag]) {
    const exact = snapshot[candidate];
    if (exact !== undefined) return exact;
    const grouped = Object.entries(snapshot).find(
      ([key]) => key.split(':').at(-1) === candidate,
    )?.[1];
    if (grouped !== undefined) return grouped;
  }
  return undefined;
}
