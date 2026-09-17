const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
const ACCESS_KEY = "darukaa_token";
const REFRESH_KEY = "darukaa_refresh_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

function buildHeaders(options?: RequestInit, token?: string | null): Headers {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type") && options?.body) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return body.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join("; ");
  } catch {
    // Fall through to the generic HTTP error.
  }
  return `Request failed (${response.status})`;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    return null;
  }

  const tokens = (await response.json()) as RefreshResponse;
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  return tokens.access_token;
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const request = async (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...options,
      headers: buildHeaders(options, token),
    });

  let token = localStorage.getItem(ACCESS_KEY);
  let response = await request(token);

  if (response.status === 401 && token && !path.startsWith("/auth/")) {
    token = await refreshAccessToken();
    if (token) response = await request(token);
  }

  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
