import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/lib/gwr-video/**",
      "public/gemini-video/onnxruntime/**",
    ],
  },
  {
    // These components/pages render dynamic browser blob:/data: object URLs for local file previews,
    // where Next.js <Image> optimization cannot be used without breaking or bypassing local previews.
    files: [
      "src/app/analyze-image/page.tsx",
      "src/app/compare-images/page.tsx",
      "src/app/inspector/page.tsx",
      "src/components/FileList.tsx",
      "src/components/InspectorModal.tsx",
    ],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
