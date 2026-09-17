import { api } from "./api";

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  role: "admin" | "viewer";
}

export const ACCESS_KEY = "darukaa_token";
export const REFRESH_KEY = "darukaa_refresh_token";

export function storeTokens(tokens: AuthTokens) {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function hasToken(): boolean {
  return Boolean(localStorage.getItem(ACCESS_KEY));
}

export async function registerUser(email: string, password: string): Promise<CurrentUser> {
  return api<CurrentUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function loginUser(email: string, password: string): Promise<AuthTokens> {
  const tokens = await api<AuthTokens>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  storeTokens(tokens);
  return tokens;
}

export function logoutUser() {
  clearTokens();
}


export function getCurrentUser(): Promise<CurrentUser> {
  return api<CurrentUser>("/auth/me");
}
