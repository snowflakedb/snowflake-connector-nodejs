const assert = require('assert');
const { Levels, ConfigurationUtil } = require('./../../../lib/configuration/client_configuration');
const { loadConnectionConfiguration } = require('./../../../lib/configuration/connection_configuration');
const getClientConfig = new ConfigurationUtil().getClientConfig;
const fsPromises = require('fs/promises');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isWindows } = require('../../../lib/util');
let tempDir = null;

describe('should parse toml connection configuration', function () {

  beforeEach( async function () {
    process.env.SNOWFLAKE_HOME = process.cwd() + '/test';
    const configurationPath = path.join(process.env.SNOWFLAKE_HOME, 'connections.toml');
    await fsPromises.chmod(configurationPath, '600');
  });

  afterEach( function () {
    delete process.env.SNOWFLAKE_HOME;
    delete process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME;
  });

  it('should parse toml with connection configuration: ', async function () {
    const configuration = await loadConnectionConfiguration();
    assert.strictEqual(configuration['account'], 'snowdriverswarsaw.us-west-2.aws');
    assert.strictEqual(configuration['username'], 'test_user');
    assert.strictEqual(configuration['password'], 'test_pass');
    assert.strictEqual(configuration['warehouse'], 'testw');
    assert.strictEqual(configuration['database'], 'test_db');
    assert.strictEqual(configuration['schema'], 'test_nodejs');
    assert.strictEqual(configuration['protocol'], 'https');
    assert.strictEqual(configuration['port'], '443');
  });

  it('should parse toml with connection configuration - oauth', async function () {
    process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth';
    const configuration = await loadConnectionConfiguration();
    assert.strictEqual(configuration['token'], 'token_value');
    assert.strictEqual(configuration['authenticator'], 'oauth');
  });

  it('should throw exception when token file does not exist', async function () {
    process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'aws-oauth-file';
    try {
      await loadConnectionConfiguration();
    } catch (error) {
      assert.match(error.message, /ENOENT: no such file or directory/);
    }
  });

  it('should throw error toml when file does not exist',  function (done) {
    process.env.SNOWFLAKE_HOME = '/unknown/';
    try {
      loadConnectionConfiguration();
      assert.fail();
    } catch (error) {
      assert.match(error.message, /ENOENT: no such file or directory/);
      done();
    }
  });

  it('should throw exception if configuration does not exists', function (done) {
    process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME = 'unknown';
    try {
      loadConnectionConfiguration();
      assert.fail();
    } catch (error) {
      assert.strictEqual(error.message, 'Connection configuration with name unknown does not exist');
      done();
    }
  });
});

