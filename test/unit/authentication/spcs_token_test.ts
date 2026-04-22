import sinon from 'sinon';
import assert from 'assert';
import fs from 'fs';
import { getSpcsToken } from '../../../lib/authentication/spcs_token';
import Logger from '../../../lib/logger';

describe('getSpcsToken', () => {
  afterEach(() => {
    sinon.restore();
  });

  function mockSPCSEnv() {
    sinon.stub(process, 'env').value({ ...process.env, SNOWFLAKE_RUNNING_INSIDE_SPCS: 'true' });
  }

  it('returns null when SNOWFLAKE_RUNNING_INSIDE_SPCS is not set', () => {
    assert.strictEqual(getSpcsToken(), null);
  });

  it('returns null and logs warning when token file does not exist', () => {
    mockSPCSEnv();
    const logWarnSpy = sinon.spy(Logger(), 'warn');
    assert.strictEqual(getSpcsToken(), null);
    assert.strictEqual(logWarnSpy.calledOnce, true);
    assert.match(logWarnSpy.firstCall.args[0], /Failed to read SPCS token/);
  });

  it('returns token from /snowflake/session/spcs_token', () => {
    mockSPCSEnv();
    sinon
      .stub(fs, 'readFileSync')
      .withArgs('/snowflake/session/spcs_token', 'utf-8')
      .returns('test-token');
    assert.strictEqual(getSpcsToken(), 'test-token');
  });

  it('trims whitespace from the token', () => {
    mockSPCSEnv();
    sinon
      .stub(fs, 'readFileSync')
      .withArgs('/snowflake/session/spcs_token', 'utf-8')
      .returns('  token-with-spaces  \n');
    assert.strictEqual(getSpcsToken(), 'token-with-spaces');
  });
});
