import * as exifr from 'exifr';
import { unzipSync } from 'fflate';
import { ParsedMetadata, MetadataField, GpsLocation, ImageFormat } from './types';
import { detectImageFormat } from './magic';

/**
 * Metadata Inspector parser.
 * Extracts every discoverable metadata field, classifies into categories,
 * detects GPS location, and calculates privacy risk ratings.
 */
export async function inspectMetadata(buffer: Uint8Array, filename: string = ''): Promise<ParsedMetadata> {
  const formatInfo = detectImageFormat(buffer, filename);
  const format = formatInfo.format;
  const fields: MetadataField[] = [];
  let gps: GpsLocation | undefined = undefined;

  const categoriesCount = {
    location: 0,
    camera: 0,
    datetime: 0,
    software: 0,
    author: 0,
    technical: 0,
    other: 0,
  };

  let width: number | undefined;
  let height: number | undefined;

  try {
    // Parse comprehensive metadata with exifr
    const parsed = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      icc: true,
      iptc: true,
      jfif: true,
      ihdr: true,
      gps: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    });

    if (parsed) {
      width = parsed.ImageWidth || parsed.ExifImageWidth || parsed.width;
      height = parsed.ImageHeight || parsed.ExifImageHeight || parsed.height;

      // Extract GPS if available
      if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
        gps = {
          latitude: Number(parsed.latitude),
          longitude: Number(parsed.longitude),
          altitude: parsed.GPSAltitude !== undefined ? Number(parsed.GPSAltitude) : undefined,
          mapUrl: `https://www.openstreetmap.org/?mlat=${parsed.latitude}&mlon=${parsed.longitude}#map=15/${parsed.latitude}/${parsed.longitude}`,
        };
      }

      // Categorize fields
      for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || value === null || typeof value === 'function') continue;
        // Skip raw nested objects or binary buffers in simple view
        if (value instanceof Uint8Array || value instanceof ArrayBuffer) continue;

        const stringVal = String(typeof value === 'object' ? JSON.stringify(value) : value);
        if (!stringVal || stringVal === '[object Object]') continue;

        const { category, riskLevel, description } = classifyTag(key, stringVal);

        categoriesCount[category]++;

        fields.push({
          id: key,
          name: formatTagName(key),
          category,
          value: stringVal,
          formattedValue: formatValue(key, value),
          riskLevel,
          description,
        });
      }
    }
  } catch (e) {
    // Fallback if format does not contain standard EXIF
  }

  // If PNG, check for PNG text chunks if none found
  if (format === 'png' && fields.length === 0) {
    extractPngTextChunks(buffer, fields, categoriesCount);
  }

  // If SVG, extract XML comments and metadata tags
  if (format === 'svg') {
    extractSvgMetadata(buffer, fields, categoriesCount);
  }

  // If PDF, extract Document Info dictionary and Trailer ID
  if (format === 'pdf') {
    extractPdfMetadata(buffer, fields, categoriesCount);
  }

  // If DOCX, extract docProps core.xml & app.xml fields
  if (format === 'docx') {
    extractDocxMetadata(buffer, fields, categoriesCount);
  }

  // If MP3 / AAC / WAV, extract ID3v2 / ID3v1 / RIFF INFO tags
  if (format === 'mp3' || format === 'aac' || format === 'wav') {
    extractAudioMetadata(buffer, fields, categoriesCount);
  }

  // If FLAC, extract Vorbis comments
  if (format === 'flac') {
    extractFlacMetadata(buffer, fields, categoriesCount);
  }

  const hasHighRiskFields = fields.some((f) => f.riskLevel === 'high');

  return {
    format,
    mimeType: formatInfo.mimeType,
    fileSize: buffer.length,
    width,
    height,
    fields,
    gps,
    categories: categoriesCount,
    hasHighRiskFields,
    // Raw parser objects can retain large amounts of private EXIF/XMP data and are not
    // consumed by the UI. Keep only the normalized fields needed by the inspector.
    rawSummary: {},
  };
}

