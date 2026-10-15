import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function edit(relativePath, operation) {
  const filePath = path.join(root, relativePath);
  const before = await readFile(filePath, 'utf8');
  const newline = before.includes('\r\n') ? '\r\n' : '\n';
  const normalizedBefore = before.replace(/\r\n/g, '\n');
  const normalizedAfter = operation(normalizedBefore);
  const after = newline === '\n' ? normalizedAfter : normalizedAfter.replace(/\n/g, '\r\n');
  if (after !== before) {
    await writeFile(filePath, after, 'utf8');
    console.log(`Updated ${relativePath}`);
  } else {
    console.log(`No change needed in ${relativePath}`);
  }
}

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) {
    throw new Error(`Could not find expected code in ${label}; no change was made to that file.`);
  }
  return source.replace(needle, replacement);
}

function addExifToolTab(source) {
  if (source.includes('Full ExifTool Scan') && source.includes("onClick={() => setActiveTab('exiftool')}")) return source;

  const afterClick = "onClick={() => setActiveTab('after')}";
  const clickIndex = source.indexOf(afterClick);
  if (clickIndex < 0) {
    throw new Error('Could not locate the After Cleaning tab in InspectorModal.tsx.');
  }
  const buttonStart = source.lastIndexOf('<button', clickIndex);
  if (buttonStart < 0) throw new Error('Could not locate the After Cleaning button element.');
  const lineStart = source.lastIndexOf('\n', buttonStart) + 1;
  const indent = source.slice(lineStart, buttonStart);
  const tab = `${indent}<button\n${indent}  type="button"\n${indent}  onClick={() => setActiveTab('exiftool')}\n${indent}  aria-pressed={activeTab === 'exiftool'}\n${indent}  className={\`px-3.5 py-1.5 text-[12px] font-medium rounded-pill transition-all ${'${'}activeTab === 'exiftool' ? 'bg-emerald-500/15 border border-emerald-500/30 text-foreground font-semibold' : 'text-text-sec hover:text-foreground'${'}'}\`}\n${indent}>\n${indent}  Full ExifTool Scan\n${indent}</button>\n`;
  return source.slice(0, lineStart) + tab + source.slice(lineStart);
}

function addFullScanContent(source) {
  if (source.includes('<ExifToolFullScan file={file} />')) return source;

  // Current dark/mobile InspectorModal variant uses `showingAfter` and a processingError block.
  if (source.includes('const showingAfter = activeTab ===') && source.includes('        {processingError && !isProcessed && (')) {
    source = replaceOnce(
      source,
      '        {processingError && !isProcessed && (',
      `        {activeTab === 'exiftool' ? (\n          <ExifToolFullScan file={file} />\n        ) : (\n          <>\n        {processingError && !isProcessed && (`,
      'InspectorModal.tsx (full ExifTool tab opening)'
    );
    const footerAnchor = '        <div className="px-5 sm:px-6 py-3.5 border-t border-border-subtle';
    source = replaceOnce(
      source,
      footerAnchor,
      `          </>\n        )}\n\n${footerAnchor}`,
      'InspectorModal.tsx (full ExifTool tab closing)'
    );
    return source;
  }

  // Original InspectorModal variant.
  if (source.includes('        {/* Content */}') && source.includes('        {/* Footer */}')) {
    source = replaceOnce(
      source,
      '        {/* Content */}',
      `        {activeTab === 'exiftool' ? (\n          <ExifToolFullScan file={file} />\n        ) : (\n          <>\n        {/* Content */}`,
      'InspectorModal.tsx (full ExifTool tab opening)'
    );
    source = replaceOnce(
      source,
      '        {/* Footer */}',
      `          </>\n        )}\n\n        {/* Footer */}`,
      'InspectorModal.tsx (full ExifTool tab closing)'
    );
    return source;
  }

  throw new Error('Unrecognized InspectorModal content layout. No content-mode changes were applied.');
}

