const snowflake = require('snowflake-sdk');
const { connectUsingEnv, destroyAsync } = require('./helpers');

const executeQuery = (connection, query, binds = undefined) => new Promise((resolve, reject) => {
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

const executeQueryStreaming = (connection, query, binds = undefined) => new Promise((resolve, reject) => {
  const stmt = connection.execute({
    sqlText: query,
    binds: binds,
    streamResult: true,
  });
  stmt.streamRows()
    .on('error', err => reject(err))
    .on('data', () => {})
    .on('end', () => resolve());
});

async function runQueryReadingResultsFromRows(query){
  const connection = await connectUsingEnv();
  console.time('without streaming');
  await executeQuery(connection, query);
  console.timeEnd('without streaming');
  await destroyAsync(connection);
}

async function runQueryReadingResultsFromStream(query){
  const connection = await connectUsingEnv();
  console.time('with streaming');
  await executeQueryStreaming(connection, query);
  console.timeEnd('with streaming');
  await destroyAsync(connection);
}

async function main() {
  const query = 'Select 1'; // Set your query here
  snowflake.configure({ logLevel: 'ERROR' });
  console.log(`Executing query: ${query}`);
  await runQueryReadingResultsFromRows(query);
  await runQueryReadingResultsFromStream(query);
}

main().catch((err) => console.error(err));