function classifyTag(
  key: string,
  value: string
): {
  category: 'location' | 'camera' | 'datetime' | 'software' | 'author' | 'technical' | 'other';
  riskLevel: 'high' | 'medium' | 'low';
  description?: string;
} {
  const k = key.toLowerCase();

  // 0. AI / Content Credentials / C2PA / Prompt Parameters (HIGH RISK)
  const v = value.toLowerCase();
  if (
    k.includes('c2pa') ||
    k.includes('manifest') ||
    k.includes('digitalsourcetype') ||
    k.includes('prompt') ||
    k.includes('parameters') ||
    v.includes('trainedalgorithmicmedia') ||
    v.includes('midjourney') ||
    v.includes('dall-e') ||
    v.includes('stable diffusion') ||
    v.includes('comfyui') ||
    v.includes('firefly') ||
    v.includes('synthetic') ||
    v.includes('c2pa')
  ) {
    return {
      category: 'software',
      riskLevel: 'high',
      description: 'AI generation signature / C2PA Content Credentials detected',
    };
  }

  // 1. Location (HIGH RISK)
  if (
    k.includes('gps') ||
    k.includes('latitude') ||
    k.includes('longitude') ||
    k.includes('altitude') ||
    k.includes('location') ||
    k.includes('city') ||
    k.includes('country') ||
    k.includes('destbearing')
  ) {
    return {
      category: 'location',
      riskLevel: 'high',
      description: 'Reveals exact geographic location where photo was captured',
    };
  }

  // 2. Author / Copyright / Owner (HIGH RISK)
  if (
    k.includes('artist') ||
    k.includes('author') ||
    k.includes('creator') ||
    k.includes('owner') ||
    k.includes('copyright') ||
    k.includes('credit') ||
    k.includes('byline') ||
    k.includes('contact')
  ) {
    return {
      category: 'author',
      riskLevel: 'high',
      description: 'Identifies the photographer, owner or personal identity',
    };
  }

  // 3. Serial Numbers & Identifiers (HIGH RISK)
  if (
    k.includes('serial') ||
    k.includes('bodyserial') ||
    k.includes('lensserial') ||
    k.includes('cameraid') ||
    k.includes('deviceid') ||
    k.includes('uniqueid')
  ) {
    return {
      category: 'camera',
      riskLevel: 'high',
      description: 'Unique device hardware serial number traceable across photos',
    };
  }

  // 4. Camera Hardware & Lens (MEDIUM / LOW RISK)
  if (
    k.includes('make') ||
    k.includes('model') ||
    k.includes('lens') ||
    k.includes('camera') ||
    k.includes('fnumber') ||
    k.includes('focallength') ||
    k.includes('iso') ||
    k.includes('exposure') ||
    k.includes('aperture') ||
    k.includes('flash') ||
    k.includes('shutter')
  ) {
    return {
      category: 'camera',
      riskLevel: 'medium',
      description: 'Camera gear and optical hardware shooting parameters',
    };
  }

  // 5. Date & Time (MEDIUM RISK)
  if (
    k.includes('date') ||
    k.includes('time') ||
    k.includes('subsectime') ||
    k.includes('offsettime') ||
    k.includes('timestamp')
  ) {
    return {
      category: 'datetime',
      riskLevel: 'medium',
      description: 'Exact timestamp when the file was captured or edited',
    };
  }

  // 6. Software & Editing History (MEDIUM / LOW RISK)
  if (
    k.includes('software') ||
    k.includes('processing') ||
    k.includes('hostcomputer') ||
    k.includes('history') ||
    k.includes('photoshop') ||
    k.includes('lightroom') ||
    k.includes('firmware')
  ) {
    return {
      category: 'software',
      riskLevel: 'medium',
      description: 'Editing software, OS environment, and processing history',
    };
  }

  // 7. Technical & Color Profile
  if (
    k.includes('colorspace') ||
    k.includes('profile') ||
    k.includes('icc') ||
    k.includes('width') ||
    k.includes('height') ||
    k.includes('bitspersample') ||
    k.includes('compression') ||
    k.includes('resolution')
  ) {
    return {
      category: 'technical',
      riskLevel: 'low',
      description: 'Image dimensions and color format characteristics',
    };
  }

  return {
    category: 'other',
    riskLevel: 'low',
  };
}

