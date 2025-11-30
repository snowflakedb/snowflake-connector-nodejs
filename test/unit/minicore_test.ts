import assert from 'assert';
import sinon from 'sinon';
import { getMinicoreVersion } from '../../lib/minicore';

describe('Minicore', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns correct version', () => {
    const version = getMinicoreVersion();
    assert.strictEqual(version, '0.0.1');
  });

  it('returns failed-to-load when binary fails to load', () => {
    delete require.cache[require.resolve('../../lib/minicore')];
    sinon.stub(process, 'platform').value('dummy-test-platform');
    const minicoreModule = require('../../lib/minicore') as typeof import('../../lib/minicore');
    const version = minicoreModule.getMinicoreVersion();
    assert.strictEqual(version, 'failed-to-load');
  });
});
