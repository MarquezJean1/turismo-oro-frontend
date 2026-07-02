import { API_BASE } from "@/services/turismo.api";

const AUTH_STORAGE_KEY = "turismo_auth_session";

export type AuthSession = {
  token: string;
  expiresAt: string;
  usuario: string;
  colorHex: string;
};

type ApiError = { mensaje?: string; message?: string };

function parseError(response: Response, fallback: string): Promise<string> {
  return response
    .json()
    .then((data: ApiError) => data.mensaje ?? data.message ?? fallback)
    .catch(() => fallback);
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as AuthSession;
    if (!session.token || !session.expiresAt) return null;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      clearStoredSession();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAuthToken(): string | null {
  return getStoredSession()?.token ?? null;
}

export async function obtenerColorTema(): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/theme-color`);

  if (!response.ok) {
    return "#ff385c";
  }

  const data = (await response.json()) as { colorHex?: string };
  return data.colorHex ?? "#ff385c";
}

export async function iniciarSesion(usuario: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "No se pudo iniciar sesión."));
  }

  const data = (await response.json()) as AuthSession;
  storeSession(data);
  return data;
}

export async function obtenerSesion(token: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Sesión no válida."));
  }

  const data = (await response.json()) as AuthSession;
  storeSession(data);
  return data;
}

export async function actualizarColor(token: string, colorHex: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/color`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ colorHex }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "No se pudo guardar el color."));
  }

  const data = (await response.json()) as { colorHex: string };
  const session = getStoredSession();
  if (session) {
    storeSession({ ...session, colorHex: data.colorHex });
  }

  return data.colorHex;
}

export function cerrarSesion(): void {
  clearStoredSession();
}
