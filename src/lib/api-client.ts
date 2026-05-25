/**
 * Typed client for the FastAPI backend (see /backend).
 * Set VITE_API_BASE_URL to enable. Token is stored in localStorage under "lumen_jwt".
 */
const BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;
const TOKEN_KEY = "lumen_jwt";

export const fastApiEnabled = () => Boolean(BASE);

export function getToken(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
}
export function setToken(t: string | null) {
  if (typeof localStorage === "undefined") return;
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE) throw new Error("VITE_API_BASE_URL not configured");
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  email: string;
}
export interface ApiDocument {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "error";
  summary?: string | null;
  error?: string | null;
}
export interface ChatSource {
  content: string;
  score: number;
  document_id: string;
  filename: string;
  chunk: number;
}
export interface ChatAnswer {
  answer: string;
  sources: ChatSource[];
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ id: string; email: string }>("/auth/me"),
  listDocuments: () => request<ApiDocument[]>("/documents"),
  uploadDocument: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ApiDocument>("/documents/upload", { method: "POST", body: fd });
  },
  deleteDocument: (id: string) => request<{ ok: boolean }>(`/documents/${id}`, { method: "DELETE" }),
  ask: (question: string, k = 6) =>
    request<ChatAnswer>("/chat/ask", { method: "POST", body: JSON.stringify({ question, k }) }),
  search: (query: string, k = 8) =>
    request<{ results: ChatSource[] }>("/search", { method: "POST", body: JSON.stringify({ query, k }) }),
};
