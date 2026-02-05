/**
 * Vitest setup file - provides compatibility layer for mocha migration
 * This file is loaded before each test file
 */
/// <reference types="vitest/globals" />
import { beforeAll, afterAll, beforeEach, afterEach, vi, it, describe } from 'vitest';

// Re-export mocha's before/after as vitest's beforeAll/afterAll for compatibility
// These are made available globally via vitest's globals: true config
// @ts-ignore - Mocha compatibility: expose before/after as aliases
globalThis.before = beforeAll;
// @ts-ignore - Mocha compatibility: expose before/after as aliases
globalThis.after = afterAll;

// Mocha's xit/xdescribe for skipped tests -> vitest's it.skip/describe.skip
// @ts-ignore - Mocha compatibility
globalThis.xit = it.skip;
// @ts-ignore - Mocha compatibility
globalThis.xdescribe = describe.skip;

// Automatically restore all mocks after each test (like sinon's afterEach restore)
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// Log retry attempts
beforeEach((context) => {
  const retry = context.task?.retry;
  if (retry && retry > 0) {
    console.log(`Retrying "${context.task.name}" — attempt #${retry}`);
  }
});
