import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    include: ['WebUI/tests/**/*.test.js'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['WebUI/js/**/*.js'],
      exclude: ['WebUI/js/_fix_fade.js'],
      all: true,
      clean: true,
      reporter: ['text', 'text-summary', 'lcov'],
    },
  },
});
