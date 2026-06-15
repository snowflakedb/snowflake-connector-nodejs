/**
 * Hardcoded multipart tuning.
 * NOT user-configurable untill universal-driver would align configuration API.
 */

/** Switch to a multipart/chunked upload above this total file size. Matching Go,Python,JDBC value. */
export const MULTIPART_THRESHOLD_BYTES = 64 * 1024 * 1024;

/** Size of each uploaded part/chunk. */
export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;
