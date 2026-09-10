// 登录弹窗:左海报(占满+箭头切换)+右表单。逻辑:默认账号密码登录(坐标号=账号,手机号=密码),
// 点注册切验证码登录(新手机号自动获配坐标号)。海报配置见 login-posters.ts。
import { useEffect, useState } from 'react';
import { loginAccount, loginPhone, requestCode, saveToken } from '../client/auth';
import { LOGIN_POSTERS } from './login-posters';

type Mode = 'code' | 'account';

export function LoginCard({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<Mode>('account');
  const [poster, setPoster] = useState(0);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accountId, setAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // 新手机号:第二步展示坐标号(即登录账号)
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
      await requestCode(phone);
      setCooldown(60);
    } catch (e) {
      fail(e);
      return;
    }
    setBusy(false);
  };

  const submitCode = async () => {
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

  const submitAccount = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await loginAccount(phone, accountId);
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

  const goRegister = () => {
    setMode('code');
    setError(null);
  };

  const current = LOGIN_POSTERS[poster % LOGIN_POSTERS.length];
  const step = (delta: number) => setPoster((p) => (p + delta + LOGIN_POSTERS.length) % LOGIN_POSTERS.length);

  return (
    <main className="login-page">
      <div className="login-modal" role="dialog" aria-label="登录">
        <aside className="login-poster">
          <img key={current.src} src={current.src} alt="" />
          <p className="login-poster-brand">零度之上</p>
          <p className="login-poster-caption">{current.caption}</p>
          <div className="login-poster-nav">
            <button type="button" aria-label="上一张海报" onClick={() => step(-1)}>←</button>
            <button type="button" aria-label="下一张海报" onClick={() => step(1)}>→</button>
          </div>
        </aside>
        <section className="login-form" aria-label="登录表单">
          {fresh ? (
            <div className="login-fresh">
              <p className="login-fresh-tip">注册成功!这是你的坐标号,它就是你的登录账号,请牢记:</p>
              <p className="login-fresh-id" aria-label="你的坐标号">{fresh.coordinateId}</p>
              <button className="login-submit" type="button" onClick={enterFresh}>进入工作台</button>
            </div>
          ) : (
            <>
              <div className="login-tabs" role="tablist" aria-label="登录方式">
                <button type="button" role="tab" aria-selected={mode === 'account'} className={mode === 'account' ? 'on' : ''} onClick={() => { setMode('account'); setError(null); }}>账号密码登录</button>
                <button type="button" role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => { setMode('code'); setError(null); }}>验证码登录</button>
              </div>
              {mode === 'account' ? (
                <>
                  <label className="login-box"><span className="login-visually-hidden">坐标号</span><input aria-label="坐标号" autoComplete="username" placeholder="请输入坐标号" value={accountId} onChange={(e) => setAccountId(e.target.value)} /></label>
                  <label className="login-box"><span className="login-visually-hidden">手机号</span><input aria-label="手机号" inputMode="numeric" autoComplete="current-password" placeholder="请输入手机号" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
                  <p className="login-hint">坐标号就是账号,手机号就是密码。</p>
                </>
              ) : (
                <>
                  <div className="login-box login-phone">
                    <select aria-label="国家区号" value="86" onChange={() => {}}><option value="86">+86</option></select>
                    <span className="login-visually-hidden">手机号</span><input aria-label="手机号" inputMode="numeric" autoComplete="tel" placeholder="请输入手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="login-code-row">
                    <label className="login-box"><span className="login-visually-hidden">验证码</span><input aria-label="验证码" inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" value={code} onChange={(e) => setCode(e.target.value)} /></label>
                    <button className="login-code-btn" type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `${cooldown}s` : '获取验证码'}</button>
                  </div>
                </>
              )}
              {error && <p className="login-error" role="alert">{error}</p>}
              {mode === 'code' ? (
                <button className="login-submit" type="button" disabled={busy} onClick={() => void submitCode()}>登录 / 注册</button>
              ) : (
                <div className="login-btn-row">
                  <button className="login-register" type="button" onClick={goRegister}>注册</button>
                  <button className="login-submit" type="button" disabled={busy} onClick={() => void submitAccount()}>登录</button>
                </div>
              )}
              <div className="login-or" aria-hidden="true"><span>或</span></div>
              <button className="login-wechat" type="button" disabled title="微信登录即将上线"><span aria-hidden="true">💬</span>微信登录·即将上线</button>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
