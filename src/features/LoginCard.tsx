// 登录小卡片:左表单(手机验证码/坐标号双入口)+右插画。登录成功直接进工作台,全站只有这两个界面。
import { useEffect, useState } from 'react';
import { loginAccount, loginPhone, requestCode, saveToken } from '../client/auth';
import loginArt from '../assets/login-art.jpg';

type Mode = 'phone' | 'id';

export function LoginCard({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<Mode>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // 新注册:第二步展示坐标号(即登录密码)
  const [fresh, setFresh] = useState<{ token: string; coordinateId: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : '登录失败,请重试');
    setBusy(false);
  };

  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    setError(null);
    setBusy(true);
    try {
      const res = await requestCode(phone);
      setCooldown(60);
      if (res.dev) setError(null);
    } catch (e) {
      fail(e);
      return;
    }
    setBusy(false);
  };

  const submitPhone = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await loginPhone(phone, code);
      if (res.registered) {
        setFresh({ token: res.token, coordinateId: res.user.coordinateId });
        setBusy(false);
        return;
      }
      saveToken(res.token);
      onAuthed();
    } catch (e) {
      fail(e);
    }
  };

  const submitId = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await loginAccount(accountPhone, accountCode);
      saveToken(res.token);
      onAuthed();
    } catch (e) {
      fail(e);
    }
  };

  const enterFresh = () => {
    if (!fresh) return;
    saveToken(fresh.token);
    onAuthed();
  };

  return (
    <main className="login-page">
      <div className="login-card">
        <section className="login-form" aria-label="登录">
          <p className="login-logo">DIMSPACE</p>
          <p className="login-welcome">Welcome back 🧡</p>
          <h1>{fresh ? '注册成功' : 'Log In'}</h1>
          {fresh ? (
            <div className="login-fresh">
              <p className="login-fresh-tip">这是你的坐标号,它就是你的登录密码,请牢记:</p>
              <p className="login-fresh-id" aria-label="你的坐标号">{fresh.coordinateId}</p>
              <button className="login-submit" type="button" onClick={enterFresh}>进入工作台</button>
            </div>
          ) : (
            <>
              <div className="login-tabs" role="tablist" aria-label="登录方式">
                <button type="button" role="tab" aria-selected={mode === 'phone'} className={mode === 'phone' ? 'on' : ''} onClick={() => { setMode('phone'); setError(null); }}>手机验证码</button>
                <button type="button" role="tab" aria-selected={mode === 'id'} className={mode === 'id' ? 'on' : ''} onClick={() => { setMode('id'); setError(null); }}>账号密码登录</button>
              </div>
              {mode === 'phone' ? (
                <>
                  <label className="login-field">手机号<input inputMode="numeric" autoComplete="tel" placeholder="13800000000" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                  <div className="login-code-row">
                    <label className="login-field">验证码<input inputMode="numeric" autoComplete="one-time-code" placeholder="6位数字" value={code} onChange={(e) => setCode(e.target.value)} /></label>
                    <button className="login-code-btn" type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `${cooldown}s` : '发送验证码'}</button>
                  </div>
                  <p className="login-hint">开发阶段验证码固定为 123456。新手机号登录将自动注册。</p>
                </>
              ) : (
                <>
                  <label className="login-field">手机号(账号)<input inputMode="numeric" autoComplete="username" placeholder="注册时的手机号" value={accountPhone} onChange={(e) => setAccountPhone(e.target.value)} /></label>
                  <label className="login-field">坐标号(密码)<input autoComplete="current-password" placeholder="XYZ 开头的坐标号" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} /></label>
                  <p className="login-hint">手机号就是账号,坐标号就是密码。</p>
                </>
              )}
              {error && <p className="login-error" role="alert">{error}</p>}
              <button className="login-submit" type="button" disabled={busy} onClick={() => void (mode === 'phone' ? submitPhone() : submitId())}>LOGIN</button>
            </>
          )}
        </section>
        <aside className="login-art" aria-hidden="true">
          <img src={loginArt} alt="" />
          <p>你的 AI 项目负责人</p>
        </aside>
      </div>
    </main>
  );
}
