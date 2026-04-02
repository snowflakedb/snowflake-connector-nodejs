import sinon from 'sinon';
import assert from 'assert';
import fs from 'fs';
import { getSpcsToken } from '../../../lib/authentication/spcs_token';

describe('getSpcsToken', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null when SNOWFLAKE_RUNNING_INSIDE_SPCS is not set', () => {
    assert.strictEqual(getSpcsToken(), null);
  });

  it('returns null when token file does not exist', () => {
    sinon.stub(process, 'env').value({ ...process.env, SNOWFLAKE_RUNNING_INSIDE_SPCS: 'true' });
    assert.strictEqual(getSpcsToken(), null);
  });

  it('returns token from /snowflake/session/spcs_token', () => {
    sinon.stub(process, 'env').value({ ...process.env, SNOWFLAKE_RUNNING_INSIDE_SPCS: 'true' });
    sinon
      .stub(fs, 'readFileSync')
      .withArgs('/snowflake/session/spcs_token', 'utf-8')
      .returns('test-token');
    assert.strictEqual(getSpcsToken(), 'test-token');
  });

  it('trims whitespace from the token', () => {
    sinon.stub(process, 'env').value({ ...process.env, SNOWFLAKE_RUNNING_INSIDE_SPCS: 'true' });
    sinon
      .stub(fs, 'readFileSync')
      .withArgs('/snowflake/session/spcs_token', 'utf-8')
      .returns('  token-with-spaces  \n');
    assert.strictEqual(getSpcsToken(), 'token-with-spaces');
  });
});
