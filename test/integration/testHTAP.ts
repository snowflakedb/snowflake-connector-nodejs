import assert from 'assert';
import crypto from 'crypto';
import * as testUtil from './testUtil';
import { valid as connOption } from './connectionOptions';

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
