const Logger = require('../lib/logger');
const NodeLogger = require('../lib/logger/node');
const snowflake = require('../lib/snowflake').default;

/**
 * @param logLevel one of OFF | ERROR | WARN | INFO | DEBUG | TRACE
 */
exports.configureLogger = async (logLevel = 'INFO') => {
  await Logger.getInstance().closeTransports();
  Logger.setInstance(new NodeLogger({ filePath: 'STDOUT' }));
  snowflake.configure({ logLevel });
};
