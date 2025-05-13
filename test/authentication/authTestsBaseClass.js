const assert = require('assert');
const testUtil = require('../integration/testUtil');
const snowflake = require('../../lib/snowflake');

class AuthTest {
  constructor() {
    this.connection = null;
    this.error = null;
    this.callbackCompleted = false;
  }

  connectAsyncCallback() {
    return (err) => {
      this.error = err;
      this.callbackCompleted = true;
    };
  }

  async waitForCallbackCompletion() {
    const timeout = Date.now() + 5000;
    while (Date.now() < timeout) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      if (this.callbackCompleted) {
        return;
      }
    }
    throw new Error('Connection callback did not complete');
  }

  async createConnection(connectionOption) {
    try {
      const connection = snowflake.createConnection(connectionOption);
      this.connection = connection;
    } catch (error) {
      this.error = error;
    }
  }

  async connectAsync() {
    if (!this.error) {
      try {
        await this.connection.connectAsync(this.connectAsyncCallback());
        await this.waitForCallbackCompletion();
      } catch (error) {
        this.error = error;
      }
    }
  }

  async verifyConnectionIsUp() {
    assert.ok(await this.connection.isValidAsync(), 'Connection is not valid');
    await testUtil.executeCmdAsync(this.connection, 'Select 1');
  }

  async verifyConnectionIsNotUp(
    message = 'Unable to perform operation because a connection was never established.',
  ) {
    assert.ok(!this.connection.isUp(), 'Connection should not be up');
    try {
      await testUtil.executeCmdAsync(this.connection, 'Select 1');
      assert.fail('Expected error was not thrown');
    } catch (error) {
      assert.strictEqual(error.message, message);
    }
  }

  async destroyConnection() {
    if (this.connection !== undefined && this.connection !== null && this.connection.isUp()) {
      await testUtil.destroyConnectionAsync(this.connection);
    }
  }

  verifyNoErrorWasThrown() {
    assert.equal(this.error, null);
  }

  verifyErrorWasThrown(message) {
    assert.strictEqual(this.error?.message, message);
  }
}

module.exports = AuthTest;
