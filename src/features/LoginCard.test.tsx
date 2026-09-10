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
        return Promise.resolve(jsonResponse({ ok: true, token: 'tok-1', registered: false, needPassword: false, user }));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000001' } });
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
    expect(localStorage.getItem('dimspace-token')).toBe('tok-1');
  });

  it('新注册→展示坐标号→设密码进工作台', async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      calls.push(url);
      if (url === '/api/auth/login-phone') {
        return Promise.resolve(jsonResponse({ ok: true, token: 'tok-new', registered: true, needPassword: true, user }));
      }
      if (url === '/api/auth/set-password') return Promise.resolve(jsonResponse({ ok: true }));
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000099' } });
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    await waitFor(() => expect(screen.getByLabelText('你的坐标号')).toHaveTextContent('XYZ5242'));
    expect(onAuthed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('登录密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: '进入工作台' }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
    expect(calls).toContain('/api/auth/set-password');
  });

  it('新注册可跳过设密码直接进', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, token: 'tok-new', registered: true, needPassword: true, user }));
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000099' } });
    fireEvent.change(screen.getByLabelText('验证码'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '跳过,先逛逛' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '跳过,先逛逛' }));
    expect(onAuthed).toHaveBeenCalled();
    expect(localStorage.getItem('dimspace-token')).toBe('tok-new');
  });

  it('坐标号+密码登录成功;失败显示后端人话错误', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/auth/login-id') {
        const body = JSON.parse(String(init?.body ?? '{}')) as { password: string };
        if (body.password === 'secret123') return Promise.resolve(jsonResponse({ ok: true, token: 'tok-2', user }));
        return Promise.resolve(jsonResponse({ ok: false, error: '密码错误,请重试', code: 'BAD_PASSWORD' }, 401));
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const onAuthed = vi.fn();
    render(<LoginCard onAuthed={onAuthed} />);
    fireEvent.click(screen.getByRole('tab', { name: '坐标号登录' }));
    fireEvent.change(screen.getByLabelText('坐标号'), { target: { value: 'XYZ5242' } });
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('密码错误,请重试'));
    expect(onAuthed).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: 'LOGIN' }));
    await waitFor(() => expect(onAuthed).toHaveBeenCalled());
  });

  it('发送验证码调接口并进入倒计时', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true, dev: true, message: 'x' }));
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginCard onAuthed={() => {}} />);
    fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000001' } });
    fireEvent.click(screen.getByRole('button', { name: '发送验证码' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/code', expect.objectContaining({ method: 'POST' })));
    expect(screen.getByRole('button', { name: '60s' })).toBeDisabled();
  });
});
