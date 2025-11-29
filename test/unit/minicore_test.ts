import assert from 'assert';
import sinon from 'sinon';
import Module from 'module';
import { getMinicoreVersion } from '../../lib/minicore';

describe('Minicore', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns correct version', () => {
    const version = getMinicoreVersion();
    assert.strictEqual(version, '0.0.1');
  });

  it('returns failed-to-load when binary fails to load', async () => {
    delete require.cache[require.resolve('../../lib/minicore')];
    sinon
      .stub(Module.prototype, 'require')
      .callThrough()
      .withArgs(sinon.match(/^\.\/dist\//))
      .callsFake(() => {
        throw new Error('Failed to load binary');
      });
    const minicoreModule = require('../../lib/minicore') as typeof import('../../lib/minicore');
    const version = minicoreModule.getMinicoreVersion();
    assert.strictEqual(version, 'failed-to-load');
  });
});
