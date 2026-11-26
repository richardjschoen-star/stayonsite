import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({ basePath: "/api/auth", plugins: [emailOTPClient()] });

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** JSON call to /api/portal. Throws ApiError with the server's message. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/portal/${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? res.statusText);
  return data as T;
}

/** Streams a file to R2 through the Worker, reporting progress (fetch can't). */
export function upload<T>(params: Record<string, string | null | undefined>, file: File, onProgress?: (pct: number) => void) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  qs.set("name", file.name);
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/portal/file?${qs}`);
    xhr.setRequestHeader("content-type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      const data = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return null;
        }
      })();
      if (xhr.status < 300) resolve(data as T);
      else reject(new ApiError(xhr.status, data?.error ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new ApiError(0, "Upload failed. Check your connection."));
    xhr.send(file);
  });
}

export const fileUrl = (id: string, download = false) => `/api/portal/file/${id}${download ? "?download=1" : ""}`;