await edit('src/components/InspectorModal.tsx', (source) => {
  let next = source;

  if (!next.includes("from '@/components/ExifToolFullScan'")) {
    const typesImport = next.match(/^import\s+\{[^\n]*ParsedMetadata[^\n]*\}\s+from\s+'@\/lib\/engine\/types';$/m);
    if (!typesImport) throw new Error('Could not find the metadata types import in InspectorModal.tsx.');
    next = next.replace(typesImport[0], `${typesImport[0]}\nimport { ExifToolFullScan } from '@/components/ExifToolFullScan';`);
  }

  if (!next.includes('  file?: File;')) {
    next = replaceOnce(next, '  filename: string;\n  thumbnailUrl?: string;', '  filename: string;\n  file?: File;\n  thumbnailUrl?: string;', 'InspectorModal.tsx (props)');
  }

  if (!/\n\s+file,\n\s+thumbnailUrl,/.test(next)) {
    next = replaceOnce(next, '  filename,\n  thumbnailUrl,', '  filename,\n  file,\n  thumbnailUrl,', 'InspectorModal.tsx (destructuring)');
  }

  if (!next.includes("useState<'before' | 'after' | 'exiftool'>")) {
    next = next.replace(/useState<'before'\s*\|\s*'after'>\('before'\)/, "useState<'before' | 'after' | 'exiftool'>('before')");
    if (!next.includes("useState<'before' | 'after' | 'exiftool'>")) {
      throw new Error('Could not locate InspectorModal active tab state.');
    }
  }

  next = addExifToolTab(next);
  next = next.replace(
    'py-2.5 border-b border-border-subtle flex items-center gap-2 bg-black/[0.02] dark:bg-white/[0.02]',
    'py-2.5 border-b border-border-subtle flex items-center gap-2 flex-wrap bg-black/[0.02] dark:bg-white/[0.02]'
  );

  // The mobile variant used the Original tab's !showingAfter expression, which incorrectly highlights it during the new scan tab.
  next = next.replace('aria-pressed={!showingAfter}', "aria-pressed={activeTab === 'before'}");
  next = next.replace("${!showingAfter ? 'liquid-glass text-foreground font-semibold shadow-xs'", "${activeTab === 'before' ? 'liquid-glass text-foreground font-semibold shadow-xs'");
  next = next.replace(
    "{displayMetadata.fields.length} fields in {showingAfter ? 'cleaned output' : 'original'}",
    "{activeTab === 'exiftool' ? 'Full ExifTool scan' : `${displayMetadata.fields.length} fields in ${showingAfter ? 'cleaned output' : 'original'}`}"
  );
  next = addFullScanContent(next);
  return next;
});

function addPropToInspectorModal(source, prop, label) {
  // Be resilient to formatting and line-ending differences between project revisions.
  const start = source.indexOf('<InspectorModal');
  if (start < 0) throw new Error(`Could not find <InspectorModal in ${label}.`);
  const end = source.indexOf('/>', start);
  if (end < 0) throw new Error(`Could not find the closing /> for InspectorModal in ${label}.`);
  const tag = source.slice(start, end + 2);
  if (/\bfile\s*=/.test(tag)) return source;
  const insertion = `\n          ${prop}\n        `;
  return source.slice(0, end) + insertion + source.slice(end);
}

await edit('src/app/page.tsx', (source) => {
  if (source.includes('file={inspectItem?.file}')) return source;
  if (!source.includes('inspectItem')) {
    throw new Error('Could not identify the selected inspection item in src/app/page.tsx. No change was made to that file.');
  }
  return addPropToInspectorModal(source, 'file={inspectItem?.file}', 'src/app/page.tsx');
});

await edit('src/app/inspector/page.tsx', (source) => {
  if (source.includes('file={file ?? undefined}') || /<InspectorModal\b[\s\S]*?file=\{file(?:\s*\?\?\s*undefined)?\}/.test(source)) return source;
  return addPropToInspectorModal(source, 'file={file ?? undefined}', 'src/app/inspector/page.tsx');
});

console.log('Full ExifTool scan UI is wired into both inspector entry points.');
