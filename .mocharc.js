module.exports = {
  require: ['ts-node/register', './test/globalSetup.ts'],
  timeout: 180000,
  fullTrace: true,
  recursive: true,
  extension: ['js', 'ts'],
  // TODO: Enable parallel test execution
  // - 4 parallel jobs provide optimal performance (3x faster execution)
  // - More than 4 jobs don't improve performance further
  // - Parallel execution currently causes some tests to become flaky
  // parallel: true,
  // jobs: 4,

  // TODO:
  // Consider removing retries once connectivity issues resolved in SNOW-2679711
  retries: 1,
};
