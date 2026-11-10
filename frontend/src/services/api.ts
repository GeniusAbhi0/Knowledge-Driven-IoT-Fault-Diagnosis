import axios, { AxiosError } from "axios";
import type { AlertItem, AssistantReply, FaultFilters, FaultStatus, KnowledgeEntry, KnowledgeInput, UserItem, Role, DashboardData, Device, DeviceInput, DiagnosisReport, FaultRecord, Scenario, SeriesData, SimStatus, TickResult, User } from "../types";

export const TOKEN_KEY = "iot_token";
export const api = axios.create({baseURL: `${import.meta.env.VITE_API_URL}/api`,timeout: 15000,});

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    const isLogin = err.config?.url?.startsWith("/auth/");
    if (err.response?.status === 401 && !isLogin) window.dispatchEvent(new Event("auth:expired"));
    return Promise.reject(err);
  },
);

/** Turns any thrown error into a user-safe message (network, validation, server, auth). */
export function errorMessage(err: unknown): string {
  if (!axios.isAxiosError(err)) return "Something went wrong. Please try again.";
  if (!err.response) return "Cannot reach the server. Check your connection and try again.";
  const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const d = detail[0] as { loc?: unknown[]; msg?: string };
    return `${d.loc?.slice(-1)[0] ?? "Input"}: ${d.msg ?? "invalid value"}`;
  }
  return err.response.status >= 500 ? "The server ran into a problem. Please try again shortly." : "Request failed.";
}

export interface LoginResult { access_token: string; user: User }

export const authApi = {
  login: (email: string, password: string) => api.post<LoginResult>("/auth/login", { email, password }).then((r) => r.data),
  register: (name: string, email: string, password: string) => api.post<User>("/auth/register", { name, email, password }).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
  forgot: (email: string) => api.post<{ detail: string }>("/auth/forgot-password", { email }).then((r) => r.data),
  reset: (token: string, new_password: string) => api.post("/auth/reset-password", { token, new_password }).then((r) => r.data),
};

export const dashboardApi = {
  overview: () => api.get<DashboardData>("/dashboard").then((r) => r.data),
  series: (deviceId: number, limit = 60) => api.get<SeriesData>(`/dashboard/series/${deviceId}`, { params: { limit } }).then((r) => r.data),
};

export const devicesApi = {
  list: () => api.get<Device[]>("/devices").then((r) => r.data),
  get: (id: number) => api.get<Device>(`/devices/${id}`).then((r) => r.data),
  create: (body: DeviceInput) => api.post<Device>("/devices", body).then((r) => r.data),
  update: (id: number, body: DeviceInput) => api.put<Device>(`/devices/${id}`, body).then((r) => r.data),
  remove: (id: number) => api.delete(`/devices/${id}`).then(() => undefined),
};

export const simulatorApi = {
  scenarios: () => api.get<Scenario[]>("/simulator/scenarios").then((r) => r.data),
  status: (id: number) => api.get<SimStatus>(`/simulator/${id}`).then((r) => r.data),
  start: (id: number) => api.post<SimStatus>(`/simulator/${id}/start`).then((r) => r.data),
  stop: (id: number) => api.post<SimStatus>(`/simulator/${id}/stop`).then((r) => r.data),
  setMode: (id: number, mode: string, values?: Record<string, number>) =>
    api.put<SimStatus>(`/simulator/${id}/mode`, { mode, values }).then((r) => r.data),
  inject: (id: number, values: Record<string, number>) => api.post<SimStatus>(`/simulator/${id}/inject`, { values }).then((r) => r.data),
  reset: (id: number) => api.post<SimStatus>(`/simulator/${id}/reset`).then((r) => r.data),
  scenario: (id: number, key: string) => api.post<TickResult>(`/simulator/${id}/scenario/${key}`).then((r) => r.data),
  tick: (id: number) => api.post<TickResult>(`/simulator/${id}/tick`).then((r) => r.data),
};

export const faultsApi = {
  list: (params: { device_id?: number; limit?: number }) => api.get<FaultRecord[]>("/faults", { params }).then((r) => r.data),
  run: (device_id: number) => api.post<DiagnosisReport>("/diagnosis/run", { device_id }).then((r) => r.data),
};

/** Query params for the fault history / report endpoints (empty filters are dropped). */
export function faultParams(f: FaultFilters): Record<string, string> {
  const p: Record<string, string> = { sort: f.sort };
  if (f.device_id) p.device_id = f.device_id;
  if (f.severity) p.severity = f.severity;
  if (f.status) p.status = f.status;
  if (f.date_from) p.date_from = `${f.date_from}T00:00:00`;
  if (f.date_to) p.date_to = `${f.date_to}T23:59:59`;
  return p;
}

export const faultHistoryApi = {
  page: (params: Record<string, string | number>) =>
    api.get<FaultRecord[]>("/faults", { params }).then((r) => ({ items: r.data, total: Number(r.headers["x-total-count"] ?? r.data.length) })),
  get: (id: number) => api.get<FaultRecord>(`/faults/${id}`).then((r) => r.data),
  update: (id: number, status: FaultStatus, resolution_notes: string) => api.patch<FaultRecord>(`/faults/${id}`, { status, resolution_notes }).then((r) => r.data),
};

export const kbApi = {
  list: (q = "", severity = "") => api.get<KnowledgeEntry[]>("/knowledge-base", { params: { q, severity: severity || undefined } }).then((r) => r.data),
  create: (b: KnowledgeInput) => api.post<KnowledgeEntry>("/knowledge-base", b).then((r) => r.data),
  update: (id: number, b: KnowledgeInput) => api.put<KnowledgeEntry>(`/knowledge-base/${id}`, b).then((r) => r.data),
  remove: (id: number) => api.delete(`/knowledge-base/${id}`).then(() => undefined),
};

export const alertsApi = {
  list: (unread: boolean) => api.get<AlertItem[]>("/alerts", { params: { unread, limit: 100 } }).then((r) => r.data),
  read: (id: number) => api.patch(`/alerts/${id}/read`).then(() => undefined),
  readAll: () => api.post("/alerts/read-all").then(() => undefined),
};

export const usersApi = {
  list: () => api.get<UserItem[]>("/users").then((r) => r.data),
  setRole: (id: number, role: Role) => api.patch<UserItem>(`/users/${id}/role`, { role }).then((r) => r.data),
};

/** Authenticated file download (plain links cannot send the bearer token). */
export async function downloadFile(path: string, params: Record<string, string>, filename: string): Promise<void> {
  const { data } = await api.get<Blob>(path, { params, responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export const assistantApi = {
  ask: (question: string, device_id?: number) => api.post<AssistantReply>("/assistant/ask", { question, device_id }).then((r) => r.data),
};
