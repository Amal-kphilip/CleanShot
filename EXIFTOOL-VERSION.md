# ExifTool version selection

The previous patch selected `@uswriting/exiftool`, whose published WASM package embeds ExifTool 13.42. That was a package-selection choice, not a technical restriction.

This patch pins `@lilohuang/exiftool@1.0.10`, whose package documentation identifies the bundled ExifTool as 13.59, and uses the matching `@lilohuang/zeroperl-ts` runtime. The viewer remains browser-local: it passes the selected `File` to `parseMetadata` and fetches `/zeroperl.wasm` from this site's own origin.

After installation, verify the package versions and generated runtime:

```powershell
npm ls @lilohuang/exiftool @lilohuang/zeroperl-ts
Test-Path .\public\zeroperl.wasm
```

The full project test suite and production build must still be run in the target project before deploying.
