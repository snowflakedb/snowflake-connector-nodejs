const Logger = require('../lib/logger');
const NodeLogger = require('../lib/logger/node');
const snowflake = require('../lib/snowflake');

/**
 * @param logLevel one of OFF | ERROR | WARN | INFO | DEBUG | TRACE
 */
exports.configureLogger = (logLevel = 'ERROR') => {
  Logger.getInstance().closeTransports();
  Logger.setInstance(new NodeLogger());
  snowflake.configure({ logLevel });
};
