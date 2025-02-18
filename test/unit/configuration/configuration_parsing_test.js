const assert = require('assert');
const { Levels, ConfigurationUtil } = require('./../../../lib/configuration/client_configuration');
const { loadConnectionConfiguration } = require('./../../../lib/configuration/connection_configuration');
const getClientConfig = new ConfigurationUtil().getClientConfig;
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
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
        assert.strictEqual(err.message, 'Finding client configuration failed');
        assert.match(err.cause.message, /ENOENT: no such file or directory./);
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
      await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8' });

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

  function replaceSpaces(stringValue) {
    return stringValue.replace(' ', '_');
  }

  async function writeFile(filePath, fileContent) {
    await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8' });
  }
});
