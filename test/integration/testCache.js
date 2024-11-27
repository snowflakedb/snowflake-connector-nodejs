const Util = require('../../lib/util');
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const assert = require('assert');

describe('Validate cache permissions test', async function () {
  if (os.platform() !== 'win32') {
    const invalidPermissionsFilePath = path.join(os.homedir(), 'invalid_permissions');
    const validPermissionsFilePath = path.join(os.homedir(), 'valid_permissions');

    before(async function () {
      await fs.writeFile(invalidPermissionsFilePath, '', { mode: 0o777 });
      await fs.writeFile(validPermissionsFilePath, '', { mode: 0o600 });
    });

    after(async function () {
      await fs.unlink(invalidPermissionsFilePath);
      await fs.unlink(validPermissionsFilePath);
    });

    it('should return error on insecure permissions', async function () {
      await assert.rejects(async () => await Util.validateFilePermissions(invalidPermissionsFilePath));
    });

    it('should execute successfully on secure permissions', async function () {
      await assert.doesNotReject(async () => await Util.validateFilePermissions(validPermissionsFilePath));
    });
  }
});