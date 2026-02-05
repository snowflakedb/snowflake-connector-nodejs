/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Mocha compatibility: before/after -> beforeAll/afterAll
    globals: true,
    testTimeout: 180000,
    hookTimeout: 180000,
    // Retry flaky tests (like mocha's retries: 1)
    retry: 1,
    // Setup file
    setupFiles: ['./test/vitestSetup.ts'],
    // Include test files - using broader patterns that work with --dir
    include: ['**/*_test*.{js,ts}', '**/test*.{js,ts}'],
    // Exclude node_modules, dist, mock directories, and utility files
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/mock/**',
      '**/wiremock/**',
      '**/test_util.js',
      '**/test_utils.ts',
    ],
    // Reporter
    reporters: ['verbose'],
    // Run tests sequentially (like mocha default)
    sequence: {
      concurrent: false,
    },
  },
  // esbuild configuration for TypeScript
  esbuild: {
    target: 'node22',
  },
});
