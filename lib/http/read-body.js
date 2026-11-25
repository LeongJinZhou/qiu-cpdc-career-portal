function tooLarge() {
  const error = new Error('Request body is too large.');
  error.status = 413;
  error.code = 'FILE_TOO_LARGE';
  return error;
}

/**
 * Read a request body into a Buffer, stopping as soon as it passes `maxBytes`.
 * Does not trust Content-Length alone: a chunked upload has none, and
 * request.formData() would buffer the whole body before any size check.
 */
export async function readBodyWithLimit(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw tooLarge();
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
