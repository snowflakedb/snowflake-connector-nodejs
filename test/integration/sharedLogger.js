const winston = require('winston');
const os = require('os');

const snowflake = require('./../../lib/snowflake');
const Logger = require('./../../lib/logger');


snowflake.configure({ logLevel: 'trace' });
const transports = [];
if (process.env.SNOWFLAKE_TEST_LOG_CONSOLE === 'true') {
  transports.push(new (winston.transports.Console)());
} else {
  let logDir = process.env.WORKSPACE;
  if (!logDir) {
    logDir = os.homedir();
  }
  transports.push(new (winston.transports.File)({ filename: logDir + '/snowflake.log' }));
}
const logger = new winston.createLogger(
  {
    transports: transports,
    level: Logger.getInstance().getLevelTag(),
    levels: Logger.getInstance().getLevelTagsMap()
  });

exports.logger = logger;