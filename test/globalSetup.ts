// oxlint-disable no-console
import Mocha from 'mocha';

export const mochaHooks = {
  beforeEach(this: Mocha.Context) {
    const currentTest = this.currentTest as Mocha.Test;
    // @ts-ignore currentRetry() is not protected method
    const currentRetry = currentTest.currentRetry();
    if (currentRetry > 0) {
      console.log(`Retrying "${currentTest.fullTitle()}" — attempt #${currentRetry}`);
    }
  },
};
