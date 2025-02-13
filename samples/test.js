const snowflake = require('snowflake-sdk');
snowflake.configure({ logLevel: 'TRACE', disableOCSPChecks: true });


const connectionConfig = {
  account: process.env.SNOWFLAKE_TEST_ACCOUNT,
  username: process.env.SNOWFLAKE_TEST_USER,
  password: process.env.SNOWFLAKE_TEST_PASSWORD,
  warehouse: process.env.SNOWFLAKE_TEST_WAREHOUSE,
  database: process.env.SNOWFLAKE_TEST_DATABASE,
  schema: process.env.SNOWFLAKE_TEST_SCHEMA,
};

const localFilePath = '/Users/dheyman/example.txt';
const snowflakeStage = '@mystage';

async function createConnection(config) {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection(config);
    connection.connect((err, conn) => {
      if (err) {
        reject(`Connection failed: ${err.message}`);
      } else {
        resolve(conn);
      }
    });
  });
}

async function executeQuery(connection, sqlText) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      complete: (err, stmt, rows) => {
        if (err) {
          reject(`Execution failed: ${err.message}`);
        } else {
          resolve(rows);
        }
      }
    });
  });
}

// now lets actually upload it
async function uploadFile() {
  try {
    console.log('Connecting to Snowflake...');
    const connection = await createConnection(connectionConfig);
    console.log('Connected successfully.');
    const putCommand = `PUT file://${localFilePath} ${snowflakeStage}`;
    console.log(`Executing: ${putCommand}`);
    const result = await executeQuery(connection, putCommand);
    console.log('File uploaded successfully:', result);
    const deleteCommand = `REMOVE ${snowflakeStage}`;
    const resultDelete = await executeQuery(connection, deleteCommand);
    console.log('File removed successfully:', resultDelete);
  } catch (error) {
    console.error('Error in executing query:', error);
  }
}

// needed to be able to execute directly as a module
if (require.main === module) {
  uploadFile();
}