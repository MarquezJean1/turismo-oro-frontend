import { API_BASE } from "@/services/turismo.api";

const AUTH_STORAGE_KEY = "turismo_auth_session";

export type AuthSession = {
  token: string;
  expiresAt: string;
  usuario: string;
  colorHex: string;
  isAdministrador: boolean;
};

export type UsuarioAdmin = {
  id: string;
  nombreUsuario: string;
  isAdministrador: boolean;
  active: boolean;
  enumAprobacion: string;
  createdAt: string;
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

    session.isAdministrador = session.isAdministrador ?? false;

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
  const session: AuthSession = {
    ...data,
    isAdministrador: data.isAdministrador ?? false,
  };
  storeSession(session);
  return session;
}

export async function registrarUsuario(usuario: string, password: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "No se pudo registrar el usuario."));
  }

  const data = (await response.json()) as { mensaje?: string };
  return data.mensaje ?? "Registro exitoso. Su cuenta quedará pendiente de aprobación.";
}

export async function obtenerSesion(token: string): Promise<AuthSession> {
  const response = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "Sesión no válida."));
  }

  const data = (await response.json()) as AuthSession;
  const session: AuthSession = {
    ...data,
    isAdministrador: data.isAdministrador ?? false,
  };
  storeSession(session);
  return session;
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

async function authFetch<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "No se pudo completar la operación."));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listarUsuariosActivos(token: string): Promise<UsuarioAdmin[]> {
  return authFetch<UsuarioAdmin[]>(token, "/api/usuarios/activos");
}

export async function listarUsuariosPendientes(token: string): Promise<UsuarioAdmin[]> {
  return authFetch<UsuarioAdmin[]>(token, "/api/usuarios/pendientes");
}

export async function listarUsuariosArchivados(token: string): Promise<UsuarioAdmin[]> {
  return authFetch<UsuarioAdmin[]>(token, "/api/usuarios/archivados");
}

export async function aprobarUsuario(token: string, id: string): Promise<UsuarioAdmin> {
  return authFetch<UsuarioAdmin>(token, `/api/usuarios/${id}/aprobar`, { method: "PUT" });
}

export async function rechazarUsuario(token: string, id: string): Promise<UsuarioAdmin> {
  return authFetch<UsuarioAdmin>(token, `/api/usuarios/${id}/rechazar`, { method: "PUT" });
}

export async function setUsuarioAdministrador(
  token: string,
  id: string,
  isAdministrador: boolean,
): Promise<UsuarioAdmin> {
  return authFetch<UsuarioAdmin>(token, `/api/usuarios/${id}/administrador`, {
    method: "PUT",
    body: JSON.stringify({ isAdministrador }),
  });
}
