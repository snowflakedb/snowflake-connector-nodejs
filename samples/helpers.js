const snowflake = require('snowflake-sdk');
exports.executeQuery = async function (connection, query, binds) {
  await new Promise((resolve, reject) => {
    connection.execute({
      sqlText: query,
      binds: binds,
      complete: function (err, stmt, rows) {
        if (!err) {
          resolve(rows);
        } else {
          reject(err);
        }
      }
    });
  });
};

exports.connectUsingEnv = async () => {
  const snowflakeTestProtocol = process.env.SNOWFLAKE_TEST_PROTOCOL;
  const snowflakeTestHost = process.env.SNOWFLAKE_TEST_HOST;
  const snowflakeTestPort = process.env.SNOWFLAKE_TEST_PORT;
  const snowflakeTestAccount = process.env.SNOWFLAKE_TEST_ACCOUNT;
  const snowflakeTestUser = process.env.SNOWFLAKE_TEST_USER;
  const snowflakeTestDatabase = process.env.SNOWFLAKE_TEST_DATABASE;
  const snowflakeTestWarehouse = process.env.SNOWFLAKE_TEST_WAREHOUSE;
  const snowflakeTestSchema = process.env.SNOWFLAKE_TEST_SCHEMA;
  const snowflakeTestPassword = process.env.SNOWFLAKE_TEST_PASSWORD;
  const snowflakeTestRole = process.env.SNOWFLAKE_TEST_ROLE;

  const connection = snowflake.createConnection({
    account: snowflakeTestAccount,
    username: snowflakeTestUser,
    password: snowflakeTestPassword,
    role: snowflakeTestRole,
    database: snowflakeTestDatabase,
    schema: snowflakeTestSchema,
    warehouse: snowflakeTestWarehouse,
    host: snowflakeTestHost,
    port: snowflakeTestPort,
    protocol: snowflakeTestProtocol
  });

  return  new Promise((resolve, reject) => {
    connection.connect(
      function (err, conn) {
        if (err) {
          console.error('Unable to connect: ' + err.message);
          reject(new Error(err.message));
        } else {
          console.log('Successfully connected to Snowflake');
          resolve(conn);
        }
      }
    );
  });
};