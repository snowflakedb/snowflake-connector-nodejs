import sinon from 'sinon';
import assert from 'assert';
import fs from 'fs';
import { getSpcsToken } from '../../../lib/authentication/spcs_token';

function stubTokenFile(path: string) {
  return sinon.stub(fs, 'readFileSync').withArgs(path, 'utf-8');
}

describe('getSpcsToken', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns null when token file does not exist', () => {
    assert.strictEqual(getSpcsToken(), null);
  });

  it('returns token from /snowflake/session/spcs_token', () => {
    stubTokenFile('/snowflake/session/spcs_token').returns('default-token');
    assert.strictEqual(getSpcsToken(), 'default-token');
  });

  it('returns token from custom file path set via SF_SPCS_TOKEN_PATH env var', () => {
    sinon.stub(process, 'env').value({ ...process.env, SF_SPCS_TOKEN_PATH: '/custom/path/token' });
    stubTokenFile('/custom/path/token').returns('custom-token');
    assert.strictEqual(getSpcsToken(), 'custom-token');
  });

  it('trims whitespace from the token', () => {
    stubTokenFile('/snowflake/session/spcs_token').returns('  token-with-spaces  \n');
    assert.strictEqual(getSpcsToken(), 'token-with-spaces');
  });
});