function formatTagName(key: string): string {
  // Convert camelCase or PascalCase to readable title
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValue(key: string, val: any): string {
  if (val instanceof Date) {
    return val.toLocaleString();
  }
  if (typeof val === 'number') {
    if (key.toLowerCase().includes('exposuretime') && val > 0 && val < 1) {
      return `1/${Math.round(1 / val)}s`;
    }
    if (key.toLowerCase().includes('fnumber')) {
      return `ƒ/${val.toFixed(1)}`;
    }
    if (key.toLowerCase().includes('focallength')) {
      return `${val} mm`;
    }
    if (key.toLowerCase().includes('iso')) {
      return `ISO ${val}`;
    }
  }
  return String(val);
}

function extractPngTextChunks(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  let offset = 8;
  while (offset + 8 < buffer.length) {
    const len =
      (buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3];
    const type = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7]
    );

    if (type === 'tEXt' && len > 0 && offset + 8 + len <= buffer.length) {
      const data = buffer.slice(offset + 8, offset + 8 + len);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const key = new TextDecoder().decode(data.slice(0, nullIdx));
        const val = new TextDecoder().decode(data.slice(nullIdx + 1));
        const { category, riskLevel, description } = classifyTag(key, val);
        categoriesCount[category]++;
        fields.push({
          id: `png-${key}`,
          name: key,
          category,
          value: val,
          formattedValue: val,
          riskLevel,
          description,
        });
      }
    }
    offset += 12 + len;
  }
}

function extractSvgMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const commentMatch = text.match(/<!--([\s\S]*?)-->/g);
  if (commentMatch) {
    for (const c of commentMatch) {
      categoriesCount.software++;
      fields.push({
        id: `svg-comment-${fields.length}`,
        name: 'SVG Comment / Generator',
        category: 'software',
        value: c.replace(/<!--|-->/g, '').trim(),
        riskLevel: 'medium',
        description: 'Embedded XML comment in vector file',
      });
    }
  }
}

function extractPdfMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  const text = new TextDecoder('latin1').decode(buffer);
  const infoKeyRegex = /\/(Author|Title|Subject|Keywords|Creator|Producer|CreationDate|ModDate)\s*(\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>)/g;
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = infoKeyRegex.exec(text)) !== null) {
    const key = match[1];
    let rawVal = match[2];
    if (rawVal.startsWith('(') && rawVal.endsWith(')')) {
      rawVal = rawVal.slice(1, -1).replace(/\\([()\\])/g, '$1');
    } else if (rawVal.startsWith('<') && rawVal.endsWith('>')) {
      const hex = rawVal.slice(1, -1).replace(/\s+/g, '');
      const bytes: number[] = [];
      for (let i = 0; i + 1 < hex.length; i += 2) {
        bytes.push(parseInt(hex.slice(i, i + 2), 16));
      }
      if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
        rawVal = new TextDecoder('utf-16be').decode(new Uint8Array(bytes.slice(2)));
      } else {
        rawVal = new TextDecoder('latin1').decode(new Uint8Array(bytes));
      }
    }
    const cleanVal = rawVal.trim();
    if (!cleanVal || seen.has(`${key}:${cleanVal}`)) continue;
    seen.add(`${key}:${cleanVal}`);
    const { category, riskLevel, description } = classifyTag(key, cleanVal);
    categoriesCount[category]++;
    fields.push({
      id: `pdf-${key}-${fields.length}`,
      name: `PDF ${formatTagName(key)}`,
      category,
      value: cleanVal,
      formattedValue: cleanVal,
      riskLevel,
      description,
    });
  }

  const idMatch = text.match(/\/ID\s*\[\s*<([0-9A-Fa-f\s]+)>\s*<([0-9A-Fa-f\s]+)>\s*\]/);
  if (idMatch) {
    const idVal = idMatch[1].replace(/\s+/g, '');
    if (idVal) {
      categoriesCount.author++;
      fields.push({
        id: 'pdf-trailer-id',
        name: 'PDF Trailer Document ID',
        category: 'author',
        value: idVal,
        formattedValue: idVal,
        riskLevel: 'high',
        description: 'Persistent document fingerprint linking edited copies back to the original',
      });
    }
  }
}

function extractDocxMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  try {
    const entries = unzipSync(buffer);
    const decoder = new TextDecoder('utf-8');
    const xmlFiles = ['docProps/core.xml', 'docProps/app.xml', 'docProps/custom.xml'];
    for (const path of xmlFiles) {
      const data = entries[path];
      if (!data) continue;
      const xml = decoder.decode(data);
      const tagRegex = /<([A-Za-z0-9_:-]+)>([^<]+)<\/\1>/g;
      let match: RegExpExecArray | null;
      while ((match = tagRegex.exec(xml)) !== null) {
        const rawTag = match[1].includes(':') ? match[1].split(':')[1] : match[1];
        const val = match[2].trim();
        if (!val) continue;
        const { category, riskLevel, description } = classifyTag(rawTag, val);
        categoriesCount[category]++;
        fields.push({
          id: `docx-${rawTag}-${fields.length}`,
          name: `DOCX ${formatTagName(rawTag)}`,
          category,
          value: val,
          formattedValue: val,
          riskLevel,
          description,
        });
      }
    }
  } catch {
    // Ignore malformed zip during quick preview
  }
}

function extractAudioMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  // Check leading ID3v2 header
  if (buffer.length >= 10 && buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    const version = `ID3v2.${buffer[3]}.${buffer[4]}`;
    const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
    if (size > 0) {
      categoriesCount.author++;
      fields.push({
        id: 'audio-id3v2',
        name: 'ID3v2 Metadata Container',
        category: 'author',
        value: `${version} (${size} bytes)`,
        formattedValue: `${version} (${size} bytes)`,
        riskLevel: 'medium',
        description: 'Embedded ID3v2 tag container in audio stream',
      });
    }
  }
  // Check trailing ID3v1 ("TAG" at length - 128)
  if (buffer.length >= 128) {
    const start = buffer.length - 128;
    if (buffer[start] === 0x54 && buffer[start + 1] === 0x41 && buffer[start + 2] === 0x47) {
      const dec = new TextDecoder('latin1');
      const title = dec.decode(buffer.subarray(start + 3, start + 33)).replace(/\0+$/, '').trim();
      const artist = dec.decode(buffer.subarray(start + 33, start + 63)).replace(/\0+$/, '').trim();
      if (title) {
        categoriesCount.other++;
        fields.push({ id: 'id3v1-title', name: 'ID3v1 Title', category: 'other', value: title, riskLevel: 'low' });
      }
      if (artist) {
        categoriesCount.author++;
        fields.push({ id: 'id3v1-artist', name: 'ID3v1 Artist', category: 'author', value: artist, riskLevel: 'high' });
      }
    }
  }
}

function extractFlacMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  if (buffer.length < 8 || String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]) !== 'fLaC') return;
  let offset = 4;
  while (offset + 4 <= buffer.length) {
    const header = buffer[offset];
    const isLast = (header & 0x80) !== 0;
    const type = header & 0x7f;
    const length = (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3];
    const end = offset + 4 + length;
    if (end > buffer.length) break;
    if (type === 4) {
      categoriesCount.author++;
      fields.push({
        id: `flac-vorbis-${offset}`,
        name: 'FLAC Vorbis Comments',
        category: 'author',
        value: `${length} bytes`,
        riskLevel: 'high',
        description: 'Vorbis comment metadata block in FLAC container',
      });
    } else if (type === 6) {
      categoriesCount.other++;
      fields.push({
        id: `flac-picture-${offset}`,
        name: 'FLAC Embedded Picture',
        category: 'other',
        value: `${length} bytes`,
        riskLevel: 'medium',
        description: 'Embedded cover art / picture metadata block',
      });
    }
    offset = end;
    if (isLast) break;
  }
}
