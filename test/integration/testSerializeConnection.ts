import assert from 'assert';
import * as testUtil from './testUtil';
import { valid as connOptions } from './connectionOptions';

const snowflake = require('../../lib/snowflake').default;

describe('Connection serialize / deserialize', function () {
  let connection: any;

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('connection.serialize() returns a JSON string with services.sf.tokenInfo', () => {
    const serialized = connection.serialize();
    assert.strictEqual(typeof serialized, 'string');
    assert.ok(serialized.length > 0);

    const tokenInfo = JSON.parse(serialized)?.services?.sf?.tokenInfo;
    assert.ok(tokenInfo, 'expected services.sf.tokenInfo in serialized payload');
    assert.strictEqual(typeof tokenInfo.masterToken, 'string');
    assert.strictEqual(typeof tokenInfo.sessionToken, 'string');
    assert.strictEqual(typeof tokenInfo.masterTokenExpirationTime, 'number');
    assert.strictEqual(typeof tokenInfo.sessionTokenExpirationTime, 'number');
  });

  it('snowflake.serializeConnection() returns the same string as connection.serialize()', () => {
    assert.strictEqual(snowflake.serializeConnection(connection), connection.serialize());
  });

  it('snowflake.deserializeConnection() rehydrates into a usable Connection', async () => {
    const connection2 = snowflake.deserializeConnection(
      connOptions,
      snowflake.serializeConnection(connection),
    );
    try {
      assert.strictEqual(connection2.isUp(), true);
    } finally {
      await testUtil.destroyConnectionAsync(connection2);
    }
  });
});
