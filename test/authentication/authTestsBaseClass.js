const assert = require('assert');
const testUtil = require('../integration/testUtil');
const snowflake = require('../../lib/snowflake');
const { spawn } = require('child_process');

class AuthTest {

  runAuthTestsManually = process.env.RUN_AUTH_TESTS_MANUALLY === 'true';
  cleanBrowserProcessesPath = '/externalbrowser/cleanBrowserProcesses.js';
  
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
      await new Promise(resolve => setTimeout(resolve, 100));
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

  async verifyConnectionIsNotUp(message = 'Unable to perform operation because a connection was never established.') {
    assert.ok(!(this.connection.isUp()), 'Connection should not be up');
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

  execWithTimeout(command, args, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { shell: true });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data;
      });

      child.stderr.on('data', (data) => {
        stderr += data;
      });

      child.on('error', (err) => {
        reject(err);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Process exited with code: ${code}, error: ${stderr}`));
        } else {
          resolve({ stdout, stderr });
        }
      });

      setTimeout(() => {
        child.kill();
        reject(new Error('Process timed out'));
      }, timeout);
    });
  }

  async cleanBrowserProcesses() {
    if (!this.runAuthTestsManually) {
      await this.execWithTimeout('node', [this.cleanBrowserProcessesPath], 15000);
    }
  }

  async connectAndProvideCredentials(provideCredentialsPromise) {
    if (this.runAuthTestsManually) {
      await this.connectAsync();
    } else {
      await Promise.allSettled([this.connectAsync(), provideCredentialsPromise]);
    }
  }
}

module.exports = AuthTest;
