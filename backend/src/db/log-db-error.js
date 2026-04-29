/**
 * Surface errno / syscall / Postgres cause chains (postgres-js + Drizzle often wrap the real fault).
 */
export function formatDbQueryError(error) {
  const parts = [error?.message ?? String(error)];
  let nested = error?.cause ?? error?.originalError;
  let depth = 0;
  while (nested && depth < 8) {
    const msg = nested?.message ?? nested?.detail ?? nested?.routine ?? nested;
    if (msg != null) parts.push(String(msg));
    nested = nested?.cause ?? nested?.originalError;
    depth += 1;
  }
  return parts.filter(Boolean).join(' | ');
}

export function summarizeDbConnectivityError(error) {
  const e = /** @type {NodeJS.ErrnoException & { syscall?: string; address?: string; port?: number }} */ (error);
  const out = {};
  if (e?.code != null) out.errCode = e.code;
  if (e?.errno != null) out.errno = e.errno;
  if (e?.syscall != null) out.syscall = e.syscall;
  if (e?.address != null) out.address = e.address;
  if (e?.port != null) out.port = e.port;
  return out;
}
