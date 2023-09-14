const snowflake = require('snowflake-sdk');
const helpers = require('./helpers');
const blocked = require('blocked-at');

async function run() {
  const defaultRowCount = 300000;
  const rowCountToInsert = process.argv[2];
  const rowCountToFetch = process.argv[3];
  const choosenParser = process.argv[4];
  console.log('Started with arguments: ');
  console.log(`Inserted rows amount: ${rowCountToInsert} - default ${defaultRowCount}`);
  console.log(`Selected rows amount: ${rowCountToFetch} - default ${defaultRowCount}`);
  console.log(`Selected json parse : ${choosenParser} - default all of Function, vm, better-eval, JSON`);

  const rowCount = rowCountToInsert || defaultRowCount;
  const selectLimit = rowCountToFetch || defaultRowCount;
  const testVariantTempName = 'testJsonTempTable000';

  const createTempTableWithJsonData = `CREATE OR REPLACE TABLE ${testVariantTempName} (value string)
    AS select parse_json('{
        "_id": "6501c357397b66ce47719212",
        "index": 0,
        "guid": "e7e0e5d8-82b4-47f7-a2ab-68588c93d81e",
        "isActive": false,
        "balance": "$2,611.69",
        "picture": "http://placehold.it/32x32",
        "age": 21,
        "eyeColor": "blue",
        "name": "Joanna Atkinson",
        "gender": "female",
        "company": "AQUAZURE",
        "email": "joannaatkinson@aquazure.com",
        "phone": "+1 (925) 582-3869",
        "address": "395 Karweg Place, Garnet, Mississippi, 9481",
        "registered": "2017-05-18T11:16:33 -02:00",
        "latitude": 21.372656,
        "longitude": -24.488326,
        "tags": [
          "aliquip",
          "aliqua",
          "magna",
          "pariatur",
          "cillum",
          "esse",
          "nisi"
        ],
        "friends": [
          {
            "id": 0,
            "name": "Davis Blake"
          },
          {
            "id": 1,
            "name": "Raymond Jefferson"
          },
          {
            "id": 2,
            "name": "Hoffman Roberts"
          }
        ],
        "greeting": "Hello, Joanna Atkinson! You have 3 unread messages.",
        "favoriteFruit": "apple"
      }') 
      from table(generator(rowcount=>${rowCount}))`;
  const createTableWithVariant = (tableName) => `create or replace table ${tableName}(colA variant)`;

  const dropTableWithVariant = (tableName) =>`drop table if exists ${tableName}`;
  const dropTempTable = `drop table if exists ${testVariantTempName}`;

  const insertVariant = (tableName)=> `insert into ${tableName}
                         select parse_json(value)
                         from ${testVariantTempName}`;
  const selectCountVariant = (tableName) => `select count(colA) from ${(tableName)}`;

  let avgBlock = 0, minBlock = 999999999999999, maxBlock = 0;
  let blockCount = 0;

  const testCases = [];
  if (!choosenParser || choosenParser.toString().includes('Function')) {
    testCases.push({parser: 'Function', jsonColumnVariantParser: (rawColumnValue) => new Function(`return (${rawColumnValue})`)});
  }
  if (!choosenParser || choosenParser.toString().includes('better-eval')) {
    testCases.push({parser: 'betterEval', jsonColumnVariantParser: (rawColumnValue) => require('better-eval').call('(' + rawColumnValue + ')')});
  }
  if (!choosenParser || choosenParser.toString().includes('vm')) {
    testCases.push({parser: 'vm', jsonColumnVariantParser: rawColumnValue => require('vm').runInNewContext('(' + rawColumnValue + ')')});
  }
  // eval lib contains vulnerability so we decide to resign using it
  // if (!process.argv[4] || process.argv[4].toString().contains('eval')) {
  //   testCases.push({parser: 'eval', jsonColumnVariantParser: rawColumnValue => eval('(' + rawColumnValue + ')')})
  // };
  if (!choosenParser || choosenParser.toString().includes('JSON')) {
    testCases.push({parser: 'JSON', jsonColumnVariantParser: rawColumnValue => JSON.parse(rawColumnValue)});
  }

  const execute = async ({parser, jsonColumnVariantParser}, extractFunction) => {
    console.log(`\nTest for parser: [${parser}] extracting by ${extractFunction.name}`);
    const testVariantTableName = `testVariantTable000${parser}`;
    let connection = await helpers.connectUsingEnv();
    return new Promise(async (resolve, reject) => {
      snowflake.configure({
        jsonColumnVariantParser: jsonColumnVariantParser
      });

      await helpers.executeQuery(connection, createTempTableWithJsonData);
      await helpers.executeQuery(connection, createTableWithVariant(testVariantTableName));
      await helpers.executeQuery(connection, insertVariant(testVariantTableName));
      await helpers.executeQuery(connection, selectCountVariant(testVariantTableName));;

      const queryTimeLabel = parser + 'SelectTime';
      let avgBlock = 0, minBlock = 999999999999999, maxBlock = 0;
      let blockCount = 0;
      blocked((time) => {
        blockCount++;
        avgBlock += time;
        minBlock = minBlock > time ? time : minBlock;
        maxBlock = maxBlock < time ? time : maxBlock;
      });

      console.time(queryTimeLabel);
      const streamResult = true;
      connection.execute({
        streamResult: streamResult,
        sqlText: `select *
                  from IDENTIFIER(?) LIMIT ${selectLimit}`,
        binds: [testVariantTableName],
        complete: function (err, stmt) {
          const stream = stmt.streamRows();
          extractFunction(stream);
          stream.on('end', function () {
            console.log('parser: ' + parser);
            console.log('streamResult: ' + streamResult);
            console.log('row count: ' + selectLimit);
            console.timeEnd(queryTimeLabel);
            console.log('average block time: ' + avgBlock / blockCount);
            console.log('minimum block time: ' + minBlock);
            console.log('maximum block time: ' + maxBlock);
            console.log('block call count: ' + blockCount);
            resolve();
          });
          stream.on('error', function (err) {
            console.log(err);
            reject(err);
          });
        }
      });
    })
      .finally(async () => {
        await helpers.executeQuery(connection, dropTableWithVariant(testVariantTableName));
        await helpers.executeQuery(connection, dropTempTable);
      });
  };

  function extractOnData(stream) {
    let count = 0;
    stream.on('data', function () {
      count++;
      if (count % 10000 === 0) {
        console.log(`Parsed rows: ${count}`);
      }
    });
  }

  function extractOnStream(stream) {
    let count = 0;
    stream.on('readable', function () {
      while ((stream.read()) !== null) {
        count++;
        if (count % 10000 === 0) {
          console.log(`Parsed rows: ${count}`);
        }
      }
    });
  }

  testCases.reduce( (promise, nextParser) => {
    return promise
      .then(() => {
        return execute(nextParser, extractOnData);
      })
      .then(() => {
        return execute(nextParser, extractOnStream);
      });
  }, Promise.resolve());
}

run();

