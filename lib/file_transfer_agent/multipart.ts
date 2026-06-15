/**
 * Hardcoded multipart tuning.
 * NOT user-configurable until universal-driver would align configuration API.
 */

/** Switch to a multipart/chunked upload above this total file size. Matching Go, Python, JDBC value. */
export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;

/** Size of each uploaded part/chunk. */
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
