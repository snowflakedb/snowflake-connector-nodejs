module.exports = {
  require: ['ts-node/register', './test/globalSetup.ts'],
  timeout: 180000,
  fullTrace: true,
  recursive: true,
  extension: ['js', 'ts'],
  parallel: true,
  jobs: 4,
  // TODO:
  // Consider removing retries once connectivity issues resolved in SNOW-2679711
  retries: 1,
};
