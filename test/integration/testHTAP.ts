import assert from 'assert';
import crypto from 'crypto';
import { WireMockRestClient } from 'wiremock-rest-client';
import * as testUtil from './testUtil';
import { valid as connOption } from './connectionOptions';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';

const DB_NAMES = ['qcc_test_db1', 'qcc_test_db2', 'qcc_test_db3'] as const;

describe('Query Context Cache', function () {
  let connection: any;
  const tableName = `ht_${crypto.randomUUID().replaceAll('-', '')}`;

  before(async function () {
    if (process.env.CLOUD_PROVIDER !== 'AWS') {
      this.skip();
    }

    connection = testUtil.createConnection(connOption);
    await testUtil.connectAsync(connection);

    for (const db of DB_NAMES) {
      await testUtil.executeCmdAsync(connection, `create database if not exists ${db}`);
    }
  });

  after(async function () {
    if (!connection) {
      return;
    }
    for (const db of DB_NAMES) {
      await testUtil.executeCmdAsync(connection, `drop table if exists ${db}.public.${tableName}`);
    }
    await testUtil.destroyConnectionAsync(connection);
  });

  it('tracks per-database context entries after hybrid table inserts', async function () {
    for (const { sqlTexts, expectedQccSize } of [
      {
        sqlTexts: [
          `use database ${DB_NAMES[0]}`,
          `create or replace hybrid table ${tableName} (a int primary key, b int)`,
          `insert into ${tableName} values (1, 2), (2, 3), (3, 4)`,
        ],
        expectedQccSize: 2,
      },
      {
        sqlTexts: [
          `use database ${DB_NAMES[1]}`,
          `create or replace hybrid table ${tableName} (a int primary key, b int)`,
          `insert into ${tableName} values (1, 2), (2, 3), (3, 4)`,
        ],
        expectedQccSize: 3,
      },
      {
        sqlTexts: [
          `use database ${DB_NAMES[2]}`,
          `create or replace hybrid table ${tableName} (a int primary key, b int)`,
          `insert into ${tableName} values (1, 2), (2, 3), (3, 4)`,
        ],
        expectedQccSize: 4,
      },
      {
        sqlTexts: [
          `select * from ${DB_NAMES[0]}.public.${tableName} x, ${DB_NAMES[1]}.public.${tableName} y, ${DB_NAMES[2]}.public.${tableName} z where x.a = y.a and y.a = z.a`,
          `select * from ${DB_NAMES[0]}.public.${tableName} x, ${DB_NAMES[1]}.public.${tableName} y where x.a = y.a`,
          `select * from ${DB_NAMES[1]}.public.${tableName} x, ${DB_NAMES[2]}.public.${tableName} y where x.a = y.a`,
        ],
        expectedQccSize: 4,
      },
    ]) {
      let lastStatement: any;
      for (const sql of sqlTexts) {
        ({ statement: lastStatement } = await testUtil.executeCmdAsync(connection, sql));
      }
      assert.strictEqual(lastStatement.getQueryContextCacheSize(), expectedQccSize);
      assert.strictEqual(lastStatement.getQueryContextDTOSize(), expectedQccSize);
    }
  });
});

describe('Query Context Cache on failed query', function () {
  let wiremock: WireMockRestClient;
  let connection: any;

  before(async function () {
    const port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/query_request_failed_with_qcc.json',
    );
    connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${port}`,
    });
    await testUtil.connectAsync(connection);
  });

  after(async function () {
    await wiremock.global.shutdown();
  });

  it('updates query context cache on failed query', async function () {
    let statement: any;
    try {
      await testUtil.executeCmdAsync(connection, 'select 1');
      assert.fail('Expected query to fail');
    } catch (err: any) {
      assert.strictEqual(err.code, '200001');
      assert.match(err.message, /A primary key already exists/);
      statement = err.statement;
    }
    assert.strictEqual(statement.getQueryContextCacheSize(), 2);
    assert.strictEqual(statement.getQueryContextDTOSize(), 2);
  });
});
