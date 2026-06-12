const toml = require('toml');
const os = require('os');
const fs = require('fs');
const { validateNoExtraPermissionsForOthersSync, generateChecksum } = require('../file_util');
const path = require('path');
const Logger = require('../logger').default;
const AuthenticationTypes = require('../authentication/authentication_types');
const Util = require('../util');
const { normalizeConnectionOptions } = require('../connection/normalize_connection_options');

// TODO: This file should be renamed to something like utils.ts/connection_utils.ts

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

const TOKEN_BASED_AUTHENTICATORS = [
  AuthenticationTypes.OAUTH_AUTHENTICATOR,
  AuthenticationTypes.PROGRAMMATIC_ACCESS_TOKEN,
  AuthenticationTypes.WORKLOAD_IDENTITY,
];

function shouldReadTokenFromFile(fixedConfiguration) {
  return (
    fixedConfiguration &&
    fixedConfiguration.authenticator &&
    TOKEN_BASED_AUTHENTICATORS.includes(fixedConfiguration.authenticator.toUpperCase()) &&
    !Util.string.isNotNullOrEmpty(fixedConfiguration.token)
  );
}

function readTokenFromFile(tokenFilePath) {
  Logger().trace('Token file path is : %s', tokenFilePath);
  let resolvedPath;
  let token;
  try {
    resolvedPath = fs.realpathSync(tokenFilePath);
    validateNoExtraPermissionsForOthersSync(resolvedPath);
    token = fs.readFileSync(resolvedPath, 'utf-8').trim();
  } catch (error) {
    throw new Error(`Failed to read the token from file: ${tokenFilePath}. ${error.message}`);
  }
  const tokenChecksum = generateChecksum(token);
  Logger().info(
    'Token used in connection has been read from file: %s. Checksum: %s',
    resolvedPath,
    tokenChecksum,
  );
  return token;
}

function loadConnectionConfiguration() {
  Logger().trace('Loading connection configuration from the local files...');
  const snowflakeConfigDir = defaultIfNotSet(
    process.env.SNOWFLAKE_HOME,
    path.join(os.homedir(), '.snowflake'),
  );
  Logger().trace('Looking for connection file in directory %s', snowflakeConfigDir);
  const filePath = path.join(snowflakeConfigDir, 'connections.toml');
  const resolvedPath = fs.realpathSync(filePath);
  Logger().trace(
    'Connection configuration file found under the path %s. Validating file access.',
    resolvedPath,
  );
  validateNoExtraPermissionsForOthersSync(resolvedPath);
  const str = fs.readFileSync(resolvedPath, { encoding: 'utf8' });
  const configurationChecksum = generateChecksum(str);
  Logger().info(
    'Connection configuration file is read from path: %s. Checksum: %s',
    resolvedPath,
    configurationChecksum,
  );
  Logger().trace('Trying to parse the config file');
  const parsingResult = toml.parse(str);

  const configurationName = defaultIfNotSet(
    process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME,
    'default',
  );

  if (parsingResult[configurationName] !== undefined) {
    const configuration = parsingResult[configurationName];
    return normalizeConnectionOptions(configuration);
  } else {
    Logger().error(
      'Connection configuration with name %s does not exist in the file %s',
      configurationName,
      resolvedPath,
    );
    throw new Error(`Connection configuration with name ${configurationName} does not exist`);
  }
}

exports.loadConnectionConfiguration = loadConnectionConfiguration;
exports.readTokenFromFile = readTokenFromFile;
exports.shouldReadTokenFromFile = shouldReadTokenFromFile;
exports.TOKEN_BASED_AUTHENTICATORS = TOKEN_BASED_AUTHENTICATORS;
