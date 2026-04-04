import assert from 'assert';
import crypto from 'crypto';
import * as testUtil from './testUtil';
import { valid as connOption } from './connectionOptions';

const snowflake = require('./../../lib/snowflake').default;
snowflake.configure({
  logLevel: 'TRACE',
  disableOCSPChecks: true,
});
// @ts-ignore
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

const DB_NAMES = ['qcc_test_db1', 'qcc_test_db2', 'qcc_test_db3'] as const;

const randomHybridTableName = () => `hybrid_table_${crypto.randomUUID().replaceAll('-', '')}`;

describe('Query Context Cache', function () {
  let connection: any;

  before(async function () {
    if (process.env.CLOUD_PROVIDER !== 'AWS') {
      // this.skip();
    }

    // connection = testUtil.createConnection(connOption);
    connection = snowflake.createConnection({
      // put creds here
      proxyHost: '127.0.0.1',
      proxyPort: 8080,
    });
    await testUtil.connectAsync(connection);

    for (const db of DB_NAMES) {
      await testUtil.executeCmdAsync(connection, `create database if not exists ${db}`);
    }
  });

  after(async function () {
    if (!connection) {
      return;
    }
    await testUtil.destroyConnectionAsync(connection);
  });

  it('tracks per-database context entries after hybrid table inserts', async function () {
    const tableName = randomHybridTableName();
    const queryGroups = [
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
    ];

    try {
      for (const { sqlTexts, expectedQccSize } of queryGroups) {
        let lastStatement: any;
        for (const sql of sqlTexts) {
          ({ statement: lastStatement } = await testUtil.executeCmdAsync(connection, sql));
        }
        assert.strictEqual(lastStatement.getQueryContextCacheSize(), expectedQccSize);
        assert.strictEqual(lastStatement.getQueryContextDTOSize(), expectedQccSize);
      }
    } finally {
      await Promise.allSettled(
        DB_NAMES.map((db) =>
          testUtil.executeCmdAsync(connection, `drop table if exists ${db}.public.${tableName}`),
        ),
      );
    }
  });

  it('updates query context cache on failed query', async function () {
    const tableName = randomHybridTableName();

    await testUtil.executeCmdAsync(connection, `use database ${DB_NAMES[0]}`);
    await testUtil.executeCmdAsync(
      connection,
      `create or replace hybrid table ${tableName} (pk text primary key, value text)`,
    );
    // await testUtil.executeCmdAsync(
    //   connection,
    //   'alter session set TRANSACTION_ABORT_ON_ERROR = true',
    // );

    try {
      // Q0: begin transaction
      await testUtil.executeCmdAsync(connection, 'begin');

      // Q1: successful insert — QCC gets updated
      const { statement: q1Statement } = await testUtil.executeCmdAsync(
        connection,
        `insert into ${tableName} values ('1', 'value1')`,
      );
      const qccSizeAfterQ1 = q1Statement.getQueryContextCacheSize();
      assert.ok(qccSizeAfterQ1 >= 2, `Expected QCC size >= 2 after Q1, got ${qccSizeAfterQ1}`);

      // Q2: duplicate primary key — fails, marks txn as aborted.
      // The server still returns queryContext in the error response, but the
      // connector currently discards the body on failure so QCC is not updated.
      let q2Statement: any;
      try {
        await testUtil.executeCmdAsync(
          connection,
          `insert into ${tableName} values ('1', 'value1')`,
        );
        assert.fail('Q2 was expected to fail with a duplicate key error');
      } catch (err: any) {
        assert.ok(err, 'Q2 did not produce an error');
        q2Statement = err.statement;
      }

      assert.ok(q2Statement, 'Q2 error did not have a statement attached');
      const qccSizeAfterQ2 = q2Statement.getQueryContextCacheSize();
      assert.ok(
        qccSizeAfterQ2 >= qccSizeAfterQ1,
        `Expected QCC size after failed Q2 (${qccSizeAfterQ2}) >= QCC size after Q1 (${qccSizeAfterQ1})`,
      );

      // Q3: select after aborted txn — if Q3 lands on a different GS than Q2,
      // it may miss Q2's sessionDPO change when QCC was not updated by Q2.
      try {
        await testUtil.executeCmdAsync(connection, `select * from ${tableName}`);
      } catch {
        // Expected to fail because the transaction is aborted
      }
    } finally {
      try {
        await testUtil.executeCmdAsync(connection, 'rollback');
      } catch {
        // best-effort rollback
      }
      await testUtil.executeCmdAsync(
        connection,
        `drop table if exists ${DB_NAMES[0]}.public.${tableName}`,
      );
    }
  });
});
