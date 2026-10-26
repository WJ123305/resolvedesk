export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
let csrf: { token: string; headerName: string } | null = null;
export async function refreshCsrf() {
  const response = await fetch("/api/csrf", {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok)
    throw new ApiError(response.status, "无法连接服务，请确认后端已启动");
  csrf = await response.json();
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = options.method || "GET";
  if (method !== "GET" && !csrf) await refreshCsrf();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof URLSearchParams))
    headers.set("Content-Type", "application/json");
  if (method !== "GET" && csrf) headers.set(csrf.headerName, csrf.token);
  const response = await fetch("/api" + path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401 && !["/login", "/me"].includes(path))
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(
      response.status,
      payload.message || payload.detail || "请求失败，请稍后重试",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
