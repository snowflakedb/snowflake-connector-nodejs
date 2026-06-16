/**
 * Test doubles shared across the S3/Azure/GCS file-transfer-agent unit tests.
 */

type ChunkRead = (buf: Buffer, offset: number, length: number) => Promise<{ bytesRead: number }>;

/**
 * Build a fake `fs.promises.FileHandle` for the chunked-upload codepaths.
 *
 * The default `read()` serves `fileSize` total bytes in request-sized,
 * zero-filled chunks — the multipart tests assert on chunk count and offsets,
 * not the actual bytes. Pass `read` to simulate odd reads (e.g. a file that
 * shrinks mid-upload, producing a short read).
 *
 * Each provider stubs `fs.promises.open` to resolve to this handle, mirroring
 * how the production code shares `readChunk` across S3, Azure, and GCS.
 */
export function fakeFileHandle(fileSize: number, read?: ChunkRead) {
  let position = 0;
  const defaultRead: ChunkRead = async (buf, offset, length) => {
    const toRead = Math.min(length, Math.max(0, fileSize - position));
    buf.fill(0, offset, offset + toRead);
    position += toRead;
    return { bytesRead: toRead };
  };
  return {
    read: read ?? defaultRead,
    close: async () => {},
  };
}
