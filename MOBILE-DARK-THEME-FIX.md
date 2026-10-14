StripMeta Mobile Layout + Dark-Only Theme Patch

This patch contains UI-only files. Archive paths start at the project root (src/...), so extracting it directly into C:\My Projects\StripMeta does not create an extra StripMeta folder. It deliberately does not overwrite package.json, package-lock.json, layout.tsx, API routes, or the metadata engine, so it will not revert your Next.js 16/security work.

Changes:
- Removes the website theme toggle and permanently applies the dark theme.
- Removes duplicate hidden light/dark logo rendering in the header.
- Improves mobile navbar spacing/menu scrolling and adds narrow-screen menu layout.
- Stacks upload controls and settings mode cards on phones to prevent squeezed text/buttons.
- Improves showcase/hero sizing, long text wrapping, action bar sizing, file actions, and inspector field rows.
- Adds safe-area-aware page padding so the floating action bar is less likely to cover the final content on phones.

After applying, run: npm test; npm run build.
