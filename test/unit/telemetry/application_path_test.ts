import assert from 'assert';
import sinon from 'sinon';
import * as applicationPathModule from '../../../lib/telemetry/application_path';

describe('getApplicationPath()', () => {
  beforeEach(() => {
    sinon.stub(applicationPathModule, 'TESTABLE_REQUIRE_REFERENCE').value(undefined);
    sinon.stub(process, 'argv').value([]);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns null when both require and process.argv are empty', () => {
    assert.strictEqual(applicationPathModule.getApplicationPath(), null);
  });

  it('returns require.main.filename when available', () => {
    sinon
      .stub(applicationPathModule, 'TESTABLE_REQUIRE_REFERENCE')
      .value({ main: { filename: 'filename.js' } });
    assert.strictEqual(applicationPathModule.getApplicationPath(), 'filename.js');
  });

  it('returns process.argv[1] when require.main.filename is not available', () => {
    sinon.stub(process, 'argv').value(['node', 'filename.js']);
    assert.strictEqual(applicationPathModule.getApplicationPath(), 'filename.js');
  });
});
