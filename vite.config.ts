/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: { include: ['src/**'], reporter: ['text'] },
  },
});
