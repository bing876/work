// 用户账号:密码哈希(scrypt)、JWT(HS256)、验证码(开发固定码,短信商预留)。零依赖,只用 node:crypto。
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const USERS_DDL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    coordinate_id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL
  )
`;
const now = () => new Date().toISOString();
export const DEV_CODE = '123456';
export const COORD_START = 1000;

// ---- 手机号/坐标号格式 ----
export const normalizePhone = (phone) => {
  const v = String(phone ?? '').trim();
  if (!/^\d{6,15}$/.test(v)) throw new Error('手机号格式错误(6-15位数字)');
  return v;
};
export const normalizeCoordinate = (cid) => {
  const v = String(cid ?? '').trim().toUpperCase();
  if (!/^XYZ\d+$/.test(v)) throw new Error('坐标号格式错误(应为 XYZ + 数字,如 XYZ1000)');
  return v;
};

// ---- 密码哈希 scrypt(盐随机,防彩虹表;比较用恒定时间,防时序攻击) ----
export const hashPassword = (password) => {
  if (typeof password !== 'string' || password.length < 6) throw new Error('密码至少6位');
  if (password.length > 200) throw new Error('密码最多200位');
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
};
export const verifyPassword = (password, stored) => {
  if (typeof stored !== 'string') return false;
  const [algo, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  try {
    const a = Buffer.from(scryptSync(String(password ?? ''), salt, 64).toString('hex'), 'hex');
    const b = Buffer.from(hash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

// ---- JWT(HS256,手写):只认 HS256(防算法混淆),签名恒定时间比较,过期即拒 ----
const b64urlEncode = (obj) => Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)).toString('base64url');
let cachedSecret = null;
export const authSecret = () => {
  if (cachedSecret) return cachedSecret;
  if (process.env.AUTH_SECRET) {
    cachedSecret = process.env.AUTH_SECRET;
  } else {
    cachedSecret = randomBytes(32).toString('hex');
    console.warn('[auth] AUTH_SECRET 未设置,已生成随机密钥(服务重启后旧 Token 失效)');
  }
  return cachedSecret;
};
export const signToken = (userId, ttlSec = 30 * 24 * 3600) => {
  const header = b64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const payload = b64urlEncode({ sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSec });
  const sig = createHmac('sha256', authSecret()).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
};
export const verifyToken = (token) => {
  try {
    const [header, payload, sig] = String(token ?? '').split('.');
    if (!header || !payload || !sig) return null;
    if (JSON.parse(Buffer.from(header, 'base64url').toString()).alg !== 'HS256') return null;
    const expect = createHmac('sha256', authSecret()).update(`${header}.${payload}`).digest();
    const actual = Buffer.from(sig, 'base64url');
    if (expect.length !== actual.length || !timingSafeEqual(expect, actual)) return null;
    const body = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof body.sub !== 'number' || typeof body.exp !== 'number' || body.exp < Date.now() / 1000) return null;
    return body.sub;
  } catch {
    return null;
  }
};

// ---- 验证码:开发阶段固定 123456;配了 SMS_API_KEY 则要求走真实短信商(未实现厂商前明确报错,不断言已发送) ----
export const isSmsConfigured = () => Boolean(process.env.SMS_API_KEY);
export const requestCode = (phone) => {
  void phone;
  if (isSmsConfigured()) throw new Error('短信服务尚未接入具体厂商实现,请先去掉 SMS_API_KEY 用开发模式');
  return { dev: true, code: DEV_CODE };
};
export const verifyCode = (phone, code) => {
  void phone;
  if (isSmsConfigured()) return false;
  return String(code ?? '').trim() === DEV_CODE;
};

// ---- 用户领域 ----
export const toUserJson = (row) => ({ id: row.id, phone: row.phone, coordinateId: row.coordinate_id, created_at: row.created_at });
export const findUserByPhone = (db, phone) => db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
export const findUserByCoordinate = (db, cid) => db.prepare('SELECT * FROM users WHERE coordinate_id = ?').get(cid);
// 分配坐标号:随机抽号(XYZ + 4位起,撞号自动重抽;4位抽满升5位,以此类推);分配后永久不变
export const allocateCoordinate = (db) => {
  for (const width of [4, 5, 6, 7, 8]) {
    const min = 10 ** (width - 1);
    const max = 10 ** width - 1;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = `XYZ${min + Math.floor(Math.random() * (max - min + 1))}`;
      if (!findUserByCoordinate(db, candidate)) return candidate;
    }
  }
  // 穷尽兜底(基本走不到):当前最大号+1
  const row = db
    .prepare("SELECT coordinate_id FROM users WHERE coordinate_id LIKE 'XYZ%' ORDER BY CAST(SUBSTR(coordinate_id, 4) AS INTEGER) DESC LIMIT 1")
    .get();
  return `XYZ${(row ? Number(row.coordinate_id.slice(3)) : 0) + 1}`;
};
export const registerUser = (db, phone) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const id = Number(
        db.prepare('INSERT INTO users (phone, password_hash, coordinate_id, created_at) VALUES (?, ?, ?, ?)').run(phone, null, allocateCoordinate(db), now()).lastInsertRowid,
      );
      return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};
