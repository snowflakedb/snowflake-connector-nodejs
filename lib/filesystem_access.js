const FILESYSTEM_ACCESS_BLOCKED_ERROR_CODE = 403010;

let blockFilesystemAccess = false;

class FilesystemAccessBlockedError extends Error {
  constructor() {
    super('Filesystem access is blocked by the blockFilesystemAccess configuration option.');
    this.name = 'FilesystemAccessBlockedError';
    this.code = FILESYSTEM_ACCESS_BLOCKED_ERROR_CODE;
  }
}

function setBlockFilesystemAccess(value) {
  blockFilesystemAccess = value;
}

function isFilesystemAccessBlocked() {
  return blockFilesystemAccess;
}

function assertFilesystemAccessAllowed() {
  if (blockFilesystemAccess) {
    throw new FilesystemAccessBlockedError();
  }
}

module.exports = {
  FILESYSTEM_ACCESS_BLOCKED_ERROR_CODE,
  FilesystemAccessBlockedError,
  assertFilesystemAccessAllowed,
  isFilesystemAccessBlocked,
  setBlockFilesystemAccess,
};
