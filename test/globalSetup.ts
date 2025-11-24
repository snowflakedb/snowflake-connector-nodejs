import Mocha from 'mocha';
const snowflake = require('../lib/snowflake');

export const mochaHooks = {
  beforeEach(this: Mocha.Context) {
    // NOTE: some tests change this without restoring it
    snowflake.configure({ logLevel: 'error' });

    const currentTest = this.currentTest as Mocha.Test;
    // @ts-ignore currentRetry is not protected property
    const currentRetry = currentTest.currentRetry();
    if (currentRetry > 0) {
      console.log(`Retrying "${currentTest.fullTitle()}" — attempt #${currentRetry}`);
    }
  },
};
