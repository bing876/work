// 登录页:左右分屏(左品牌+右表单)。手机号登录为主,无注册概念:
// 新手机号验证码登录 -> 后台直接配坐标号;老用户验证码直进。底部坐标/微信双按钮。
import { useEffect, useState } from 'react';
import { loginAccount, loginPhone, requestCode, saveToken } from '../client/auth';
import loginArt from '../assets/login-art.jpg';

type Mode = 'code' | 'account';

const PREFIXES = [
  { code: '86', label: '+86 中国' },
  { code: '65', label: '+65 新加坡' },
  { code: '852', label: '+852 香港' },
  { code: '1', label: '+1 美国' },
];

export function LoginCard({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<Mode>('code');
  const [prefix, setPrefix] = useState('86');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // 新手机号:第二步展示坐标号(即登录密码)
  const [fresh, setFresh] = useState<{ token: string; coordinateId: string } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  // +86 按原样提交(兼容老账号);国外号段前面拼区号,各国账号互不串
  const fullPhone = (prefix === '86' ? phone : prefix + phone).replace(/\D/g, '');
  const fail = (e: unknown) => {
    setError(e instanceof Error ? e.message : '登录失败,请重试');
    setBusy(false);
  };

  const sendCode = async () => {
    if (busy || cooldown > 0) return;
    setError(null);
    setBusy(true);
    try {
      await requestCode(fullPhone);
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
      const res = await loginPhone(fullPhone, code);
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
      const res = await loginAccount(fullPhone, accountCode);
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
      <aside className="login-brand" aria-hidden="true">
        <h2>DIMSPACE<br />WORKBENCH</h2>
        <p>你的 AI 项目负责人,陪你把想法变成生意。从一次对话开始,记住你的每个决定。</p>
        <img src={loginArt} alt="" />
        <p className="login-brand-logo">◍ DIMSPACE</p>
      </aside>
      <section className="login-form" aria-label="登录">
        <p className="login-logo">DIMSPACE</p>
        <h1>{fresh ? '注册成功' : '手机号登录'}</h1>
        {!fresh && <p className="login-sub">输入手机号和验证码,进入你的工作台</p>}
        {fresh ? (
          <div className="login-fresh">
            <p className="login-fresh-tip">这是你的坐标号,它就是你的登录密码,请牢记:</p>
            <p className="login-fresh-id" aria-label="你的坐标号">{fresh.coordinateId}</p>
            <button className="login-submit" type="button" onClick={enterFresh}>进入工作台</button>
          </div>
        ) : (
          <>
            <div className="login-tabs" role="tablist" aria-label="登录方式">
              <button type="button" role="tab" aria-selected={mode === 'code'} className={mode === 'code' ? 'on' : ''} onClick={() => { setMode('code'); setError(null); }}>验证码登录</button>
              <button type="button" role="tab" aria-selected={mode === 'account'} className={mode === 'account' ? 'on' : ''} onClick={() => { setMode('account'); setError(null); }}>账号密码登录</button>
            </div>
            <label className="login-field">手机号
              <span className="login-phone-row">
                <select aria-label="国家区号" value={prefix} onChange={(e) => setPrefix(e.target.value)}>
                  {PREFIXES.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
                <input inputMode="numeric" autoComplete="tel" placeholder="请输入手机号" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </span>
            </label>
            {mode === 'code' ? (
              <div className="login-code-row">
                <label className="login-field">验证码<input inputMode="numeric" autoComplete="one-time-code" placeholder="请输入验证码" value={code} onChange={(e) => setCode(e.target.value)} /></label>
                <button className="login-code-btn" type="button" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `${cooldown}s` : '获取验证码'}</button>
              </div>
            ) : (
              <>
                <label className="login-field">坐标号(密码)<input autoComplete="current-password" placeholder="XYZ 开头的坐标号" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} /></label>
                <p className="login-hint">手机号就是账号,坐标号就是密码。</p>
              </>
            )}
            {mode === 'code' && <p className="login-hint">开发阶段验证码固定为 123456。新手机号登录将自动获配坐标号。</p>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-submit" type="button" disabled={busy} onClick={() => void (mode === 'code' ? submitCode() : submitAccount())}>登录</button>
            <div className="login-or" aria-hidden="true"><span>或</span></div>
            <div className="login-alt-row">
              <button type="button" className={mode === 'account' ? 'on' : ''} onClick={() => { setMode('account'); setError(null); }}><span aria-hidden="true">🧭</span>坐标登录</button>
              <button type="button" disabled title="微信登录即将上线"><span aria-hidden="true">💬</span>微信登录·即将上线</button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
