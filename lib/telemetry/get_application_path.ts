// Allows to mock require in tests
export const TESTABLE_REQUIRE_REFERENCE = typeof require !== 'undefined' ? require : undefined;

/**
 * Returns the file path of the main application entry point.
 *
 * - Uses require.main.filename (CommonJS) as primary source
 * - Falls back to process.argv[1] for ESM or worker threads
 * - Returns null in REPL or bundlers
 */
export function getApplicationPath(): string | null {
  return TESTABLE_REQUIRE_REFERENCE?.main?.filename || process.argv?.[1] || null;
}
