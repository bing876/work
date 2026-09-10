// 双界面开关:无 Token/Token 失效 -> 登录小卡片;有效 -> 工作台(mock 模式不经过这里)。
import { useEffect, useState } from 'react';
import { clearToken, fetchMe, getToken, saveUser, subscribeUnauthorized } from '../client/auth';
import { LoginCard } from '../features/LoginCard';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'login' | 'authed'>(() => (getToken() ? 'checking' : 'login'));

  useEffect(() => {
    let alive = true;
    const off = subscribeUnauthorized(() => {
      if (alive) setStatus('login');
    });
    const token = getToken();
    if (!token) {
      setStatus('login');
      return () => {
        alive = false;
        off();
      };
    }
    fetchMe(token)
      .then((me) => {
        if (alive) {
          saveUser(me);
          setStatus('authed');
        }
      })
      .catch(() => {
        if (alive) {
          clearToken();
          setStatus('login');
        }
      });
    return () => {
      alive = false;
      off();
    };
  }, []);

  if (status === 'login') return <LoginCard onAuthed={() => setStatus('authed')} />;
  if (status === 'checking') return <main className="loading-shell">正在验证登录…</main>;
  return <>{children}</>;
}
