import type * as fs from 'fs';
import * as FilesystemAccess from '../filesystem_access';

const { assertFilesystemAccessAllowed } = FilesystemAccess;

/**
 * Hardcoded multipart tuning.
 * NOT user-configurable until universal-driver would align configuration API.
 */

/** Switch to a multipart/chunked upload above this total file size. Matching Go, Python, JDBC value. */
export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;

/**
 * Size of each uploaded part/chunk.
 *
 * This size directly bounds the largest file we can upload, because every cloud
 * storage provider caps how many parts/blocks a single object may contain.
 * Maximum uploadable file size = part size * provider part limit, so SMALLER
 * chunks LOWER the ceiling (and we hit the provider limit sooner):
 *
 *   - AWS S3:  max 10,000 parts per object.
 *              At 8 MiB/part => ~78.1 GiB. (S3's own object max is 48.8 TiB,
 *              so the part count is the binding limit here.)
 *   - Azure:   max 50,000 blocks per block blob.
 *              At 8 MiB/block => ~390.6 GiB.
 *   - GCS:     resumable uploads have no fixed chunk count; the binding limit
 *              is the 5 TiB max object size. The chunk size must additionally
 *              be a multiple of 256 KiB (enforced below).
 *
 * The tightest cap is S3 (~78 GiB at 8 MiB/part). If this value is reduced,
 * recompute the per-provider ceilings above and confirm the smallest one still
 * comfortably exceeds the largest files we expect to upload.
 */
export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;

/**
 * GCS resumable uploads require every chunk except the final one to be a
 * multiple of 256 KiB. `MULTIPART_PART_SIZE_BYTES` is reused as the GCS chunk
 * size, so it must satisfy this alignment.
 */
const GCS_CHUNK_GRANULARITY_BYTES = 256 * 1024;
if (MULTIPART_PART_SIZE_BYTES % GCS_CHUNK_GRANULARITY_BYTES !== 0) {
  throw new Error(
    `MULTIPART_PART_SIZE_BYTES (${MULTIPART_PART_SIZE_BYTES}) must be a multiple of ` +
      `GCS_CHUNK_GRANULARITY_BYTES (${GCS_CHUNK_GRANULARITY_BYTES}) for GCS resumable uploads.`,
  );
}

/**
 * Read exactly `size` bytes (capped at MULTIPART_PART_SIZE_BYTES by the caller)
 * from `fd` starting at `position`, into a fresh Buffer. Throws on a short read
 * so a caller never uploads a partial part.
 *
 * The caller owns the fd lifecycle and the loop/advancement; this only does the
 * allocate + read + validate that is identical across S3, Azure, and GCS.
 *
 * allocUnsafe is used because the buffer is filled immediately by fd.read and
 * the bytesRead check below throws before any uninitialized memory could be
 * observed by a caller. Zero-fill would be wasted I/O on multi-GiB uploads.
 */
export async function readChunk(
  fd: fs.promises.FileHandle,
  position: number,
  size: number,
): Promise<Buffer> {
  assertFilesystemAccessAllowed();
  const buffer = Buffer.allocUnsafe(size);
  const { bytesRead } = await fd.read(buffer, 0, size, position);
  if (bytesRead !== size) {
    throw new Error(`Short read at offset ${position}: expected ${size} bytes, got ${bytesRead}`);
  }
  return buffer;
}
