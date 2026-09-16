export const fetcher = (url: string) => fetch(url).then((r) => r.json());

export async function api<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error ?? "请求失败";
    throw new Error(msg);
  }
  return data as T;
}
