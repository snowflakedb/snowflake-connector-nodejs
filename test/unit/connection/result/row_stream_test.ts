import assert from 'assert';
import { Readable } from 'stream';
import RowStream from '../../../../lib/connection/result/row_stream';
import ConnectionConfig from '../../../../lib/connection/connection_config';

describe('RowStream', function () {
  const mandatoryConnectionOptions = {
    username: 'username',
    password: 'password',
    account: 'account',
  };

  function createRowStream(connectionConfig: InstanceType<typeof ConnectionConfig>) {
    const statement = { getColumns: () => [] };
    const context = { connectionConfig };
    return new RowStream(statement, context) as unknown as Readable;
  }

  it('uses default rowStreamHighWaterMark of 10', function () {
    const config = new ConnectionConfig(mandatoryConnectionOptions);
    const stream = createRowStream(config);
    assert.strictEqual(stream.readableHighWaterMark, 10);
  });

  it('uses custom rowStreamHighWaterMark when passed in connection config', function () {
    const config = new ConnectionConfig({
      ...mandatoryConnectionOptions,
      rowStreamHighWaterMark: 25,
    });
    const stream = createRowStream(config);
    assert.strictEqual(stream.readableHighWaterMark, 25);
  });
});
