export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const r = await fetch("/api" + path, {
    method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
    headers: opts.body ? { "content-type": "application/json" } : undefined,
    body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined),
    credentials: "same-origin",
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || `Request failed (${r.status}).`, r.status);
  return j as T;
}

/** Download a file from the API (reports). */
export async function download(path: string, fallbackName: string) {
  const r = await fetch("/api" + path, { credentials: "same-origin" });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new ApiError(j.error || "Download failed.", r.status); }
  const cd = r.headers.get("content-disposition") || "";
  const name = /filename="([^"]+)"/.exec(cd)?.[1] || fallbackName;
  const url = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
