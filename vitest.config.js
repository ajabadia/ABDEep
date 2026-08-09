import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['WebUI/tests/setup.js'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // External submodules (patchwork-deepmind-main) — no son parte del proyecto principal
      'docs/patchwork-deepmind-main/**',
      'resources/patchwork-deepmind-main/**',
    ],
  },
});
