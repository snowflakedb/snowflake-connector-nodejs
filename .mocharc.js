const snowflake = require('./lib/snowflake');

module.exports = {
  require: ['ts-node/register'],
  timeout: 180000,
  fullTrace: true,
  recursive: true,
  extension: ['js', 'ts'],
  parallel: true,
  jobs: 4,
  retries: 1,
  rootHooks: {
    beforeEach: () => {
      // NOTE:
      // Some tests change it, so beforeAll is not enough to force trace for every test
      snowflake.configure({ logLevel: 'trace' });
    },
  },
};
