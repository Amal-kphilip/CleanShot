import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@gwr-core': path.resolve(
        __dirname,
        './node_modules/@pilio/gemini-watermark-remover/src/core'
      ),
    },
  },
});