describe('Configuration parsing tests', function () {

  before(async function () {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'conf_parse_tests_'));
  });

  after(async function () {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  [
    {
      testCaseName: 'INFO',
      logLevel: Levels.Info.toUpperCase()
    },
    {
      testCaseName: 'info',
      logLevel: Levels.Info.toLowerCase()
    },
  ].forEach(({ testCaseName, logLevel }) => {
    it('should parse json with log level: ' + testCaseName, async function () {
      // given
      const fileName = 'config.json';
      const filePath = path.join(tempDir, fileName);
      const logPath = '/some-path/some-directory';
      const fileContent = `{
              "common": {
                  "log_level": "${logLevel}",
                  "log_path": "${logPath}"
              } 
          }`;
      await writeFile(filePath, fileContent);

      // when
      const configuration = await getClientConfig(filePath);

      // then
      assert.equal(configuration.loggingConfig.logLevel, logLevel);
      assert.equal(configuration.loggingConfig.logPath, logPath);
    });
  });

  [
    {
      testCaseName: 'config with nulls',
      fileContent: `{
        "common": {
            "log_level": null,
            "log_path": null
        }
      }`
    },
    {
      testCaseName: 'config with empty common',
      fileContent: `{
        "common": {} 
     }`
    },
    {
      testCaseName: 'config with known values and unknown key',
      fileContent: `{
            "common": {
                "log_level": "ERROR",
                "log_path": null,
                "unknown_key": "unknown_value"
            } 
        }`
    },
    {
      testCaseName: 'config with unknown key',
      fileContent: `{
            "common": {
                "unknown_key": "unknown_value"
            } 
        }`
    }
  ].forEach(({ testCaseName, fileContent }) => {
    it('should parse config without values: ' + testCaseName, async function () {
      // given
      const fileName = 'config_nulls_' + replaceSpaces(testCaseName) + '.json';
      const filePath = path.join(tempDir, fileName);
      await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8' });

      // when
      const configuration = await getClientConfig(filePath);

      // then
      assert.equal(configuration.logLevel, null);
      assert.equal(configuration.logPath, null);
    });
  });

  [
    {
      testCaseName: 'null',
      filePath: null
    },
    {
      testCaseName: 'empty string',
      filePath: ''
    },
    {
      testCaseName: 'undefined',
      filePath: undefined
    }
  ].forEach(({ testCaseName, filePath }) => {
    it('should return null when config file not given: ' + testCaseName, async function () {
      // when
      const configuration = await getClientConfig(filePath);

      // then
      assert.strictEqual(configuration, null);
    });
  });

  it('should fail when config file does not exist', async function () {
    const filePath = './not-existing-config.json';
    // expect
    await assert.rejects(
      async () => await getClientConfig(filePath),
      (err) => {
        assert.strictEqual(err.name, 'ConfigurationError');
        assert.strictEqual(err.message, 'Fail to open the configuration file');
        assert.match(err.cause.message, /ENOENT: no such file or directory./);
        return true;
      });
  });

  it('should fail when the path is a symlink', async function () {
    const fileName = 'config.json';
    const filePath = path.join(tempDir, fileName);
    const symlinkPath = path.join(tempDir, 'test_symlink');
    await fsPromises.symlink(filePath, symlinkPath, isWindows() ? 'junction' : 'file');

    // expect
    await assert.rejects(
      async () => await getClientConfig(symlinkPath),
      (err) => {
        assert.strictEqual(err.name, 'ConfigurationError');
        assert.strictEqual(err.message, 'Fail to open the configuration file');
        assert.match(err.cause.message, isWindows() ? /ENOENT: no such file or directory, open/ : /ELOOP: too many symbolic links encountered, open/);
        return true;
      });
  });

  [
    {
      testCaseName: 'unknown log level',
      fileContent: `{
            "common": {
                "log_level": "unknown",
                "log_path": "/some-path/some-directory"
            } 
        }`
    },
    {
      testCaseName: 'no common in config',
      fileContent: '{}'
    },
    {
      testCaseName: 'log level is not a string',
      fileContent: `{
            "common": {
                "log_level": 5,
                "log_path": "/some-path/some-directory"
            } 
        }`
    },
    {
      testCaseName: 'log path is not a string',
      fileContent: `{
            "common": {
                "log_level": "${Levels.Info}",
                "log_path": true
            } 
        }`
    },
  ].forEach(({ testCaseName, fileContent }) => {
    it('should fail for wrong config content ' + testCaseName, async function () {
      // given
      const fileName = 'config_wrong_' + replaceSpaces(testCaseName) + '.json';
      const filePath = path.join(tempDir, fileName);
      await writeFile(filePath, fileContent);

      // expect
      await assert.rejects(
        async () => await getClientConfig(filePath),
        (err) => {
          assert.strictEqual(err.name, 'ConfigurationError');
          assert.strictEqual(err.message, 'Parsing client configuration failed');
          assert.ok(err.cause);
          return true;
        });
    });
  });

  it('test - when the file has been changed by others', async function () {
    if (isWindows()) {
      return;
    }
    const fileName = 'file_change_test.json';
    const filePath = path.join(tempDir, fileName);
    const fileContent = `{
      "common": {
          "log_level": "${Levels.Info}",
          "log_path": "/some-path/some-directory"
      } 
  }`;
    await writeFile(filePath, fileContent);
    setTimeout(() => {
      fs.open(filePath, 'w', (err, fd) => {
        fs.writeFileSync(fd, 'Hacked by someone');
        fs.closeSync(fd);
      });
    }, 2000);

    try {
      await getClientConfig(filePath, true, 3000);
      assert.ok(false, 'should be failed');
    } catch (err) {
      assert.strictEqual(err.name, 'ConfigurationError');
      assert.strictEqual(err.message, 'The config file has been modified');
      assert.strictEqual(err.cause, 'InvalidConfigFile');
    }
  });

  it('test - when the file permission has been changed by others', async function () {
    if (isWindows()) {
      return;
    }
    const fileName = 'file_permission_change_test.json';
    const filePath = path.join(tempDir, fileName);
    const fileContent = `{
      "common": {
          "log_level": "${Levels.Info}",
          "log_path": "/some-path/some-directory"
      } 
  }`;
    await writeFile(filePath, fileContent);
    setTimeout(() =>
      fs.chmodSync(filePath, 0o777),
    2000);

    try {
      await getClientConfig(filePath, true, 3000);
      assert.ok(false, 'should be failed');
    } catch (err) {
      assert.strictEqual(err.name, 'ConfigurationError');
      assert.strictEqual(err.message, 'The config file has been modified');
      assert.strictEqual(err.cause, 'InvalidConfigFile');
    }
  });

  it('test - when the file has been replaced', async function () {
    if (isWindows()) {
      return;
    }
    const fileName = 'file_replaced_test.json';
    const filePath = path.join(tempDir, fileName);
    const fileContent = `{
      "common": {
          "log_level": "${Levels.Info}",
          "log_path": "/some-path/some-directory"
      } 
  }`;
    await writeFile(filePath, fileContent);
    setTimeout(async () => {
      fs.rmSync(filePath);
      await writeFile(filePath, 'Hacked by someone');
    },
    2000);

    try {
      await getClientConfig(filePath, true, 5000);
      assert.ok(false, 'should be failed');
    } catch (err) {
      assert.strictEqual(err.name, 'ConfigurationError');
      assert.strictEqual(err.message, 'The config file has been modified');
      assert.strictEqual(err.cause, 'InvalidConfigFile');
    }
  });

  function replaceSpaces(stringValue) {
    return stringValue.replace(' ', '_');
  }

  async function writeFile(filePath, fileContent) {
    await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8', mode: 0o755 });
  }
});
