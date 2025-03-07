const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { createFsMock, wrongOwner, mockFiles } = require('../unit/mock/mock_file');
const { validateOnlyUserReadWritePermissionAndOwner } = require('../../lib/file_util');
const mock = require('mock-require');

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
      await assert.rejects(
        validateOnlyUserReadWritePermissionAndOwner(invalidPermissionsFilePath),
        (err) => {
          assert.match(err.message, /Invalid file permissions/);
          return true;
        },
      );
    });

    it('should return error when system user is not a file owner', async function () {
      const anotherFileOwnerPath = path.join(wrongOwner);
      const fsMock = createFsMock()
        .mockFile(anotherFileOwnerPath, 'test');
      mockFiles(fsMock);
      const fsPromises = require('fs/promises');
      await assert.rejects(
        validateOnlyUserReadWritePermissionAndOwner(anotherFileOwnerPath, fsPromises),
        (err) => {
          assert.match(err.message, /Invalid file owner/);
          return true;
        },
      );
      mock.stop('fs/promises');
    });

    it('should execute successfully on secure permissions', async function () {
      await assert.doesNotReject(async () => await validateOnlyUserReadWritePermissionAndOwner(validPermissionsFilePath));
    });
  }
});