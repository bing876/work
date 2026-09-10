// 登录态:Token 存 localStorage;账号接口直调;401 广播供 AuthGate 回登录卡。
export interface AuthUser {
  id: number;
  phone: string;
  coordinateId: string;
  created_at: string;
}

const TOKEN_KEY = 'dimspace-token';
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const saveToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 私有模式忽略 */
  }
};

type Listener = () => void;
const listeners = new Set<Listener>();
export const subscribeUnauthorized = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const notifyUnauthorized = (): void => {
  clearToken();
  listeners.forEach((fn) => fn());
};
export const logout = (): void => {
  clearToken();
  window.location.reload();
};

const parseBody = async <T>(res: Response): Promise<T> => {
  const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!res.ok || !data || data.ok !== true) {
    throw new Error(typeof data?.error === 'string' ? data.error : `请求失败(${res.status})`);
  }
  return data as T;
};

const post = async <T>(path: string, body: unknown, token?: string | null): Promise<T> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('连不上后端服务,请确认后端已启动');
  }
  return parseBody<T>(res);
};

export const requestCode = (phone: string): Promise<{ dev: boolean; message: string }> =>
  post('/api/auth/code', { phone });

export const loginPhone = (phone: string, code: string): Promise<{ token: string; registered: boolean; needPassword: boolean; user: AuthUser; message?: string }> =>
  post('/api/auth/login-phone', { phone, code });

export const loginId = (coordinateId: string, password: string): Promise<{ token: string; user: AuthUser }> =>
  post('/api/auth/login-id', { coordinateId, password });

export const setPassword = (password: string, token: string): Promise<{ ok: true }> =>
  post('/api/auth/set-password', { password }, token);

export const fetchMe = async (token: string): Promise<AuthUser> => {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    throw new Error('连不上后端服务,请确认后端已启动');
  }
  return (await parseBody<{ user: AuthUser }>(res)).user;
};
