export const FILESYSTEM_ACCESS_BLOCKED_ERROR_CODE: number;

export class FilesystemAccessBlockedError extends Error {
  code: number;
}

export function assertFilesystemAccessAllowed(): void;
export function isFilesystemAccessBlocked(): boolean;
export function setBlockFilesystemAccess(value: boolean): void;
