const toml = require('toml');
const os = require('os');
const fs = require('fs');
const { validateNoExtraPermissionsForOthersSync, generateChecksum } = require('../file_util');
const path = require('path');
const Logger = require('../logger');
const AuthenticationTypes = require('../authentication/authentication_types');
const Util = require('../util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

function shouldReadTokenFromFile(fixedConfiguration) {
  return (
    fixedConfiguration &&
    fixedConfiguration.authenticator &&
    fixedConfiguration.authenticator.toUpperCase() === AuthenticationTypes.OAUTH_AUTHENTICATOR &&
    !Util.string.isNotNullOrEmpty(fixedConfiguration.token)
  );
}

function readTokenFromFile(fixedConfiguration) {
  const tokenFilePath = fixedConfiguration.token_file_path
    ? fixedConfiguration.token_file_path
    : '/snowflake/session/token';
  const resolvedPath = fs.realpathSync(tokenFilePath);
  Logger.default().trace('Token file path is : %s', tokenFilePath);
  validateNoExtraPermissionsForOthersSync(resolvedPath);
  fixedConfiguration.token = fs.readFileSync(resolvedPath, 'utf-8').trim();
  if (!fixedConfiguration.token) {
    Logger.default().error('The token does not exist or has empty value.');
    throw new Error('The token does not exist or has empty value');
  }
  const tokenChecksum = generateChecksum(fixedConfiguration.token);
  Logger.default().info(
    'Token used in connection has been read from file: %s. Checksum: %s',
    resolvedPath,
    tokenChecksum,
  );
}

function loadConnectionConfiguration() {
  Logger.default().trace('Loading connection configuration from the local files...');
  const snowflakeConfigDir = defaultIfNotSet(
    process.env.SNOWFLAKE_HOME,
    path.join(os.homedir(), '.snowflake'),
  );
  Logger.default().trace('Looking for connection file in directory %s', snowflakeConfigDir);
  const filePath = path.join(snowflakeConfigDir, 'connections.toml');
  const resolvedPath = fs.realpathSync(filePath);
  Logger.default().trace(
    'Connection configuration file found under the path %s. Validating file access.',
    resolvedPath,
  );
  validateNoExtraPermissionsForOthersSync(resolvedPath);
  const str = fs.readFileSync(resolvedPath, { encoding: 'utf8' });
  const configurationChecksum = generateChecksum(str);
  Logger.default().info(
    'Connection configuration file is read from path: %s. Checksum: %s',
    resolvedPath,
    configurationChecksum,
  );
  Logger.default().trace('Trying to parse the config file');
  const parsingResult = toml.parse(str);

  const configurationName = defaultIfNotSet(
    process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME,
    'default',
  );

  if (parsingResult[configurationName] !== undefined) {
    const fixedConfiguration = fixUserKey(parsingResult[configurationName]);
    if (shouldReadTokenFromFile(fixedConfiguration)) {
      Logger.default().info('Trying to read token from config file.');
      readTokenFromFile(fixedConfiguration);
    }
    return fixedConfiguration;
  } else {
    Logger.default().error(
      'Connection configuration with name %s does not exist in the file %s',
      configurationName,
      resolvedPath,
    );
    throw new Error(`Connection configuration with name ${configurationName} does not exist`);
  }
}

function fixUserKey(parsingResult) {
  Logger.default().trace("Empty Username field will be filled with 'User' field value.");
  if (parsingResult['username'] === undefined && parsingResult['user'] !== undefined) {
    parsingResult['username'] = parsingResult['user'];
  }
  return parsingResult;
}

exports.loadConnectionConfiguration = loadConnectionConfiguration;
