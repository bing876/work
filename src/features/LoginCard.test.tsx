import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginCard } from './LoginCard';

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const user = { id: 1, phone: '13800000001', coordinateId: 'XYZ5242', created_at: 't' };

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('LoginCard 登录小卡片', () => {
  it('手机验证码登录成功→存 Token 进工作台', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/login-phone') {
        return Promise.resolve(jsonResponse({ ok: true, token: 'tok-1', registered: false, user }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000001' } });
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
    expect(localStorage.getItem('dimspace-token')).toBe('tok-1');
  });

  it('新注册→展示坐标号即密码→进工作台', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/auth/login-phone') {
        return Promise.resolve(jsonResponse({ ok: true, token: 'tok-new', registered: true, user }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000099' } });
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByLabelText('你的坐标号')).toHaveTextContent('XYZ5242'));
    expect(onAuthed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '进入工作台' }));
    expect(onAuthed).toHaveBeenCalled();
    expect(localStorage.getItem('dimspace-token')).toBe('tok-new');
  });

  it('手机号+坐标号登录成功;失败显示后端人话错误', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/auth/login-account') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { coordinateId: string };
        if (body.coordinateId === 'XYZ5242') return Promise.resolve(jsonResponse({ ok: true, token: 'tok-2', user }));
        return Promise.resolve(jsonResponse({ ok: false, error: '坐标号不正确,请检查后重试', code: 'BAD_COORDINATE' }, 401));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.click(screen.getByRole('tab', { name: '账号密码登录' }));
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000001' } });
    fireEvent.change(screen.getByLabelText('坐标号(密码)'), { target: { value: 'XYZ0000' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('坐标号不正确'));
    expect(onAuthed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('坐标号(密码)'), { target: { value: 'XYZ5242' } });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
  });

  it('获取验证码调接口并进入倒计时,带 +86 区号选择', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, dev: true, message: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginCard onAuthed={() => {}} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000001' } });
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/code', expect.objectContaining({ method: 'POST' })));
    expect(screen.getByRole('button', { name: '60s' })).toBeDisabled();
    expect(screen.getByLabelText('国家区号')).toHaveValue('86');
  });

  it('底部坐标按钮切到账号登录;微信按钮禁用待上线', async () => {
    render(<LoginCard onAuthed={() => {}} />);
    expect(screen.queryByLabelText('坐标号(密码)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '坐标登录' }));
    expect(screen.getByLabelText('坐标号(密码)')).toBeInTheDocument();
    const wechat = screen.getByRole('button', { name: /微信登录/ });
    expect(wechat).toBeDisabled();
  });
});
