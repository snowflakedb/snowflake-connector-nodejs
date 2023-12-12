/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
const { Levels, ConfigurationUtil } = require('./../../../lib/configuration/client_configuration');
const getClientConfig = new ConfigurationUtil().getClientConfig;
const fsPromises = require('fs/promises');
const os = require('os');
const path = require('path');
let tempDir = null;

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
    // expect
    await assert.rejects(
      async () => await getClientConfig('./not-existing-config.json'),
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
