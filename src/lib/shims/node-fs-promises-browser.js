/**
 * Browser-only replacement for node:fs/promises used by zeroperl-ts's
 * Node.js fallback. The browser execution path loads the WASM through fetch
 * and must never call this function. Keeping a loud guard prevents accidental
 * use of the Node-only path in a browser bundle.
 */
export async function readFile() {
  throw new Error(
    'The Node.js filesystem API is unavailable in the browser runtime. ' +
      'Use the browser ExifTool path, which loads zeroperl.wasm over fetch.'
  );
}
