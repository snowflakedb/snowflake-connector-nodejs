module.exports = {
  require: ['ts-node/register', './test/globalSetup.ts'],
  timeout: 180000,
  fullTrace: true,
  recursive: true,
  extension: ['js', 'ts'],
  parallel: true,
  jobs: 8, // Default warehouse concurrency is 8
  retries: 1,
};
